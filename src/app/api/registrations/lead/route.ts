import { z } from "zod";

import { assessPublicSubmission } from "@/lib/anti-spam";
import { getAuthSessionFromHeaders, hasTrustedMutationOrigin } from "@/lib/dal";
import { db } from "@/lib/db";
import { registerLeadProfile } from "@/lib/lead-registration";

const registrationProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(40).optional().default(""),
  serviceInterest: z.string().trim().min(2).max(120),
  budgetRange: z.string().trim().min(2).max(80),
  projectBrief: z.string().trim().min(10).max(4_000),
  website: z.string().max(0).optional().default(""),
  formStartedAt: z.string().optional(),
  newRequest: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const session = await getAuthSessionFromHeaders(request.headers);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = registrationProfileSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { error: "Please complete every required project detail." },
      { status: 400 },
    );
  }

  const spam = assessPublicSubmission(request, { email: session.user.email, name: parsed.data.name, message: parsed.data.projectBrief, honeypot: parsed.data.website, formStartedAt: parsed.data.formStartedAt }, { bucket: "lead-registration", limit: 5, duplicateWindowMs: 30 * 60 * 1_000 });
  if (!spam.allowed) return spam.error ? Response.json({ error: spam.error }, { status: spam.status }) : Response.json({ registered: true }, { status: spam.status });

  const membership = await db.member.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (membership) {
    return Response.json(
      { error: "Agency team accounts cannot be registered as prospects." },
      { status: 409 },
    );
  }

  await db.user.update({
    where: { id: session.user.id },
    data: {
      name: parsed.data.name,
      company: parsed.data.company,
      phone: parsed.data.phone || null,
      serviceInterest: parsed.data.serviceInterest,
      budgetRange: parsed.data.budgetRange,
      projectBrief: parsed.data.projectBrief,
    },
  });

  const lead = await registerLeadProfile({
    userId: session.user.id,
    name: parsed.data.name,
    email: session.user.email,
    company: parsed.data.company,
    phone: parsed.data.phone,
    serviceInterest: parsed.data.serviceInterest,
    budgetRange: parsed.data.budgetRange,
    projectBrief: parsed.data.projectBrief,
    newRequest: parsed.data.newRequest,
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip"),
  });

  if (!lead) {
    return Response.json(
      { error: "The M&W lead workspace has not been configured yet." },
      { status: 503 },
    );
  }

  spam.commit?.();
  return Response.json({ registered: true, leadId: lead.id }, { status: 200 });
}
