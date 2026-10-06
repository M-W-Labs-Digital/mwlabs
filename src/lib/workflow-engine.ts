import "server-only";

import { db } from "@/lib/db";
import { notifyOrganization } from "@/lib/notifications";

type CrudAction = "created" | "updated" | "deleted";

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function workflowEvents(resource: string, action: CrudAction, record: Record<string, unknown>) {
  const events = new Set<string>();
  if (action === "created") events.add("record.created");
  if (resource === "leads" && action === "created") events.add("lead.created");
  if (resource === "leads" && record.stage === "Won") events.add("lead.won");
  if (resource === "proposals" && ["Accepted", "Converted"].includes(String(record.status))) events.add("proposal.accepted");
  if (resource === "contracts" && ["Signed", "Active"].includes(String(record.status))) events.add("contract.signed");
  if (resource === "tasks" && record.status === "Done") events.add("task.completed");
  if (resource === "invoices" && record.status === "Overdue") events.add("invoice.overdue");
  if (resource === "invoices" && record.status === "Paid") events.add("invoice.paid");
  return Array.from(events);
}

async function ensureClientForLead(organizationId: string, leadId: string, proposalId?: string) {
  const lead = await db.lead.findFirst({ where: { id: leadId, organizationId }, select: { id: true, userId: true, name: true, company: true, email: true, phone: true, value: true, stage: true } });
  if (!lead) return null;
  const account = lead.userId ? await db.user.findUnique({ where: { id: lead.userId }, select: { email: true, emailVerified: true } }) : null;
  // Only a verified email can establish access to customer records.
  const verifiedUserId = account?.emailVerified && account.email.toLowerCase() === lead.email.toLowerCase() ? lead.userId : null;
  let client = await db.client.findFirst({ where: { organizationId, email: lead.email }, select: { id: true, userId: true, lifetimeValue: true } });
  if (!client) {
    client = await db.client.create({ data: { organizationId, userId: verifiedUserId, name: lead.name, company: lead.company, email: lead.email, phone: lead.phone, status: "Onboarding", lifetimeValue: lead.value, healthScore: 80, onboardingProgress: 0 }, select: { id: true, userId: true, lifetimeValue: true } });
  } else if (numberValue(client.lifetimeValue) < numberValue(lead.value)) {
    client = await db.client.update({ where: { id: client.id }, data: { lifetimeValue: lead.value, ...(client.userId ? {} : { userId: verifiedUserId }) }, select: { id: true, userId: true, lifetimeValue: true } });
  } else if (!client.userId && verifiedUserId) {
    client = await db.client.update({ where: { id: client.id }, data: { userId: verifiedUserId }, select: { id: true, userId: true, lifetimeValue: true } });
  }
  if (lead.stage !== "Won") await db.lead.update({ where: { id: lead.id }, data: { stage: "Won", probability: 100 } });
  if (proposalId) await db.proposal.update({ where: { id: proposalId }, data: { clientId: client.id } });
  const body = `Lead ${lead.id} converted to client ${client.id}${proposalId ? ` from proposal ${proposalId}` : ""}.`;
  const exists = await db.activity.findFirst({ where: { organizationId, leadId: lead.id, type: "workflow.client_created", body }, select: { id: true } });
  if (!exists) await db.activity.create({ data: { organizationId, leadId: lead.id, type: "workflow.client_created", title: `${lead.company} moved into client onboarding`, body } });
  return { clientId: client.id, company: lead.company };
}

async function runLifecycle({ organizationId, actorId, resource, action, record, changedFields }: { organizationId: string; actorId: string; resource: string; action: CrudAction; record: Record<string, unknown>; changedFields: string[] }) {
  if (action === "deleted") return null;
  const messages: string[] = [];
  if (resource === "leads" && record.stage === "Won" && (action === "created" || changedFields.includes("stage"))) {
    const conversion = await ensureClientForLead(organizationId, String(record.id));
    if (conversion) {
      messages.push(`${conversion.company} was added to client onboarding.`);
      await notifyOrganization({ organizationId, actorId, category: "activity", type: "workflow.lead_converted", title: "Lead converted to client", message: `${conversion.company} is now ready for onboarding, contracts, and projects.`, actionUrl: "/app/onboarding", resource: "clients", resourceId: conversion.clientId });
    }
  }
  if (resource === "proposals" && ["Accepted", "Converted"].includes(String(record.status)) && record.leadId && (action === "created" || changedFields.includes("status"))) {
    const conversion = await ensureClientForLead(organizationId, String(record.leadId), String(record.id));
    if (conversion) {
      messages.push(`The accepted proposal was linked to ${conversion.company}'s client record.`);
      await notifyOrganization({ organizationId, actorId, category: "activity", type: "workflow.proposal_converted", title: "Accepted proposal handed to onboarding", message: `${conversion.company} is ready for contract and project setup.`, actionUrl: "/app/onboarding", resource: "proposals", resourceId: String(record.id) });
    }
  }
  return messages.length ? messages.join(" ") : null;
}

async function runConfiguredAutomations({ organizationId, actorId, resource, action, record }: { organizationId: string; actorId: string; resource: string; action: CrudAction; record: Record<string, unknown> }) {
  if (action === "deleted") return null;
  const events = workflowEvents(resource, action, record);
  if (!events.length) return null;
  const automations = await db.automation.findMany({ where: { organizationId, enabled: true, trigger: { in: events } }, select: { id: true, name: true, trigger: true, action: true } });
  if (!automations.length) return null;

  for (const automation of automations) {
    if (automation.action === "notify.owners") {
      const recipients = await db.member.findMany({ where: { organizationId, role: { in: ["owner", "admin"] } }, select: { userId: true } });
      await notifyOrganization({ organizationId, actorId, category: "activity", type: `automation.${automation.trigger}`, title: automation.name, message: `${automation.trigger} ran for ${resource} ${String(record.title ?? record.name ?? record.company ?? record.number ?? record.id)}.`, actionUrl: "/app/automations", resource: "automations", resourceId: automation.id, recipientUserIds: recipients.map((member) => member.userId) });
    }
    if (automation.action === "create.follow_up_activity") {
      await db.activity.create({ data: { organizationId, leadId: typeof record.leadId === "string" ? record.leadId : resource === "leads" ? String(record.id) : null, type: `automation.${automation.trigger}`, title: automation.name, body: `Automatically created from ${automation.trigger} for ${resource} ${String(record.title ?? record.name ?? record.company ?? record.number ?? record.id)}.` } });
    }
    await db.$transaction([
      db.automation.update({ where: { id: automation.id }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } }),
      db.auditLog.create({ data: { organizationId, userId: actorId, action: "automation.ran", resource: "automations", resourceId: automation.id, metadata: JSON.stringify({ trigger: automation.trigger, sourceResource: resource, sourceId: record.id }) } }),
    ]);
  }
  return `${automations.length} automation${automations.length === 1 ? "" : "s"} ran.`;
}

export async function runCrudWorkflows(input: { organizationId: string; actorId: string; resource: string; action: CrudAction; record: Record<string, unknown>; changedFields?: string[] }) {
  try {
    const [lifecycle, automations] = await Promise.all([
      runLifecycle({ ...input, changedFields: input.changedFields ?? [] }),
      runConfiguredAutomations(input),
    ]);
    return [lifecycle, automations].filter(Boolean).join(" ") || null;
  } catch (error) {
    console.error(`Workflow processing failed for ${input.resource}`, error);
    return "The record was saved, but a related workflow needs review in the audit log.";
  }
}
