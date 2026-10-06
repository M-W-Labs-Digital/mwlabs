import { z } from "zod";

import { assessPublicSubmission } from "@/lib/anti-spam";
import { hasTrustedMutationOrigin } from "@/lib/dal";
import { db } from "@/lib/db";
import { notifyOrganization, queueWorkflowEmail } from "@/lib/notifications";
import { createLeadBookingPath } from "@/lib/scheduling";

const enquirySchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(191),
  phone: z.string().trim().max(40).optional().default(""),
  company: z.string().trim().max(160).optional().default(""),
  service: z.string().trim().max(120).optional().default("General enquiry"),
  message: z.string().trim().min(10).max(4_000),
  website: z.string().max(0).optional().default(""),
  formStartedAt: z.string().optional(),
});

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });

  const parsed = enquirySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please check the enquiry details." }, { status: 400 });
  const spam = assessPublicSubmission(request, { email: parsed.data.email, name: parsed.data.name, message: parsed.data.message, honeypot: parsed.data.website, formStartedAt: parsed.data.formStartedAt }, { bucket: "enquiry", limit: 5 });
  if (!spam.allowed) return spam.error ? Response.json({ error: spam.error }, { status: spam.status }) : Response.json({ received: true }, { status: spam.status });

  const organization = await db.organization.findUnique({ where: { slug: "mw-labs" }, select: { id: true } });
  if (!organization) return Response.json({ error: "The enquiry workspace is not configured yet." }, { status: 503 });

  const lead = await db.lead.create({
    data: {
      organizationId: organization.id,
      name: parsed.data.name,
      company: parsed.data.company || "Individual enquiry",
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      source: "Website landing page",
      stage: "New",
      score: 55,
      probability: 10,
      notes: `Service: ${parsed.data.service}\n\n${parsed.data.message}`,
    },
    select: { id: true },
  });

  await db.$transaction([
    db.activity.create({
      data: {
        organizationId: organization.id,
        leadId: lead.id,
        type: "enquiry.received",
        title: "Landing-page enquiry received",
        body: parsed.data.message,
      },
    }),
    db.auditLog.create({
      data: {
        organizationId: organization.id,
        action: "public_enquiry.created",
        resource: "lead",
        resourceId: lead.id,
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip"),
        metadata: JSON.stringify({ service: parsed.data.service, source: "landing-page" }),
      },
    }),
  ]);

  spam.commit?.();
  const bookingPath = createLeadBookingPath(lead.id);
  await notifyOrganization({
    organizationId: organization.id,
    category: "activity",
    type: "enquiry.received",
    title: "New website enquiry",
    message: `${parsed.data.name} from ${parsed.data.company || "an individual enquiry"} asked about ${parsed.data.service}.`,
    actionUrl: "/app/leads",
    resource: "leads",
    resourceId: lead.id,
  });
  await queueWorkflowEmail({
    organizationId: organization.id,
    to: parsed.data.email.toLowerCase(),
    recipientName: parsed.data.name,
    title: "We received your M&W Labs enquiry",
    message: `Thanks for telling us about your ${parsed.data.service} project. Your brief is securely in our workflow, and you can choose a discovery time now if you are ready.`,
    actionLabel: "Choose a discovery time",
    actionUrl: bookingPath,
    idempotencyKey: `enquiry-received-${lead.id}`,
  });

  return Response.json({
    received: true,
    bookingPath,
  }, { status: 201 });
}
