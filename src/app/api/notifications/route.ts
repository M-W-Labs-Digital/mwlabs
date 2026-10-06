import { z } from "zod";
import { notificationAccessWhere } from "@/lib/permissions";

import { queueNotificationEmailJobs } from "@/lib/background-jobs";
import { requireApiSession } from "@/lib/dal";
import { db } from "@/lib/db";

const changeSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read"), id: z.string().min(1).max(191) }),
  z.object({ action: z.literal("unread"), id: z.string().min(1).max(191) }),
  z.object({ action: z.literal("archive"), id: z.string().min(1).max(191) }),
  z.object({ action: z.literal("read-all") }),
  z.object({ action: z.literal("archive-read") }),
  z.object({ action: z.literal("retry-email"), id: z.string().min(1).max(191) }),
]);

export async function GET(request: Request) {
  const session = await requireApiSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") || 40);
  const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, Math.floor(requestedLimit))) : 40;
  const category = url.searchParams.get("category");
  const unreadOnly = url.searchParams.get("unread") === "true";
  const where = {
    ...notificationAccessWhere(session.role),
    userId: session.userId,
    organizationId: session.organizationId,
    inApp: true,
    archivedAt: null,
    ...(category && ["crud", "activity", "booking", "system"].includes(category) ? { category } : {}),
    ...(unreadOnly ? { readAt: null } : {}),
  };
  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        category: true,
        type: true,
        title: true,
        message: true,
        actionUrl: true,
        resource: true,
        resourceId: true,
        emailRequested: true,
        emailStatus: true,
        emailedAt: true,
        readAt: true,
        createdAt: true,
        actor: { select: { name: true, image: true } },
      },
    }),
    db.notification.count({
      where: { ...notificationAccessWhere(session.role), userId: session.userId, organizationId: session.organizationId, inApp: true, archivedAt: null, readAt: null },
    }),
  ]);
  return Response.json({ notifications, unreadCount }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const session = await requireApiSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = changeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid notification change." }, { status: 400 });
  const owned = { ...notificationAccessWhere(session.role), userId: session.userId, organizationId: session.organizationId };

  if (parsed.data.action === "read-all") {
    const result = await db.notification.updateMany({ where: { ...owned, inApp: true, archivedAt: null, readAt: null }, data: { readAt: new Date() } });
    return Response.json({ changed: result.count });
  }
  if (parsed.data.action === "archive-read") {
    const result = await db.notification.updateMany({ where: { ...owned, inApp: true, archivedAt: null, readAt: { not: null } }, data: { archivedAt: new Date() } });
    return Response.json({ changed: result.count });
  }

  const notification = await db.notification.findFirst({ where: { id: parsed.data.id, ...owned }, select: { id: true, emailRequested: true } });
  if (!notification) return Response.json({ error: "Notification not found." }, { status: 404 });
  if (parsed.data.action === "retry-email") {
    if (!notification.emailRequested) return Response.json({ error: "Email was not requested for this notification." }, { status: 409 });
    await db.notification.update({ where: { id: notification.id }, data: { emailStatus: "Pending", emailError: null } });
    await queueNotificationEmailJobs(session.organizationId, [notification.id], true);
    return Response.json({ changed: 1, emailStatus: "Pending" });
  }
  const data = parsed.data.action === "read"
    ? { readAt: new Date() }
    : parsed.data.action === "unread"
      ? { readAt: null }
      : { archivedAt: new Date() };
  await db.notification.update({ where: { id: notification.id }, data });
  return Response.json({ changed: 1 });
}
