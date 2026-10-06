import { z } from "zod";
import { readRequestBytes, RequestBodyTooLargeError } from "@/lib/request-body";

import { createCrudRecord, deleteCrudRecord, listCrudRecords, reconcileCrudRelations, supportsCrudResource, updateCrudRecord } from "@/lib/crud-server";
import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/dal";
import { notifyCrudMutation } from "@/lib/notifications";
import { runCrudWorkflows } from "@/lib/workflow-engine";
import { canReadResource, canWriteResource } from "@/lib/permissions";

const mutationSchema = z.object({
  id: z.string().min(1).max(191).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  records: z.array(z.record(z.string(), z.unknown())).min(1).max(50).optional(),
});
const maximumRequestBytes = 8 * 1024 * 1024;


export const maxDuration = 60;

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "The record could not be saved.";
  if (error instanceof RequestBodyTooLargeError) return { message, status: 413 };
  const conflict = /unique|duplicate/i.test(message);
  const related = /foreign key|constraint/i.test(message);
  const safeMessage = conflict
    ? "A record with these unique details already exists."
    : related
      ? "This record is still connected to other agency data and cannot be changed that way."
      : /prisma|database|query/i.test(message)
        ? "The database could not complete this operation."
        : message;
  return { message: safeMessage, status: conflict ? 409 : 400 };
}

function errorResponse(error: unknown) {
  const safe = safeErrorMessage(error);
  return Response.json({ error: safe.message }, { status: safe.status });
}

async function requestBody(request: Request) {
  const source = new TextDecoder().decode(await readRequestBytes(request, maximumRequestBytes));
  try {
    return JSON.parse(source) as unknown;
  } catch {
    return null;
  }
}

