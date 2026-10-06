import "server-only";

import { z } from "zod";

import { db } from "@/lib/db";

type Scope = "organization" | "project" | "invoice";

type CrudSpec = {
  delegate: string;
  scope: Scope;
  schema: z.ZodObject<z.ZodRawShape>;
  fields: string[];
};

type CrudDelegate = {
  findMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
  findFirst: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  count: (args: Record<string, unknown>) => Promise<number>;
  create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  delete: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

const shortText = (max = 191) => z.string().trim().min(1).max(max);
const optionalText = (max = 191) => z.preprocess((value) => value === "" ? null : value, z.string().trim().max(max).nullable().optional());
const optionalId = z.preprocess((value) => value === "" ? null : value, z.string().min(1).max(191).nullable().optional());
const money = z.coerce.number().finite().min(0).max(1_000_000_000);
const percentage = z.coerce.number().int().min(0).max(100);
const optionalDate = z.preprocess(
  (value) => value === "" ? null : value,
  z.union([z.string().date(), z.string().datetime(), z.date(), z.null()]).transform((value) => value ? value instanceof Date ? value : new Date(value) : null).optional(),
);
const requiredDate = z.union([z.string().date(), z.string().datetime(), z.date()]).transform((value) => value instanceof Date ? value : new Date(value));
const optionalDateTime = z.preprocess(
  (value) => value === "" || value === undefined ? null : value,
  z.union([z.null(), z.coerce.date()]).optional(),
);
const requiredDateTime = z.coerce.date();
const optionalSlug = z.preprocess(
  (value) => value === "" ? undefined : value,
  z.string().trim().toLowerCase().min(2).max(191).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only").optional(),
);
const optionalUrl = z.preprocess(
  (value) => value === "" ? null : value,
  z.string().trim().max(4_000).refine((value) => value.startsWith("/") || /^https?:\/\//i.test(value), "Use an absolute http(s) URL or a site-relative path").nullable().optional(),
);
const publicationStatus = z.enum(["Draft", "Published", "Archived"]);
const leadStage = z.enum(["New", "Qualified", "Discovery", "Proposal", "Negotiation", "Won", "Lost"]);
const clientStatus = z.enum(["Active", "Onboarding", "At risk", "Paused", "Inactive"]);
const proposalStatus = z.enum(["Draft", "Internal review", "Sent", "Viewed", "Accepted", "Rejected", "Converted"]);
const contractStatus = z.enum(["Draft", "Legal review", "Sent", "Negotiation", "Signed", "Active", "Expired"]);
const projectStatus = z.enum(["Planning", "In progress", "Review", "Blocked", "Complete", "Archived"]);
const taskStatus = z.enum(["Backlog", "Today", "In progress", "Review", "Done"]);
const taskPriority = z.enum(["Low", "Medium", "High", "Urgent"]);
const invoiceStatus = z.enum(["Draft", "Sent", "Paid", "Overdue", "Void"]);
const contentResources = new Set(["blog-posts", "work-posts", "seo-pages"]);
const reservedPageSlugs = new Set(["app", "api", "auth", "blog", "portal", "register", "robots.txt", "sign-in", "sign-up", "sitemap.xml", "work", "_next"]);
const searchFields: Record<string, string[]> = {
  leads: ["name", "company", "email", "phone", "source", "stage", "ownerName"],
  clients: ["name", "company", "email", "phone", "status"],
  proposals: ["title", "status"],
  contracts: ["title", "status"],
  projects: ["name", "code", "status", "managerName"],
  tasks: ["title", "status", "priority"],
  "calendar-events": ["title", "inviteeName", "inviteeEmail", "inviteeCompany", "status", "source"],
  "time-entries": ["description"],
  invoices: ["number", "status", "currency"],
  expenses: ["category", "vendor", "status"],
  retainers: ["name", "status"],
  documents: ["name", "type"],
  activities: ["type", "title"],
  automations: ["name", "trigger", "action"],
  knowledge: ["title", "tags"],
  "blog-posts": ["title", "slug", "category", "authorName", "status", "metaTitle"],
  "work-posts": ["title", "slug", "clientName", "industry", "status", "metaTitle"],
  "seo-pages": ["title", "slug", "eyebrow", "primaryKeyword", "status", "metaTitle"],
  milestones: ["name", "status"],
  "invoice-items": ["description"],
  payments: ["method", "reference"],
};

function validationMessage(error: z.ZodError) {
  const issue = error.issues[0];
  if (!issue) return "Invalid record details";
  const field = issue.path[0];
  return field ? `${String(field)}: ${issue.message}` : issue.message;
}

const specs: Record<string, CrudSpec> = {
  leads: {
    delegate: "lead",
    scope: "organization",
    schema: z.object({ name: shortText(120), company: shortText(160), email: z.email().max(191), phone: optionalText(40), source: shortText(80), stage: leadStage, value: money, probability: percentage.optional(), score: percentage.optional(), ownerName: optionalText(120), nextActivityAt: optionalDate, notes: optionalText(10_000) }),
    fields: ["name", "company", "email", "phone", "source", "stage", "value", "probability", "score", "ownerName", "nextActivityAt", "notes", "createdAt", "updatedAt"],
  },
  clients: {
    delegate: "client",
    scope: "organization",
    schema: z.object({ name: shortText(120), company: shortText(160), email: z.email().max(191), phone: optionalText(40), status: clientStatus, healthScore: percentage.optional(), lifetimeValue: money.optional(), onboardingProgress: percentage.optional() }),
    fields: ["name", "company", "email", "phone", "status", "healthScore", "lifetimeValue", "onboardingProgress", "createdAt", "updatedAt"],
  },
  proposals: {
    delegate: "proposal",
    scope: "organization",
    schema: z.object({ title: shortText(240), status: proposalStatus, amount: money, leadId: optionalId, clientId: optionalId, validUntil: optionalDate, sentAt: optionalDate, acceptedAt: optionalDate }),
    fields: ["title", "status", "amount", "leadId", "clientId", "validUntil", "sentAt", "acceptedAt", "createdAt", "updatedAt"],
  },
  contracts: {
    delegate: "contract",
    scope: "organization",
    schema: z.object({ title: shortText(240), clientId: shortText(), proposalId: optionalId, status: contractStatus, value: money, startDate: optionalDate, endDate: optionalDate, signedAt: optionalDate }),
    fields: ["title", "clientId", "proposalId", "status", "value", "startDate", "endDate", "signedAt", "createdAt", "updatedAt"],
  },
  projects: {
    delegate: "project",
    scope: "organization",
    schema: z.object({ name: shortText(240), code: shortText(80), clientId: shortText(), status: projectStatus, progress: percentage.optional(), budget: money.optional(), spent: money.optional(), managerName: optionalText(120), startDate: optionalDate, dueDate: optionalDate }),
    fields: ["name", "code", "clientId", "status", "progress", "budget", "spent", "managerName", "startDate", "dueDate", "createdAt", "updatedAt"],
  },
  tasks: {
    delegate: "task",
    scope: "organization",
    schema: z.object({ title: shortText(240), description: optionalText(10_000), projectId: optionalId, assigneeId: optionalId, status: taskStatus, priority: taskPriority, dueDate: optionalDate, estimatedMinutes: z.coerce.number().int().min(0).max(1_000_000).optional(), trackedMinutes: z.coerce.number().int().min(0).max(1_000_000).optional() }),
    fields: ["title", "description", "projectId", "assigneeId", "status", "priority", "dueDate", "estimatedMinutes", "trackedMinutes", "createdAt", "updatedAt"],
  },
  "calendar-events": {
    delegate: "calendarEvent",
    scope: "organization",
    schema: z.object({ title: shortText(191), leadId: optionalId, inviteeName: optionalText(120), inviteeEmail: z.preprocess((value) => value === "" ? null : value, z.email().max(191).nullable().optional()), inviteePhone: optionalText(40), inviteeCompany: optionalText(160), startAt: requiredDateTime, endAt: optionalDateTime, timezone: optionalText(100), location: optionalText(2_000), status: z.enum(["Scheduled", "Completed", "Canceled", "No show"]), cancellationReason: optionalText(2_000), notes: optionalText(10_000) }),
    fields: ["title", "leadId", "bookingTypeId", "source", "bookingReference", "inviteeName", "inviteeEmail", "inviteePhone", "inviteeCompany", "startAt", "endAt", "timezone", "location", "status", "rescheduled", "cancellationReason", "notes", "createdAt", "updatedAt"],
  },
  "time-entries": {
    delegate: "timeEntry",
    scope: "project",
    schema: z.object({ projectId: shortText(), taskId: optionalId, description: optionalText(500), minutes: z.coerce.number().int().min(1).max(100_000), billable: z.boolean().optional(), hourlyRate: money.nullable().optional(), date: requiredDate }),
    fields: ["projectId", "taskId", "userId", "description", "minutes", "billable", "hourlyRate", "date"],
  },
  invoices: {
    delegate: "invoice",
    scope: "organization",
    schema: z.object({ clientId: shortText(), projectId: optionalId, number: shortText(80), status: invoiceStatus, currency: z.enum(["GBP", "USD", "EUR", "BDT"]), subtotal: money, tax: money.optional(), total: money.optional(), issuedAt: optionalDate, dueDate: optionalDate, paidAt: optionalDate }),
    fields: ["clientId", "projectId", "number", "status", "currency", "subtotal", "tax", "total", "issuedAt", "dueDate", "paidAt", "createdAt", "updatedAt"],
  },
  expenses: {
    delegate: "expense",
    scope: "organization",
    schema: z.object({ category: shortText(100), vendor: shortText(160), description: optionalText(5_000), amount: money, status: z.enum(["Pending", "Approved", "Paid", "Rejected"]), incurredAt: requiredDate }),
    fields: ["category", "vendor", "description", "amount", "status", "incurredAt"],
  },
  retainers: {
    delegate: "retainer",
    scope: "organization",
    schema: z.object({ clientId: shortText(), name: shortText(240), status: z.enum(["Active", "Paused", "Ending", "Ended"]), monthlyValue: money, includedHours: z.coerce.number().int().min(0).max(100_000).optional(), renewalDate: optionalDate }),
    fields: ["clientId", "name", "status", "monthlyValue", "includedHours", "renewalDate"],
  },
  documents: {
    delegate: "document",
    scope: "organization",
    schema: z.object({ clientId: optionalId, projectId: optionalId, name: shortText(240), type: shortText(80), url: optionalText(4_000), version: z.coerce.number().int().min(1).max(100_000).optional() }),
    fields: ["clientId", "projectId", "name", "type", "url", "version", "createdAt"],
  },
  activities: {
    delegate: "activity",
    scope: "organization",
    schema: z.object({ leadId: optionalId, type: shortText(100), title: shortText(240), body: optionalText(10_000), occurredAt: optionalDate }),
    fields: ["leadId", "type", "title", "body", "occurredAt"],
  },
  automations: {
    delegate: "automation",
    scope: "organization",
    schema: z.object({ name: shortText(240), trigger: z.enum(["lead.created", "lead.won", "proposal.accepted", "contract.signed", "task.completed", "invoice.overdue", "invoice.paid", "record.created"]), action: z.enum(["notify.owners", "create.follow_up_activity"]), enabled: z.boolean().optional(), runCount: z.coerce.number().int().min(0).max(1_000_000_000).optional(), lastRunAt: optionalDate }),
    fields: ["name", "trigger", "action", "enabled", "runCount", "lastRunAt"],
  },
  knowledge: {
    delegate: "knowledgeItem",
    scope: "organization",
    schema: z.object({ title: shortText(240), content: shortText(100_000), source: optionalText(2_000), tags: optionalText(2_000) }),
    fields: ["title", "content", "source", "tags", "createdAt", "updatedAt"],
  },
  "blog-posts": {
    delegate: "blogPost",
    scope: "organization",
    schema: z.object({ title: shortText(191), slug: optionalSlug, excerpt: optionalText(5_000), content: shortText(200_000), coverImage: optionalUrl, category: shortText(120), authorName: shortText(120), status: publicationStatus, featured: z.boolean().optional(), publishedAt: optionalDate, metaTitle: optionalText(191), metaDescription: optionalText(500), canonicalUrl: optionalUrl, ogImage: optionalUrl }),
    fields: ["title", "slug", "excerpt", "content", "coverImage", "category", "authorName", "status", "featured", "publishedAt", "metaTitle", "metaDescription", "canonicalUrl", "ogImage", "createdAt", "updatedAt"],
  },
  "work-posts": {
    delegate: "workPost",
    scope: "organization",
    schema: z.object({ title: shortText(191), slug: optionalSlug, clientName: optionalText(160), industry: optionalText(120), services: optionalText(2_000), summary: shortText(5_000), challenge: optionalText(100_000), solution: shortText(100_000), results: optionalText(100_000), coverImage: optionalUrl, projectUrl: optionalUrl, status: publicationStatus, featured: z.boolean().optional(), completedAt: optionalDate, publishedAt: optionalDate, metaTitle: optionalText(191), metaDescription: optionalText(500), canonicalUrl: optionalUrl, ogImage: optionalUrl }),
    fields: ["title", "slug", "clientName", "industry", "services", "summary", "challenge", "solution", "results", "coverImage", "projectUrl", "status", "featured", "completedAt", "publishedAt", "metaTitle", "metaDescription", "canonicalUrl", "ogImage", "createdAt", "updatedAt"],
  },
  "seo-pages": {
    delegate: "seoPage",
    scope: "organization",
    schema: z.object({ title: shortText(191), slug: optionalSlug, eyebrow: optionalText(120), summary: shortText(5_000), content: shortText(200_000), heroImage: optionalUrl, primaryKeyword: optionalText(191), status: publicationStatus, noIndex: z.boolean().optional(), publishedAt: optionalDate, metaTitle: optionalText(191), metaDescription: optionalText(500), canonicalUrl: optionalUrl, ogImage: optionalUrl }),
    fields: ["title", "slug", "eyebrow", "summary", "content", "heroImage", "primaryKeyword", "status", "noIndex", "publishedAt", "metaTitle", "metaDescription", "canonicalUrl", "ogImage", "createdAt", "updatedAt"],
  },
  milestones: {
    delegate: "milestone",
    scope: "project",
    schema: z.object({ projectId: shortText(), name: shortText(240), status: z.enum(["Upcoming", "In progress", "Review", "Complete", "Blocked"]), progress: percentage.optional(), dueDate: optionalDate }),
    fields: ["projectId", "name", "status", "progress", "dueDate"],
  },
  "invoice-items": {
    delegate: "invoiceItem",
    scope: "invoice",
    schema: z.object({ invoiceId: shortText(), description: shortText(1_000), quantity: z.coerce.number().positive().max(1_000_000), unitPrice: money, total: money.optional() }),
    fields: ["invoiceId", "description", "quantity", "unitPrice", "total"],
  },
  payments: {
    delegate: "payment",
    scope: "invoice",
    schema: z.object({ invoiceId: shortText(), amount: money, method: optionalText(100), reference: optionalText(240), processedAt: optionalDate }),
    fields: ["invoiceId", "amount", "method", "reference", "processedAt"],
  },
};

function getSpec(resource: string) {
  return specs[resource] ?? null;
}

function getDelegate(spec: CrudSpec) {
  return (db as unknown as Record<string, CrudDelegate>)[spec.delegate];
}

function selectFields(spec: CrudSpec) {
  return Object.fromEntries(["id", ...spec.fields].map((field) => [field, true]));
}

function ownershipWhere(spec: CrudSpec, organizationId: string, id?: string) {
  if (spec.scope === "organization") return { ...(id ? { id } : {}), organizationId };
  if (spec.scope === "project") return { ...(id ? { id } : {}), project: { organizationId } };
  return { ...(id ? { id } : {}), invoice: { organizationId } };
}

async function validateRelations(data: Record<string, unknown>, organizationId: string) {
  const checks: Array<Promise<number>> = [];
  const labels: string[] = [];

  const add = (key: string, query: Promise<number>) => {
    if (!data[key]) return;
    labels.push(key);
    checks.push(query);
  };

  add("clientId", db.client.count({ where: { id: String(data.clientId), organizationId } }));
  add("projectId", db.project.count({ where: { id: String(data.projectId), organizationId } }));
  add("leadId", db.lead.count({ where: { id: String(data.leadId), organizationId } }));
  add("proposalId", db.proposal.count({ where: { id: String(data.proposalId), organizationId } }));
  add("taskId", db.task.count({ where: { id: String(data.taskId), organizationId } }));
  add("invoiceId", db.invoice.count({ where: { id: String(data.invoiceId), organizationId } }));
  add("assigneeId", db.member.count({ where: { userId: String(data.assigneeId), organizationId } }));

  const results = await Promise.all(checks);
  const invalidIndex = results.findIndex((count) => count === 0);
  if (invalidIndex >= 0) throw new Error(`Invalid organization relationship: ${labels[invalidIndex]}`);
  if (data.taskId && data.projectId) {
    const matches = await db.task.count({ where: { id: String(data.taskId), organizationId, projectId: String(data.projectId) } });
    if (!matches) throw new Error("taskId: The selected task does not belong to the selected project.");
  }
  if (data.clientId && data.projectId) {
    const matches = await db.project.count({ where: { id: String(data.projectId), organizationId, clientId: String(data.clientId) } });
    if (!matches) throw new Error("projectId: The selected project does not belong to the selected client.");
  }
}

function normalizeRecord(record: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => {
    if (value instanceof Date) return [key, value.toISOString()];
    if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") return [key, value.toNumber()];
    return [key, value];
  }));
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 191);
}

