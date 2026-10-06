import "server-only";

import { cache } from "react";
import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const authoritativeSessionQuery = { disableCookieCache: true } as const;

function dbNumber(value: unknown) {
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") return value.toNumber();
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

type PipelineRow = { stage: string; count: bigint | number; value: unknown; weighted: unknown; probabilitySum: unknown };
type MonthRow = { monthKey: string; total: unknown };

export function hasTrustedMutationOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  const trustedOrigins = new Set([new URL(request.url).origin]);
  if (process.env.BETTER_AUTH_URL) {
    try {
      trustedOrigins.add(new URL(process.env.BETTER_AUTH_URL).origin);
    } catch {
      return false;
    }
  }

  return trustedOrigins.has(origin);
}

export async function getAuthSessionFromHeaders(headers: Headers) {
  return auth.api.getSession({
    headers,
    query: authoritativeSessionQuery,
  });
}

export async function getCurrentAuthSession() {
  return getAuthSessionFromHeaders(await nextHeaders());
}

export const verifySession = cache(async () => {
  const session = await getCurrentAuthSession();
  if (!session?.user?.id) redirect("/sign-in");

  return {
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
    activeOrganizationId: session.session.activeOrganizationId,
  };
});

export const getWorkspaceContext = cache(async () => {
  const session = await verifySession();

  const activeMembership = session.activeOrganizationId
    ? await db.member.findFirst({
        where: {
          userId: session.userId,
          organizationId: session.activeOrganizationId,
        },
        select: {
          role: true,
          organization: { select: { id: true, name: true, slug: true } },
        },
      })
    : null;

  const membership = activeMembership ?? await db.member.findFirst({
    where: { userId: session.userId },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      organization: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!membership) {
    const customerLead = await db.lead.findFirst({
      where: { userId: session.userId },
      orderBy: { createdAt: "asc" },
      select: { organization: { select: { id: true, name: true, slug: true } } },
    });
    if (!customerLead) redirect("/register?step=profile");
    return {
      user: { id: session.userId, name: session.name, email: session.email, image: session.image },
      organization: customerLead.organization,
      role: "customer",
    };
  }

  if (!["owner", "admin", "member"].includes(membership.role)) redirect("/sign-in");

  return {
    user: {
      id: session.userId,
      name: session.name,
      email: session.email,
      image: session.image,
    },
    organization: membership.organization,
    role: membership.role,
  };
});

export const getCustomerDashboardData = cache(async (userId: string) => {
  const context = await getWorkspaceContext();
  if (context.role !== "customer" || context.user.id !== userId) redirect("/app");
  const organizationId = context.organization.id;
  const invoiceScope = { organizationId, client: { userId, user: { emailVerified: true } } };
  const projectScope = { organizationId, client: { userId, user: { emailVerified: true } }, status: { notIn: ["Complete", "Archived"] } };
  const [requests, pipeline, projects, activeProjects, paid, outstanding] = await Promise.all([
    db.lead.findMany({ where: { userId, organizationId }, orderBy: { createdAt: "desc" }, take: 4, select: { id: true, company: true, stage: true } }),
    db.lead.groupBy({ by: ["stage"], where: { userId, organizationId }, _sum: { value: true }, _count: { _all: true } }),
    db.project.findMany({ where: projectScope, orderBy: { updatedAt: "desc" }, take: 8, select: { id: true, name: true, code: true, status: true, progress: true, budget: true, spent: true, dueDate: true, client: { select: { company: true } } } }),
    db.project.count({ where: projectScope }),
    db.invoice.aggregate({ where: { ...invoiceScope, status: "Paid" }, _sum: { total: true } }),
    db.invoice.aggregate({ where: { ...invoiceScope, status: { in: ["Sent", "Overdue"] } }, _sum: { total: true } }),
  ]);
  return {
    asOf: new Date().toISOString(),
    metrics: { weightedPipeline: pipeline.reduce((sum, stage) => sum + Number(stage._sum.value ?? 0), 0), paidRevenue: Number(paid._sum.total ?? 0), receivables: Number(outstanding._sum.total ?? 0), grossMargin: 0, activeClients: 0, activeProjects },
    pipelineByStage: pipeline.map((stage) => ({ stage: stage.stage, count: stage._count._all, value: Number(stage._sum.value ?? 0) })),
    revenueSeries: [],
    signals: requests.map((request) => ({ title: `${request.company} · ${request.id.slice(-6)}`, message: `Request status: ${request.stage}.`, href: "/app", tone: "neutral" })),
    projects: projects.map((project) => ({ ...project, budget: Number(project.budget), spent: Number(project.spent), dueDate: project.dueDate?.toISOString() ?? null })),
    tasks: [],
  };
});

export async function requireApiSession(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return null;

  const session = await getAuthSessionFromHeaders(request.headers);
  if (!session?.user?.id) return null;

  const activeMembership = session.session.activeOrganizationId
    ? await db.member.findFirst({
        where: {
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
        },
        select: { organizationId: true, role: true },
      })
    : null;

  const membership = activeMembership ?? await db.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true, role: true },
  });

  if (!membership || !["owner", "admin", "member"].includes(membership.role)) return null;
  return {
    userId: session.user.id,
    organizationId: membership.organizationId,
    role: membership.role,
  };
}

