import "server-only";

import { queueNotificationEmailJobs, queueWorkflowEmailJob } from "@/lib/background-jobs";
import { absoluteAppUrl } from "@/lib/email";
import { db } from "@/lib/db";
import { canAccessModule } from "@/lib/permissions";

export type NotificationCategory = "crud" | "activity" | "booking" | "system";

type NotificationEvent = {
  organizationId: string;
  actorId?: string | null;
  category: NotificationCategory;
  type: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  resource?: string | null;
  resourceId?: string | null;
  recipientUserIds?: string[];
};

const resourceDetails: Record<string, { singular: string; href: string }> = {
  leads: { singular: "lead", href: "/app/leads" },
  clients: { singular: "client", href: "/app/clients" },
  proposals: { singular: "proposal", href: "/app/proposals" },
  contracts: { singular: "contract", href: "/app/contracts" },
  projects: { singular: "project", href: "/app/projects" },
  tasks: { singular: "task", href: "/app/tasks" },
  "calendar-events": { singular: "calendar event", href: "/app/calendar" },
  "time-entries": { singular: "time entry", href: "/app/time" },
  invoices: { singular: "invoice", href: "/app/finance" },
  expenses: { singular: "expense", href: "/app/finance" },
  retainers: { singular: "retainer", href: "/app/finance" },
  documents: { singular: "document", href: "/app/documents" },
  activities: { singular: "activity", href: "/app/inbox" },
  automations: { singular: "automation", href: "/app/automations" },
  knowledge: { singular: "knowledge item", href: "/app/documents" },
  "blog-posts": { singular: "blog post", href: "/app/blog" },
  "work-posts": { singular: "work post", href: "/app/work" },
  "seo-pages": { singular: "SEO page", href: "/app/seo-pages" },
  milestones: { singular: "milestone", href: "/app/projects" },
  "invoice-items": { singular: "invoice item", href: "/app/finance" },
  payments: { singular: "payment", href: "/app/finance" },
  teams: { singular: "team", href: "/app/team" },
};

function categoryEmailEnabled(category: NotificationCategory, preference: {
  emailCrud: boolean;
  emailActivity: boolean;
  emailBookings: boolean;
}) {
  if (category === "crud") return preference.emailCrud;
  if (category === "booking") return preference.emailBookings;
  return preference.emailActivity;
}

function recordLabel(record: Record<string, unknown>, singular: string) {
  const value = record.title ?? record.name ?? record.company ?? record.number ?? record.description ?? record.email;
  return value ? `“${String(value).slice(0, 160)}”` : `the ${singular}`;
}

export async function notifyOrganization(event: NotificationEvent) {
  try {
    const members = await db.member.findMany({
      where: {
        organizationId: event.organizationId,
        ...(event.recipientUserIds ? { userId: { in: event.recipientUserIds } } : {}),
      },
      select: {
        userId: true,
        role: true,
        user: {
          select: {
            notificationPreferences: {
              where: { organizationId: event.organizationId },
              take: 1,
              select: {
                inAppEnabled: true,
                emailEnabled: true,
                emailCrud: true,
                emailActivity: true,
                emailBookings: true,
                notifyOwnActions: true,
              },
            },
          },
        },
      },
    });
    const rows = members.flatMap((member) => {
      const targetModule = event.actionUrl?.match(/^\/app\/([^/?#]+)/)?.[1];
      if (targetModule && !canAccessModule(member.role, targetModule)) return [];
      const preference = member.user.notificationPreferences[0] ?? {
        inAppEnabled: true,
        emailEnabled: true,
        emailCrud: true,
        emailActivity: true,
        emailBookings: true,
        notifyOwnActions: true,
      };
      if (member.userId === event.actorId && !preference.notifyOwnActions) return [];
      const emailRequested = preference.emailEnabled && categoryEmailEnabled(event.category, preference);
      if (!preference.inAppEnabled && !emailRequested) return [];
      return [{
        id: crypto.randomUUID(),
        organizationId: event.organizationId,
        userId: member.userId,
        actorId: event.actorId || null,
        category: event.category,
        type: event.type,
        title: event.title.slice(0, 191),
        message: event.message,
        actionUrl: event.actionUrl || null,
        resource: event.resource || null,
        resourceId: event.resourceId || null,
        inApp: preference.inAppEnabled,
        emailRequested,
        emailStatus: emailRequested ? "Pending" : "Not requested",
      }];
    });
    if (!rows.length) return [];
    await db.notification.createMany({ data: rows });
    const emailIds = rows.filter((row) => row.emailRequested).map((row) => row.id);
    if (emailIds.length) await queueNotificationEmailJobs(event.organizationId, emailIds);
    return rows.map((row) => row.id);
  } catch (error) {
    console.error("Notification creation failed", error);
    return [];
  }
}

export async function notifyCrudMutation({
  organizationId,
  actorId,
  resource,
  action,
  record,
  changedFields = [],
}: {
  organizationId: string;
  actorId: string;
  resource: string;
  action: "created" | "updated" | "deleted";
  record: Record<string, unknown>;
  changedFields?: string[];
}) {
  try {
    const details = resourceDetails[resource] ?? { singular: resource.replaceAll("-", " ").replace(/s$/, ""), href: "/app" };
    const actor = await db.user.findUnique({ where: { id: actorId }, select: { name: true } });
    const category: NotificationCategory = resource === "activities" ? "activity" : resource === "calendar-events" ? "booking" : "crud";
    const fields = changedFields.filter((field) => !["content", "notes", "body", "description"].includes(field)).slice(0, 6);
    const suffix = action === "updated" && fields.length ? ` Changed: ${fields.join(", ")}.` : "";
    return notifyOrganization({
      organizationId,
      actorId,
      category,
      type: `${resource}.${action}`,
      title: `${details.singular[0]?.toUpperCase()}${details.singular.slice(1)} ${action}`,
      message: `${actor?.name || "A workspace member"} ${action} ${recordLabel(record, details.singular)}.${suffix}`,
      actionUrl: details.href,
      resource,
      resourceId: typeof record.id === "string" ? record.id : null,
    });
  } catch (error) {
    console.error("CRUD notification creation failed", error);
    return [];
  }
}

export async function queueWorkflowEmail({
  organizationId,
  to,
  recipientName,
  title,
  message,
  actionLabel,
  actionUrl,
  idempotencyKey,
}: {
  organizationId?: string | null;
  to: string;
  recipientName?: string | null;
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string | null;
  idempotencyKey: string;
}) {
  return queueWorkflowEmailJob({
    organizationId,
    to,
    recipientName,
    title,
    message,
    actionLabel,
    actionUrl,
    emailIdempotencyKey: idempotencyKey,
  });
}

export { absoluteAppUrl };