function prepareContentData(
  resource: string,
  data: Record<string, unknown>,
  options: { creating: boolean; existingPublishedAt?: unknown },
) {
  if (!contentResources.has(resource)) return;

  if (options.creating && !data.slug && typeof data.title === "string") data.slug = slugify(data.title);
  if (!data.slug && options.creating) throw new Error("The title must produce a valid URL slug.");
  if (resource === "seo-pages" && typeof data.slug === "string" && reservedPageSlugs.has(data.slug)) {
    throw new Error("That page slug is reserved by the website. Choose a different URL slug.");
  }
  if (data.status === "Published" && !data.publishedAt && !options.existingPublishedAt) data.publishedAt = new Date();
}

function prepareCalendarData(
  resource: string,
  data: Record<string, unknown>,
  options: { creating: boolean; existingStartAt?: unknown; existingEndAt?: unknown },
) {
  if (resource !== "calendar-events") return;
  if (options.creating && data.startAt instanceof Date && !data.endAt) {
    data.endAt = new Date(data.startAt.getTime() + 30 * 60 * 1_000);
  }
  const startAt = data.startAt instanceof Date ? data.startAt : options.existingStartAt;
  const endAt = data.endAt instanceof Date ? data.endAt : data.endAt === null ? null : options.existingEndAt;
  if (startAt instanceof Date && endAt instanceof Date && endAt <= startAt) {
    throw new Error("endAt: The end time must be later than the start time.");
  }
}