async function getMemberDashboardData(organizationId: string) {
  const [projects, tasks, activeProjects, activeClients] = await Promise.all([
    db.project.findMany({ where: { organizationId, status: { notIn: ["Complete", "Archived"] } }, take: 8, orderBy: { dueDate: "asc" }, select: { id: true, name: true, code: true, status: true, progress: true, budget: true, spent: true, dueDate: true, client: { select: { company: true } } } }),
    db.task.findMany({ where: { organizationId, status: { not: "Done" } }, take: 20, orderBy: { dueDate: "asc" }, select: { id: true, title: true, priority: true, status: true, dueDate: true, project: { select: { code: true } } } }),
    db.project.count({ where: { organizationId, status: { notIn: ["Complete", "Archived"] } } }),
    db.client.count({ where: { organizationId, status: "Active" } }),
  ]);
  return {
    asOf: new Date().toISOString(),
    metrics: { weightedPipeline: 0, paidRevenue: 0, receivables: 0, grossMargin: 0, activeClients, activeProjects },
    pipelineByStage: [], revenueSeries: [],
    signals: [{ title: "Delivery priorities", message: `${activeProjects} active projects. Review open tasks and upcoming deadlines.`, href: "/app/tasks", tone: "accent" }],
    projects: projects.map((project) => ({ ...project, budget: Number(project.budget), spent: Number(project.spent), dueDate: project.dueDate?.toISOString() ?? null })),
    tasks: tasks.map((task) => ({ ...task, dueDate: task.dueDate?.toISOString() ?? null })),
  };
}