async function contextFor(request: Request, context: RouteContext<"/api/crud/[resource]">) {
  const session = await requireApiSession(request);
  if (!session) return { response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const { resource } = await context.params;
  if (!supportsCrudResource(resource)) return { response: Response.json({ error: "Unsupported resource" }, { status: 404 }) };
  const leadLookup = request.method === "GET" && new URL(request.url).searchParams.get("lookup") === "1" && resource === "leads" && session.role === "member";
  if (!canReadResource(session.role, resource) && !leadLookup) return { response: Response.json({ error: "Your workspace role cannot access this business area." }, { status: 403 }) };
  return { session, resource };
}

export async function GET(request: Request, context: RouteContext<"/api/crud/[resource]">) {
  const resolved = await contextFor(request, context);
  if ("response" in resolved) return resolved.response;
  try {
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get("limit") || 50);
    const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(10, Math.floor(requestedLimit))) : 50;
    const result = await listCrudRecords(resolved.resource, resolved.session.organizationId, {
      limit,
      cursor: url.searchParams.get("cursor"),
      query: url.searchParams.get("q"),
      lookup: url.searchParams.get("lookup") === "1",
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

async function createWithEffects(
  resource: string,
  session: { organizationId: string; userId: string },
  data: Record<string, unknown>,
) {
  const record = await createCrudRecord(resource, session.organizationId, session.userId, data);
  const reconciliation = await reconcileCrudRelations(resource, record, session.organizationId);
  await db.auditLog.create({ data: { organizationId: session.organizationId, userId: session.userId, action: `${resource}.created`, resource, resourceId: String(record.id) } });
  await notifyCrudMutation({ organizationId: session.organizationId, actorId: session.userId, resource, action: "created", record });
  const workflow = await runCrudWorkflows({ organizationId: session.organizationId, actorId: session.userId, resource, action: "created", record, changedFields: Object.keys(data) });
  return { record, workflow: [reconciliation, workflow].filter(Boolean).join(" ") || null };
}

export async function POST(request: Request, context: RouteContext<"/api/crud/[resource]">) {
  const resolved = await contextFor(request, context);
  if ("response" in resolved) return resolved.response;
  if (!canWriteResource(resolved.session.role, resolved.resource)) return Response.json({ error: "Your workspace role cannot change this business area." }, { status: 403 });
  const resource = resolved.resource;
  const session = resolved.session;
  try {
    const parsed = mutationSchema.safeParse(await requestBody(request));
    if (!parsed.success || (!parsed.data.data && !parsed.data.records)) return Response.json({ error: "Invalid request body" }, { status: 400 });
    if (parsed.data.records) {
      const records = parsed.data.records;
      const results: Array<{ index: number; record?: Record<string, unknown>; error?: string }> = new Array(records.length);
      let cursor = 0;
      async function work() {
        while (cursor < records.length) {
          const index = cursor++;
          try {
            const created = await createWithEffects(resource, session, records[index]!);
            results[index] = { index, record: created.record };
          } catch (error) {
            results[index] = { index, error: safeErrorMessage(error).message };
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, records.length) }, () => work()));
      const created = results.filter((result) => result.record).map((result) => result.record!);
      const failures = results.filter((result) => result.error).map(({ index, error }) => ({ index, error }));
      return Response.json({ records: created, failures }, { status: failures.length ? 207 : 201 });
    }
    const created = await createWithEffects(resource, session, parsed.data.data!);
    return Response.json(created, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext<"/api/crud/[resource]">) {
  const resolved = await contextFor(request, context);
  if ("response" in resolved) return resolved.response;
  if (!canWriteResource(resolved.session.role, resolved.resource)) return Response.json({ error: "Your workspace role cannot change this business area." }, { status: 403 });
  try {
    const parsed = mutationSchema.safeParse(await requestBody(request));
    if (!parsed.success || !parsed.data.id || !parsed.data.data) return Response.json({ error: "Invalid request body" }, { status: 400 });
    const record = await updateCrudRecord(resolved.resource, parsed.data.id, resolved.session.organizationId, parsed.data.data);
    if (!record) return Response.json({ error: "Record not found" }, { status: 404 });
    const reconciliation = await reconcileCrudRelations(resolved.resource, record, resolved.session.organizationId);
    await db.auditLog.create({ data: { organizationId: resolved.session.organizationId, userId: resolved.session.userId, action: `${resolved.resource}.updated`, resource: resolved.resource, resourceId: parsed.data.id } });
    await notifyCrudMutation({ organizationId: resolved.session.organizationId, actorId: resolved.session.userId, resource: resolved.resource, action: "updated", record, changedFields: Object.keys(parsed.data.data) });
    const workflow = await runCrudWorkflows({ organizationId: resolved.session.organizationId, actorId: resolved.session.userId, resource: resolved.resource, action: "updated", record, changedFields: Object.keys(parsed.data.data) });
    return Response.json({ record, workflow: [reconciliation, workflow].filter(Boolean).join(" ") || null });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext<"/api/crud/[resource]">) {
  const resolved = await contextFor(request, context);
  if ("response" in resolved) return resolved.response;
  if (!["owner", "admin"].includes(resolved.session.role)) return Response.json({ error: "Only owners and administrators can delete records." }, { status: 403 });
  try {
    const parsed = mutationSchema.safeParse(await requestBody(request));
    if (!parsed.success || !parsed.data.id) return Response.json({ error: "Invalid request body" }, { status: 400 });
    const deleted = await deleteCrudRecord(resolved.resource, parsed.data.id, resolved.session.organizationId);
    if (!deleted) return Response.json({ error: "Record not found" }, { status: 404 });
    await reconcileCrudRelations(resolved.resource, deleted, resolved.session.organizationId);
    await db.auditLog.create({ data: { organizationId: resolved.session.organizationId, userId: resolved.session.userId, action: `${resolved.resource}.deleted`, resource: resolved.resource, resourceId: parsed.data.id } });
    await notifyCrudMutation({ organizationId: resolved.session.organizationId, actorId: resolved.session.userId, resource: resolved.resource, action: "deleted", record: deleted });
    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
