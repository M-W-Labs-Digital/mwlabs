import { z } from "zod";

import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/dal";
import { notifyCrudMutation } from "@/lib/notifications";
import { canWriteResource } from "@/lib/permissions";

const createLeadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().min(2).max(160),
  email: z.email().max(191),
  value: z.coerce.number().min(0).max(100_000_000),
  source: z.string().trim().min(2).max(80),
});

export async function POST(request: Request) {
  const session = await requireApiSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!canWriteResource(session.role, "leads")) return Response.json({ error: "Your workspace role cannot create leads." }, { status: 403 });

  const parsed = createLeadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Please check the lead details." }, { status: 400 });
  }

  const lead = await db.lead.create({
    data: {
      organizationId: session.organizationId,
      ...parsed.data,
      stage: "New",
      score: 50,
      probability: 10,
    },
    select: {
      id: true,
      name: true,
      company: true,
      stage: true,
      value: true,
      score: true,
      ownerName: true,
    },
  });

  await db.auditLog.create({
    data: {
      organizationId: session.organizationId,
      userId: session.userId,
      action: "lead.created",
      resource: "lead",
      resourceId: lead.id,
    },
  });
  await notifyCrudMutation({
    organizationId: session.organizationId,
    actorId: session.userId,
    resource: "leads",
    action: "created",
    record: lead,
  });

  return Response.json({ lead: { ...lead, value: Number(lead.value) } }, { status: 201 });
}