export const getDashboardData = cache(async () => {
  const { organization, role } = await getWorkspaceContext();
  const organizationId = organization.id;
  if (role === "member") return getMemberDashboardData(organizationId);
  const now = new Date();
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

  const [pipelineRows, clients, activeProjects, projects, tasks, invoiceRows, expenseTotals, revenueRows, topLeadRows] = await Promise.all([
    db.$queryRaw<PipelineRow[]>(Prisma.sql`
      SELECT stage, COUNT(*) AS count, COALESCE(SUM(value), 0) AS value,
        COALESCE(SUM(value * probability / 100), 0) AS weighted,
        COALESCE(SUM(probability), 0) AS probabilitySum
      FROM \`Lead\` WHERE organizationId = ${organizationId} GROUP BY stage
    `),
    db.client.count({ where: { organizationId, status: "Active" } }),
    db.project.count({ where: { organizationId, status: { notIn: ["Complete", "Archived"] } } }),
    db.project.findMany({
      where: { organizationId, status: { notIn: ["Complete", "Archived"] } },
      orderBy: { dueDate: "asc" },
      take: 4,
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        progress: true,
        budget: true,
        spent: true,
        dueDate: true,
        client: { select: { company: true } },
      },
    }),
    db.task.findMany({
      where: { organizationId, status: { not: "Done" } },
      orderBy: [{ dueDate: "asc" }, { priority: "asc" }],
      take: 5,
      select: {
        id: true,
        title: true,
        priority: true,
        status: true,
        dueDate: true,
        project: { select: { code: true } },
      },
    }),
    db.$queryRaw<Array<{ paidRevenue: unknown; receivables: unknown }>>(Prisma.sql`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'Paid' THEN total ELSE 0 END), 0) AS paidRevenue,
        COALESCE(SUM(CASE WHEN status IN ('Sent', 'Overdue') THEN total ELSE 0 END), 0) AS receivables
      FROM Invoice WHERE organizationId = ${organizationId}
    `),
    db.expense.aggregate({ where: { organizationId }, _sum: { amount: true } }),
    db.$queryRaw<MonthRow[]>(Prisma.sql`
      SELECT DATE_FORMAT(paidAt, '%Y-%m') AS monthKey, COALESCE(SUM(total), 0) AS total
      FROM Invoice
      WHERE organizationId = ${organizationId} AND status = 'Paid' AND paidAt >= ${sixMonthsAgo}
      GROUP BY DATE_FORMAT(paidAt, '%Y-%m')
    `),
    db.$queryRaw<Array<{ company: string; value: unknown; probability: number }>>(Prisma.sql`
      SELECT company, value, probability FROM \`Lead\`
      WHERE organizationId = ${organizationId} AND stage NOT IN ('Won', 'Lost')
      ORDER BY (value * probability) DESC LIMIT 1
    `),
  ]);

  const weightedPipeline = pipelineRows.reduce((total, row) => total + dbNumber(row.weighted), 0);
  const paidRevenue = dbNumber(invoiceRows[0]?.paidRevenue);
  const receivables = dbNumber(invoiceRows[0]?.receivables);
  const operatingCosts = dbNumber(expenseTotals._sum.amount);
  const grossMargin = paidRevenue
    ? Math.max(0, ((paidRevenue - operatingCosts) / paidRevenue) * 100)
    : 0;

  const pipelineMap = new Map(pipelineRows.map((row) => [row.stage, row]));
  const pipelineByStage = ["New", "Qualified", "Discovery", "Proposal", "Negotiation"].map((stage) => ({
    stage,
    count: Number(pipelineMap.get(stage)?.count ?? 0),
    value: dbNumber(pipelineMap.get(stage)?.value),
  }));

  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1));
    return { key: date.toISOString().slice(0, 7), month: new Intl.DateTimeFormat("en", { month: "short" }).format(date), revenue: 0 };
  });
  const monthMap = new Map(months.map((month) => [month.key, month]));
  revenueRows.forEach((row) => {
    const month = monthMap.get(row.monthKey);
    if (month) month.revenue = dbNumber(row.total);
  });
  const maxRevenue = Math.max(1, ...months.map((month) => month.revenue));
  const topLead = topLeadRows[0] ?? null;
  const riskyProject = [...projects].sort((a, b) => {
    const aVariance = (Number(a.budget) ? Number(a.spent) / Number(a.budget) * 100 : 0) - a.progress;
    const bVariance = (Number(b.budget) ? Number(b.spent) / Number(b.budget) * 100 : 0) - b.progress;
    return bVariance - aVariance;
  })[0] ?? null;

  return {
    asOf: now.toISOString(),
    metrics: {
      weightedPipeline,
      paidRevenue,
      receivables,
      grossMargin,
      activeClients: clients,
      activeProjects,
    },
    revenueSeries: months.map((month) => ({ month: month.month, revenue: month.revenue / 1_000, target: maxRevenue / 1_000 })),
    signals: [
      topLead ? { title: "Highest-value next move", message: `${topLead.company} carries ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(topLead.value))} at ${topLead.probability}% probability.`, href: "/app/leads", tone: "accent" } : { title: "Pipeline ready", message: "Add and qualify leads to generate a revenue priority.", href: "/app/leads", tone: "accent" },
      riskyProject ? { title: "Delivery watch", message: `${riskyProject.client.company} / ${riskyProject.name} is at ${riskyProject.progress}% progress and ${Number(riskyProject.budget) ? Math.round(Number(riskyProject.spent) / Number(riskyProject.budget) * 100) : 0}% budget burn.`, href: "/app/projects", tone: "warning" } : { title: "Delivery ready", message: "No active project evidence is available yet.", href: "/app/projects", tone: "warning" },
      { title: "Cash visibility", message: `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(receivables)} is currently sent or overdue.`, href: "/app/finance", tone: "cash" },
    ],
    pipelineByStage,
    projects: projects.map((project) => ({
      ...project,
      budget: Number(project.budget),
      spent: Number(project.spent),
      dueDate: project.dueDate?.toISOString() ?? null,
    })),
    tasks: tasks.map((task) => ({
      ...task,
      dueDate: task.dueDate?.toISOString() ?? null,
    })),
  };
});

