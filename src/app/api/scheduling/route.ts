import { z } from "zod";
import { createRateLimiter } from "@/lib/rate-limit";

import { assessPublicSubmission } from "@/lib/anti-spam";
import { getAuthSessionFromHeaders, hasTrustedMutationOrigin } from "@/lib/dal";
import { db } from "@/lib/db";
import { notifyOrganization, queueWorkflowEmail } from "@/lib/notifications";
import {
  availableDays,
  bookingSlotKey,
  createBookingManagePath,
  createBookingReference,
  hasCalendarConflict,
  isValidTimezone,
  publicBookingType,
  readBookingManageToken,
  readLeadBookingToken,
  schedulingOrganizationSlug,
} from "@/lib/scheduling";

export const runtime = "nodejs";

const visitorRateLimit = createRateLimiter();
const bookingSchema = z.object({
  bookingTypeId: z.string().min(1).max(191),
  startAt: z.string().datetime(),
  timezone: z.string().trim().min(1).max(100),
  name: z.string().trim().min(2).max(120),
  email: z.email().max(191),
  phone: z.string().trim().max(40).optional().default(""),
  company: z.string().trim().max(160).optional().default(""),
  notes: z.string().trim().max(4_000).optional().default(""),
  leadToken: z.string().max(2_000).optional(),
  website: z.string().max(0).optional().default(""),
  formStartedAt: z.string().optional(),
});

function withinRateLimit(request: Request, bucket: "availability" | "booking", limit: number) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  return visitorRateLimit(`${bucket}:${address}`, limit, 60 * 60 * 1_000);
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "The meeting could not be booked.";
  if (/unique|duplicate|slotKey|time was just booked/i.test(message)) return Response.json({ error: "That time was just booked. Please choose another available time." }, { status: 409 });
  return Response.json({ error: /prisma|database|query/i.test(message) ? "The booking service is temporarily unavailable." : message }, { status: 400 });
}

