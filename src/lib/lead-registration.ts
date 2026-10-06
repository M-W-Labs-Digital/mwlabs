import "server-only";

import { db } from "@/lib/db";
import { notifyOrganization, queueWorkflowEmail } from "@/lib/notifications";

export type LeadRegistrationProfile = {
  userId: string;
  name: string;
  email: string;
  company?: string | null;
  phone?: string | null;
  serviceInterest?: string | null;
  budgetRange?: string | null;
  projectBrief?: string | null;
  ipAddress?: string | null;
  newRequest?: boolean;
};

function clean(value?: string | null) {
  const normalized = value?.trim();
  return normalized || null;
}

function registrationSummary(profile: LeadRegistrationProfile) {
  const details = [
    profile.serviceInterest && `Service: ${profile.serviceInterest}`,
    profile.budgetRange && `Budget: ${profile.budgetRange}`,
    profile.projectBrief && `Project brief:\n${profile.projectBrief}`,
  ].filter(Boolean);

  return details.join("\n\n") || "Prospect created a secure project-registration account.";
}

export async function registerLeadProfile(profile: LeadRegistrationProfile) {
  const organization = await db.organization.findUnique({
    where: { slug: "mw-labs" },
    select: { id: true },
  });
  if (!organization) return null;

  const email = profile.email.trim().toLowerCase();
  const company = clean(profile.company) ?? "Individual enquiry";
  const phone = clean(profile.phone);
  const user = await db.user.findUnique({ where: { id: profile.userId }, select: { email: true, emailVerified: true } });
  const mayLinkByEmail = Boolean(user?.emailVerified && user.email.toLowerCase() === email);
  const existingByUser = profile.newRequest ? null : await db.lead.findFirst({
    where: { userId: profile.userId, organizationId: organization.id },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const existingByEmail = existingByUser || !mayLinkByEmail
    ? null
    : await db.lead.findFirst({
        where: {
          organizationId: organization.id,
          email,
          userId: null,
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, notes: true, score: true },
      });

  const isFirstRegistration = !existingByUser;
  const summary = registrationSummary(profile);
  const nextActivityAt = new Date(Date.now() + 24 * 60 * 60 * 1_000);

  const lead = existingByUser
    ? await db.lead.update({
        where: { id: existingByUser.id },
        data: {
          name: profile.name.trim(),
          company,
          email,
          phone,
        },
        select: { id: true, stage: true },
      })
    : existingByEmail
      ? await db.lead.update({
          where: { id: existingByEmail.id },
          data: {
            userId: profile.userId,
            name: profile.name.trim(),
            company,
            email,
            phone,
            score: Math.max(existingByEmail.score, 65),
            nextActivityAt,
            notes: existingByEmail.notes
              ? `${existingByEmail.notes}\n\nRegistration profile\n${summary}`
              : summary,
          },
          select: { id: true, stage: true },
        })
      : await db.lead.create({
          data: {
            organizationId: organization.id,
            userId: profile.userId,
            name: profile.name.trim(),
            company,
            email,
            phone,
            source: "Website registration",
            stage: "New",
            score: 65,
            probability: 15,
            nextActivityAt,
            notes: summary,
          },
          select: { id: true, stage: true },
        });

  if (isFirstRegistration) {
    await db.$transaction([
      db.activity.create({
        data: {
          organizationId: organization.id,
          leadId: lead.id,
          type: "lead.registered",
          title: existingByEmail
            ? "Website enquiry completed registration"
            : "New prospect registered",
          body: summary,
        },
      }),
      db.auditLog.create({
        data: {
          organizationId: organization.id,
          userId: profile.userId,
          action: "lead.registered",
          resource: "lead",
          resourceId: lead.id,
          ipAddress: profile.ipAddress ?? null,
          metadata: JSON.stringify({
            source: existingByEmail ? "enquiry-conversion" : "registration",
            serviceInterest: clean(profile.serviceInterest),
            budgetRange: clean(profile.budgetRange),
          }),
        },
      }),
    ]);
    await notifyOrganization({
      organizationId: organization.id,
      actorId: profile.userId,
      category: "activity",
      type: "lead.registered",
      title: existingByEmail ? "Enquiry converted to registration" : "New prospect registered",
      message: `${profile.name.trim()} created a secure project profile for ${company}.`,
      actionUrl: "/app/leads",
      resource: "leads",
      resourceId: lead.id,
    });
    await queueWorkflowEmail({
      organizationId: organization.id,
      to: email,
      recipientName: profile.name,
      title: "Your M&W Labs project profile is ready",
      message: "Your project details are securely connected to our CRM. You can follow progress and book or manage discovery meetings from your client portal.",
      actionLabel: "Open your secure portal",
      actionUrl: "/app",
      idempotencyKey: `lead-registration-${lead.id}`,
    });
  }

  return lead;
}