export const getReportsData = cache(async () => {
  const { organization } = await getWorkspaceContext();
  const organizationId = organization.id;
  const now = new Date();
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

  const [pipelineRows, projectRiskRows, projectRiskCountRows, invoiceTotals, expenseTotals, retainerTotals, timeTotals, billableTotals, clientTotals, activeClients, overdueInvoices, topClientRows, revenueRows, expenseRows] = await Promise.all([
    db.$queryRaw<PipelineRow[]>(Prisma.sql`
      SELECT stage, COUNT(*) AS count, COALESCE(SUM(value), 0) AS value,
        COALESCE(SUM(value * probability / 100), 0) AS weighted,
        COALESCE(SUM(probability), 0) AS probabilitySum
      FROM \`Lead\` WHERE organizationId = ${organizationId} GROUP BY stage
    `),
    db.$queryRaw<Array<{ id: string; name: string; client: string; progress: number; burn: unknown; dueDate: Date | null }>>(Prisma.sql`
      SELECT p.id, p.name, c.company AS client, p.progress,
        CASE WHEN p.budget > 0 THEN p.spent / p.budget * 100 ELSE 0 END AS burn,
        p.dueDate
      FROM Project p INNER JOIN Client c ON c.id = p.clientId
      WHERE p.organizationId = ${organizationId}
        AND p.status NOT IN ('Complete', 'Archived')
        AND ((p.budget > 0 AND p.spent / p.budget * 100 > p.progress + 15) OR p.dueDate < ${now})
      ORDER BY (p.dueDate < ${now}) DESC, (CASE WHEN p.budget > 0 THEN p.spent / p.budget * 100 ELSE 0 END - p.progress) DESC
      LIMIT 50
    `),
    db.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
      SELECT COUNT(*) AS count FROM Project p
      WHERE p.organizationId = ${organizationId}
        AND p.status NOT IN ('Complete', 'Archived')
        AND ((p.budget > 0 AND p.spent / p.budget * 100 > p.progress + 15) OR p.dueDate < ${now})
    `),
    db.invoice.aggregate({ where: { organizationId, status: "Paid" }, _sum: { total: true } }),
    db.expense.aggregate({ where: { organizationId, incurredAt: { gte: sixMonthsAgo } }, _sum: { amount: true } }),
    db.retainer.aggregate({ where: { organizationId, status: "Active" }, _sum: { monthlyValue: true } }),
    db.timeEntry.aggregate({ where: { project: { organizationId }, date: { gte: sixMonthsAgo } }, _sum: { minutes: true } }),
    db.timeEntry.aggregate({ where: { project: { organizationId }, date: { gte: sixMonthsAgo }, billable: true }, _sum: { minutes: true } }),
    db.client.aggregate({ where: { organizationId }, _count: { _all: true }, _avg: { healthScore: true } }),
    db.client.count({ where: { organizationId, status: "Active" } }),
    db.invoice.count({ where: { organizationId, OR: [{ status: "Overdue" }, { status: "Sent", dueDate: { lt: now } }] } }),
    db.$queryRaw<Array<{ company: string; value: unknown }>>(Prisma.sql`
      SELECT c.company, COALESCE(SUM(i.total), 0) AS value
      FROM Invoice i INNER JOIN Client c ON c.id = i.clientId
      WHERE i.organizationId = ${organizationId} AND i.status = 'Paid'
      GROUP BY i.clientId, c.company ORDER BY value DESC LIMIT 1
    `),
    db.$queryRaw<MonthRow[]>(Prisma.sql`
      SELECT DATE_FORMAT(paidAt, '%Y-%m') AS monthKey, COALESCE(SUM(total), 0) AS total
      FROM Invoice
      WHERE organizationId = ${organizationId} AND status = 'Paid' AND paidAt >= ${sixMonthsAgo}
      GROUP BY DATE_FORMAT(paidAt, '%Y-%m')
    `),
    db.$queryRaw<MonthRow[]>(Prisma.sql`
      SELECT DATE_FORMAT(incurredAt, '%Y-%m') AS monthKey, COALESCE(SUM(amount), 0) AS total
      FROM Expense WHERE organizationId = ${organizationId} AND incurredAt >= ${sixMonthsAgo}
      GROUP BY DATE_FORMAT(incurredAt, '%Y-%m')
    `),
  ]);

  const paidRevenue = dbNumber(invoiceTotals._sum.total);
  const totalExpenses = dbNumber(expenseTotals._sum.amount);
  const weightedPipeline = pipelineRows.filter((row) => !["Won", "Lost"].includes(row.stage)).reduce((sum, row) => sum + dbNumber(row.weighted), 0);
  const recurringRevenue = dbNumber(retainerTotals._sum.monthlyValue);
  const loggedMinutes = Number(timeTotals._sum.minutes ?? 0);
  const billableMinutes = Number(billableTotals._sum.minutes ?? 0);
  const topClient = topClientRows[0] ? { company: topClientRows[0].company, value: dbNumber(topClientRows[0].value) } : null;
  const projectRisks = projectRiskRows.map((project) => ({
    id: project.id,
    name: project.name,
    client: project.client,
    progress: project.progress,
    burn: dbNumber(project.burn),
    dueDate: project.dueDate?.toISOString() ?? null,
  }));

  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1));
    const key = date.toISOString().slice(0, 7);
    return { key, label: new Intl.DateTimeFormat("en", { month: "short" }).format(date), revenue: 0, expenses: 0 };
  });
  const monthMap = new Map(months.map((month) => [month.key, month]));
  revenueRows.forEach((row) => {
    const month = monthMap.get(row.monthKey);
    if (month) month.revenue = dbNumber(row.total);
  });
  expenseRows.forEach((row) => {
    const month = monthMap.get(row.monthKey);
    if (month) month.expenses = dbNumber(row.total);
  });

  const leadCount = pipelineRows.reduce((sum, row) => sum + Number(row.count), 0);
  const probabilityTotal = pipelineRows.reduce((sum, row) => sum + dbNumber(row.probabilitySum), 0);
  const pipelineMap = new Map(pipelineRows.map((row) => [row.stage, row]));

  return {
    metrics: {
      forecast60Days: weightedPipeline + recurringRevenue * 2,
      forecastConfidence: leadCount ? probabilityTotal / leadCount : 0,
      utilization: loggedMinutes ? billableMinutes / loggedMinutes * 100 : 0,
      revenueConcentration: paidRevenue && topClient ? topClient.value / paidRevenue * 100 : 0,
      paidRevenue,
      operatingCosts: totalExpenses,
      grossMargin: paidRevenue ? (paidRevenue - totalExpenses) / paidRevenue * 100 : 0,
      recurringRevenue,
    },
    health: {
      activeClients,
      averageClientHealth: dbNumber(clientTotals._avg.healthScore),
      overdueInvoices,
      projectRisks: Number(projectRiskCountRows[0]?.count ?? 0),
    },
    topClient,
    projectRisks,
    months,
    pipeline: ["New", "Qualified", "Discovery", "Proposal", "Negotiation", "Won", "Lost"].map((stage) => ({
      stage,
      count: Number(pipelineMap.get(stage)?.count ?? 0),
      value: dbNumber(pipelineMap.get(stage)?.value),
    })),
  };
});