export async function GET(request: Request) {
  try {
    if (!withinRateLimit(request, "availability", 120)) return Response.json({ error: "Too many availability requests." }, { status: 429 });
    const organization = await db.organization.findUnique({ where: { slug: schedulingOrganizationSlug }, select: { id: true } });
    if (!organization) return Response.json({ error: "Scheduling is not configured." }, { status: 503 });
    const url = new URL(request.url);
    const requestedType = url.searchParams.get("type");
    const types = await db.bookingType.findMany({
      where: { organizationId: organization.id, active: true },
      orderBy: [{ createdAt: "asc" }],
    });
    const bookingType = types.find((type) => type.slug === requestedType || type.id === requestedType) ?? types[0];
    if (!bookingType) return Response.json({ error: "No meeting types are accepting bookings." }, { status: 404 });

    const manageId = readBookingManageToken(url.searchParams.get("booking") ?? undefined);
    const managedBooking = manageId
      ? await db.calendarEvent.findFirst({ where: { id: manageId, organizationId: organization.id }, select: { id: true } })
      : null;
    const days = await availableDays({
      organizationId: organization.id,
      bookingType,
      from: url.searchParams.get("from") ?? undefined,
      days: Number(url.searchParams.get("days") ?? 21),
      excludeEventId: managedBooking?.id,
    });

    return Response.json({
      bookingTypes: types.map(publicBookingType),
      selectedType: publicBookingType(bookingType),
      days,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Availability lookup failed", error);
    return Response.json({ error: "Available times are temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return Response.json({ error: "Unauthorized request origin." }, { status: 403 });
  if (!withinRateLimit(request, "booking", 8)) return Response.json({ error: "Too many booking attempts. Please try again later." }, { status: 429 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 32 * 1024) return Response.json({ error: "Request is too large." }, { status: 413 });
  const parsed = bookingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid booking details." }, { status: 400 });
  if (!isValidTimezone(parsed.data.timezone)) return Response.json({ error: "Select a valid timezone." }, { status: 400 });
  const spam = assessPublicSubmission(request, { email: parsed.data.email, name: parsed.data.name, message: `${parsed.data.bookingTypeId}:${parsed.data.startAt}:${parsed.data.notes}`, honeypot: parsed.data.website, formStartedAt: parsed.data.formStartedAt }, { bucket: "booking", limit: 8, duplicateWindowMs: 30 * 60 * 1_000 });
  if (!spam.allowed) return spam.error ? Response.json({ error: spam.error }, { status: spam.status }) : Response.json({ received: true }, { status: spam.status });

  try {
    const organization = await db.organization.findUnique({ where: { slug: schedulingOrganizationSlug }, select: { id: true } });
    if (!organization) return Response.json({ error: "Scheduling is not configured." }, { status: 503 });
    const bookingType = await db.bookingType.findFirst({ where: { id: parsed.data.bookingTypeId, organizationId: organization.id, active: true } });
    if (!bookingType) return Response.json({ error: "This meeting type is no longer available." }, { status: 404 });

    const requestedStart = new Date(parsed.data.startAt);
    const availability = await availableDays({ organizationId: organization.id, bookingType, days: bookingType.maximumAdvanceDays + 1 });
    const slot = availability.flatMap((day) => day.slots).find((item) => item.startAt === requestedStart.toISOString());
    if (!slot) return Response.json({ error: "That time is no longer available. Please choose another slot." }, { status: 409 });

    const normalizedEmail = parsed.data.email.toLowerCase();
    const tokenLeadId = readLeadBookingToken(parsed.data.leadToken);
    const session = await getAuthSessionFromHeaders(request.headers);
    const event = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organization WHERE id = ${organization.id} FOR UPDATE`;
      const requestedEnd = new Date(slot.endAt);
      const nearbyEvents = await tx.calendarEvent.findMany({
        where: {
          organizationId: organization.id,
          status: "Scheduled",
          startAt: { lt: new Date(requestedEnd.getTime() + 24 * 60 * 60 * 1_000) },
          OR: [
            { endAt: { gt: new Date(requestedStart.getTime() - 24 * 60 * 60 * 1_000) } },
            { endAt: null, startAt: { gt: new Date(requestedStart.getTime() - 24 * 60 * 60 * 1_000) } },
          ],
        },
        select: { startAt: true, endAt: true, bookingType: { select: { durationMinutes: true, bufferBeforeMinutes: true, bufferAfterMinutes: true } } },
      });
      if (hasCalendarConflict({ events: nearbyEvents, startAt: requestedStart, endAt: requestedEnd, bufferBeforeMinutes: bookingType.bufferBeforeMinutes, bufferAfterMinutes: bookingType.bufferAfterMinutes })) {
        throw new Error("That time was just booked. Please choose another available time.");
      }

      let lead = tokenLeadId
        ? await tx.lead.findFirst({ where: { id: tokenLeadId, organizationId: organization.id }, select: { id: true, email: true, stage: true, score: true, probability: true } })
        : session?.user?.id
          ? await tx.lead.findFirst({ where: { userId: session.user.id, organizationId: organization.id }, select: { id: true, email: true, stage: true, score: true, probability: true } })
          : null;
      lead ??= await tx.lead.findFirst({
        where: { organizationId: organization.id, email: normalizedEmail },
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, stage: true, score: true, probability: true },
      });

      if (lead && lead.email.toLowerCase() !== normalizedEmail) {
        throw new Error("Use the email address connected to this booking invitation.");
      }

      if (!lead) {
        lead = await tx.lead.create({
          data: {
            organizationId: organization.id,
            name: parsed.data.name,
            company: parsed.data.company || "Direct booking",
            email: normalizedEmail,
            phone: parsed.data.phone || null,
            source: "Native scheduler",
            stage: "Discovery",
            score: 75,
            probability: 30,
            nextActivityAt: requestedStart,
            notes: parsed.data.notes || "Booked directly through the M&W scheduling page.",
          },
          select: { id: true, email: true, stage: true, score: true, probability: true },
        });
      } else {
        await tx.lead.update({
          where: { id: lead.id },
          data: {
            stage: ["New", "Qualified"].includes(lead.stage) ? "Discovery" : lead.stage,
            score: Math.max(lead.score, 75),
            probability: Math.max(lead.probability, 30),
            nextActivityAt: requestedStart,
          },
        });
      }

      const reference = createBookingReference();
      const created = await tx.calendarEvent.create({
        data: {
          organizationId: organization.id,
          leadId: lead.id,
          bookingTypeId: bookingType.id,
          source: "Online booking",
          bookingReference: reference,
          slotKey: bookingSlotKey(organization.id, requestedStart),
          title: bookingType.title,
          inviteeName: parsed.data.name,
          inviteeEmail: normalizedEmail,
          inviteePhone: parsed.data.phone || null,
          inviteeCompany: parsed.data.company || null,
          startAt: requestedStart,
          endAt: requestedEnd,
          timezone: parsed.data.timezone,
          location: bookingType.location,
          notes: parsed.data.notes || null,
        },
        select: { id: true, bookingReference: true, title: true, startAt: true, endAt: true, timezone: true, location: true },
      });

      await Promise.all([
        tx.activity.create({
          data: {
            organizationId: organization.id,
            leadId: lead.id,
            type: "meeting.scheduled",
            title: `${bookingType.title} scheduled`,
            body: `${parsed.data.name} booked ${requestedStart.toISOString()} through the M&W scheduler. Reference: ${reference}.`,
          },
        }),
        tx.auditLog.create({
          data: {
            organizationId: organization.id,
            action: "scheduler.booking.created",
            resource: "calendar_event",
            resourceId: created.id,
            ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip"),
            metadata: JSON.stringify({ bookingReference: reference, bookingTypeId: bookingType.id }),
          },
        }),
      ]);
      return created;
    });

    spam.commit?.();
    const managePath = createBookingManagePath(event.id);
    const bookingToken = new URL(managePath, "https://mwlabs.digital").searchParams.get("booking");
    const meetingTime = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: parsed.data.timezone,
      timeZoneName: "short",
    }).format(event.startAt);
    await notifyOrganization({
      organizationId: organization.id,
      category: "booking",
      type: "booking.created",
      title: "New meeting booked",
      message: `${parsed.data.name} booked ${event.title} for ${meetingTime}.`,
      actionUrl: "/app/calendar",
      resource: "calendar-events",
      resourceId: event.id,
    });
    await queueWorkflowEmail({
      organizationId: bookingType.organizationId,
      to: normalizedEmail,
      recipientName: parsed.data.name,
      title: `Confirmed: ${event.title}`,
      message: `Your meeting is confirmed for ${meetingTime}. Reference: ${event.bookingReference}.${event.location ? ` Location: ${event.location}.` : ""}`,
      actionLabel: "Manage your booking",
      actionUrl: managePath,
      idempotencyKey: `booking-confirmed-${event.id}`,
    });
    return Response.json({
      booking: { ...event, startAt: event.startAt.toISOString(), endAt: event.endAt?.toISOString() ?? null },
      managePath,
      calendarPath: bookingToken ? `/api/scheduling/calendar?booking=${encodeURIComponent(bookingToken)}` : null,
    }, { status: 201 });
  } catch (error) {
    return safeError(error);
  }
}