function numeric(value: unknown) {
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") return value.toNumber();
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function selected(data: Record<string, unknown>, existing: Record<string, unknown>, key: string) {
  return key in data ? data[key] : existing[key];
}

function validateDateOrder(data: Record<string, unknown>, existing: Record<string, unknown>, startKey: string, endKey: string) {
  const start = selected(data, existing, startKey);
  const end = selected(data, existing, endKey);
  if (start instanceof Date && end instanceof Date && end < start) throw new Error(`${endKey}: Must be on or after ${startKey}.`);
}

function prepareOperationalData(resource: string, data: Record<string, unknown>, existing: Record<string, unknown> = {}) {
  if (resource === "proposals") {
    if (["Sent", "Viewed", "Accepted", "Converted"].includes(String(data.status)) && !selected(data, existing, "sentAt")) data.sentAt = new Date();
    if (["Accepted", "Converted"].includes(String(data.status)) && !selected(data, existing, "acceptedAt")) data.acceptedAt = new Date();
    validateDateOrder(data, existing, "sentAt", "validUntil");
  }
  if (resource === "contracts") {
    if (["Signed", "Active"].includes(String(data.status)) && !selected(data, existing, "signedAt")) data.signedAt = new Date();
    validateDateOrder(data, existing, "startDate", "endDate");
  }
  if (resource === "projects") {
    if (data.status === "Complete") data.progress = 100;
    validateDateOrder(data, existing, "startDate", "dueDate");
  }
  if (resource === "milestones" && data.status === "Complete") data.progress = 100;
  if (resource === "invoices") {
    if (["Sent", "Overdue", "Paid"].includes(String(data.status)) && !selected(data, existing, "issuedAt")) data.issuedAt = new Date();
    if (data.status === "Paid" && !selected(data, existing, "paidAt")) data.paidAt = new Date();
    const subtotal = numeric(selected(data, existing, "subtotal"));
    const tax = numeric(selected(data, existing, "tax"));
    data.total = Math.round((subtotal + tax) * 100) / 100;
    validateDateOrder(data, existing, "issuedAt", "dueDate");
  }
  if (resource === "invoice-items") {
    data.total = Math.round(numeric(selected(data, existing, "quantity")) * numeric(selected(data, existing, "unitPrice")) * 100) / 100;
  }
}

export function supportsCrudResource(resource: string) {
  return Boolean(getSpec(resource));
}

export async function listCrudRecords(
  resource: string,
  organizationId: string,
  options: { limit?: number; cursor?: string | null; query?: string | null; lookup?: boolean } = {},
) {
  const spec = getSpec(resource);
  if (!spec) throw new Error("Unsupported resource");
  const limit = Math.min(100, Math.max(10, options.limit ?? 50));
  const query = options.query?.trim().slice(0, 120) || "";
  const lookupFields = spec.fields.filter((field) => ["name", "title", "company", "number", "description"].includes(field));
  const fields = options.lookup ? lookupFields : searchFields[resource] ?? [];
  const owned = ownershipWhere(spec, organizationId);
  const where = query && fields.length
    ? { AND: [owned, { OR: fields.map((field) => ({ [field]: { contains: query } })) }] }
    : owned;
  const orderBy = contentResources.has(resource)
    ? [{ updatedAt: "desc" }, { id: "desc" }]
    : resource === "calendar-events"
      ? [{ startAt: "asc" }, { id: "asc" }]
      : [{ id: "desc" }];
  const delegate = getDelegate(spec);
  const [records, total] = await Promise.all([delegate.findMany({
    where,
    select: options.lookup ? Object.fromEntries(["id", ...lookupFields].map((field) => [field, true])) : selectFields(spec),
    orderBy,
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  }), delegate.count({ where })]);
  const hasMore = records.length > limit;
  const pageRecords = hasMore ? records.slice(0, limit) : records;
  let normalized = pageRecords.map(normalizeRecord);
  if (["invoice-items", "payments"].includes(resource)) {
    const invoiceIds = normalized.map((record) => String(record.invoiceId)).filter(Boolean);
    const invoices = await db.invoice.findMany({ where: { id: { in: invoiceIds }, organizationId }, select: { id: true, currency: true } });
    const currencies = new Map(invoices.map((invoice) => [invoice.id, invoice.currency]));
    normalized = normalized.map((record) => ({ ...record, currency: currencies.get(String(record.invoiceId)) ?? "USD" }));
  }
  return {
    records: normalized,
    page: {
      limit,
      total,
      hasMore,
      nextCursor: hasMore ? String(pageRecords.at(-1)?.id ?? "") || null : null,
    },
  };
}

export async function createCrudRecord(resource: string, organizationId: string, userId: string, input: unknown) {
  const spec = getSpec(resource);
  if (!spec) throw new Error("Unsupported resource");
  const parsed = spec.schema.safeParse(input);
  if (!parsed.success) throw new Error(validationMessage(parsed.error));
  const data: Record<string, unknown> = { ...parsed.data };
  prepareContentData(resource, data, { creating: true });
  prepareCalendarData(resource, data, { creating: true });
  prepareOperationalData(resource, data);
  if (resource === "activities" && data.occurredAt === null) delete data.occurredAt;
  if (resource === "payments" && data.processedAt === null) delete data.processedAt;
  await validateRelations(data, organizationId);
  if (spec.scope === "organization") data.organizationId = organizationId;
  if (resource === "time-entries") data.userId = userId;
  const record = await getDelegate(spec).create({ data, select: selectFields(spec) });
  return normalizeRecord(record);
}

export async function updateCrudRecord(resource: string, id: string, organizationId: string, input: unknown) {
  const spec = getSpec(resource);
  if (!spec) throw new Error("Unsupported resource");
  const existing = await getDelegate(spec).findFirst({
    where: ownershipWhere(spec, organizationId, id),
    select: selectFields(spec),
  });
  if (!existing) return null;
  const parsed = spec.schema.partial().safeParse(input);
  if (!parsed.success || Object.keys(parsed.data).length === 0) throw new Error(parsed.success ? "No changes supplied" : validationMessage(parsed.error));
  const data = { ...parsed.data } as Record<string, unknown>;
  prepareContentData(resource, data, { creating: false, existingPublishedAt: existing.publishedAt });
  prepareCalendarData(resource, data, { creating: false, existingStartAt: existing.startAt, existingEndAt: existing.endAt });
  prepareOperationalData(resource, data, existing);
  await validateRelations({ ...existing, ...data }, organizationId);
  const record = await getDelegate(spec).update({ where: { id }, data, select: selectFields(spec) });
  const normalized = normalizeRecord(record);
  if (resource === "time-entries" && existing.taskId !== record.taskId) normalized.__previousTaskId = existing.taskId;
  if (["invoice-items", "payments"].includes(resource) && existing.invoiceId !== record.invoiceId) normalized.__previousInvoiceId = existing.invoiceId;
  if (resource === "milestones" && existing.projectId !== record.projectId) normalized.__previousProjectId = existing.projectId;
  return normalized;
}

export async function deleteCrudRecord(resource: string, id: string, organizationId: string) {
  const spec = getSpec(resource);
  if (!spec) throw new Error("Unsupported resource");
  const existing = await getDelegate(spec).findFirst({
    where: ownershipWhere(spec, organizationId, id),
    select: selectFields(spec),
  });
  if (!existing) return null;
  if (resource === "clients") {
    const [contracts, projects, invoices, retainers] = await Promise.all([
      db.contract.count({ where: { clientId: id, organizationId } }),
      db.project.count({ where: { clientId: id, organizationId } }),
      db.invoice.count({ where: { clientId: id, organizationId } }),
      db.retainer.count({ where: { clientId: id, organizationId } }),
    ]);
    const connected = contracts + projects + invoices + retainers;
    if (connected) throw new Error(`This client has ${connected} connected commercial or delivery record${connected === 1 ? "" : "s"}. Archive the client or remove those records first.`);
  }
  if (resource === "projects") {
    const [milestones, tasks, timeEntries] = await Promise.all([
      db.milestone.count({ where: { projectId: id } }),
      db.task.count({ where: { projectId: id, organizationId } }),
      db.timeEntry.count({ where: { projectId: id, project: { organizationId } } }),
    ]);
    const connected = milestones + tasks + timeEntries;
    if (connected) throw new Error(`This project has ${connected} connected milestone, task, or time record${connected === 1 ? "" : "s"}. Archive the project instead of deleting its history.`);
  }
  if (resource === "invoices") {
    const [items, payments] = await Promise.all([
      db.invoiceItem.count({ where: { invoiceId: id, invoice: { organizationId } } }),
      db.payment.count({ where: { invoiceId: id, invoice: { organizationId } } }),
    ]);
    const connected = items + payments;
    if (connected) throw new Error(`This invoice has ${connected} connected line item or payment record${connected === 1 ? "" : "s"}. Void the invoice to preserve its financial history.`);
  }
  await getDelegate(spec).delete({ where: { id } });
  return normalizeRecord(existing);
}

export async function reconcileCrudRelations(resource: string, record: Record<string, unknown>, organizationId: string) {
  try {
    if (resource === "time-entries" && (record.taskId || record.__previousTaskId)) {
      const taskIds = Array.from(new Set([record.taskId, record.__previousTaskId].filter(Boolean).map(String)));
      for (const taskId of taskIds) {
        const task = await db.task.findFirst({ where: { id: taskId, organizationId }, select: { id: true } });
        if (!task) continue;
        const tracked = await db.timeEntry.aggregate({ where: { taskId, project: { organizationId } }, _sum: { minutes: true } });
        await db.task.update({ where: { id: taskId }, data: { trackedMinutes: tracked._sum.minutes ?? 0 } });
      }
      return "Task tracked time was recalculated.";
    }

    if (resource === "milestones" && record.projectId) {
      const projectIds = Array.from(new Set([record.projectId, record.__previousProjectId].filter(Boolean).map(String)));
      for (const projectId of projectIds) {
        const project = await db.project.findFirst({ where: { id: projectId, organizationId }, select: { id: true } });
        if (!project) continue;
        const aggregate = await db.milestone.aggregate({ where: { projectId }, _avg: { progress: true } });
        await db.project.update({ where: { id: projectId }, data: { progress: aggregate._avg.progress === null ? 0 : Math.round(aggregate._avg.progress) } });
      }
      return "Project progress was recalculated from its milestones.";
    }

    if (resource === "invoice-items" && record.invoiceId) {
      const invoiceIds = Array.from(new Set([record.invoiceId, record.__previousInvoiceId].filter(Boolean).map(String)));
      for (const invoiceId of invoiceIds) {
        const invoice = await db.invoice.findFirst({ where: { id: invoiceId, organizationId }, select: { id: true, tax: true } });
        if (!invoice) continue;
        const aggregate = await db.invoiceItem.aggregate({ where: { invoiceId }, _sum: { total: true } });
        const subtotal = numeric(aggregate._sum.total);
        await db.invoice.update({ where: { id: invoiceId }, data: { subtotal, total: Math.round((subtotal + numeric(invoice.tax)) * 100) / 100 } });
      }
      // Reconcile payment status below after changing the amount due.
    }

    if (["payments", "invoice-items"].includes(resource) && record.invoiceId) {
      const invoiceIds = Array.from(new Set([record.invoiceId, record.__previousInvoiceId].filter(Boolean).map(String)));
      let anyFullyPaid = false;
      for (const invoiceId of invoiceIds) {
        const invoice = await db.invoice.findFirst({ where: { id: invoiceId, organizationId }, select: { id: true, total: true, status: true } });
        if (!invoice) continue;
        const aggregate = await db.payment.aggregate({ where: { invoiceId }, _sum: { amount: true } });
        const paid = numeric(aggregate._sum.amount);
        const fullyPaid = paid >= numeric(invoice.total) && numeric(invoice.total) > 0;
        anyFullyPaid ||= fullyPaid;
        if (fullyPaid && invoice.status !== "Void") await db.invoice.update({ where: { id: invoiceId }, data: { status: "Paid", paidAt: new Date() } });
        else if (!fullyPaid && invoice.status === "Paid") await db.invoice.update({ where: { id: invoiceId }, data: { status: "Sent", paidAt: null } });
      }
      return anyFullyPaid ? "The invoice was marked paid from recorded payments." : "Invoice payment balance was recalculated.";
    }
  } catch (error) {
    console.error(`Failed to reconcile ${resource}`, error);
  }
  return null;
}
