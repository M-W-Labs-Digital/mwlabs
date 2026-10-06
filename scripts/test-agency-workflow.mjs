import crypto from "node:crypto";
import mariadb from "mariadb";

const baseUrl = process.env.WORKFLOW_TEST_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000";
const email = "agency-workflow-smoke@example.com";
const inviteEmail = "agency-invite-smoke@example.com";
const password = `Aw1!${crypto.randomBytes(16).toString("hex")}`;
const connectionUrl = process.env.DATABASE_URL?.replace(/^mysql:/, "mariadb:");
if (!connectionUrl) throw new Error("DATABASE_URL is required.");

const pool = mariadb.createPool(connectionUrl);
const ids = {};
let userId = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, init = {}, cookie = "") {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Origin: baseUrl,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
}

async function mutate(resource, method, payload, cookie) {
  const response = await request(`/api/crud/${resource}`, { method, body: JSON.stringify(payload) }, cookie);
  const body = await response.json().catch(() => ({}));
  assert(response.ok, `${method} ${resource} failed (${response.status}): ${body.error ?? "unknown error"}`);
  return body;
}

async function cleanup() {
  const users = await pool.query("SELECT id FROM user WHERE email IN (?, ?)", [email, inviteEmail]);
  const userIds = users.map((user) => user.id);
  const invitations = await pool.query("SELECT id FROM invitation WHERE email = ?", [inviteEmail]);
  if (invitations.length) {
    await pool.query("DELETE FROM BackgroundJob WHERE idempotencyKey IN (?)", [invitations.map((invitation) => `workflow-email:organization-invitation-${invitation.id}`)]);
  }
  const notificationRows = await pool.query("SELECT id FROM Notification WHERE message LIKE ? OR message LIKE ? OR message LIKE ? OR title LIKE ?", ["%Workflow Smoke%", "%Workflow Invitee%", "%agency-workflow-smoke@example.com%", "%Workflow Smoke%"]);
  const notificationIds = new Set(notificationRows.map((notification) => notification.id));
  if (userIds.length) {
    const userNotifications = await pool.query("SELECT id FROM Notification WHERE actorId IN (?) OR userId IN (?)", [userIds, userIds]);
    for (const notification of userNotifications) notificationIds.add(notification.id);
  }
  if (notificationIds.size) {
    await pool.query("DELETE FROM BackgroundJob WHERE idempotencyKey IN (?)", [Array.from(notificationIds, (id) => `notification-email:${id}`)]);
  }
  await pool.query("DELETE FROM invitation WHERE email = ?", [inviteEmail]);
  await pool.query("DELETE FROM team WHERE name = ?", ["Workflow Smoke Team"]);
  if (userIds.length) {
    await pool.query("DELETE FROM AuditLog WHERE userId IN (?)", [userIds]);
    await pool.query("DELETE FROM user WHERE id IN (?)", [userIds]);
  }
  await pool.query("DELETE FROM `Notification` WHERE message LIKE ? OR title LIKE ?", ["%Workflow Smoke%", "%Workflow Smoke%"]);
  await pool.query("DELETE FROM `AuditLog` WHERE metadata LIKE ?", ["%Workflow Smoke%"]);
  await pool.query("DELETE FROM `BlogPost` WHERE title = ?", ["Workflow Smoke Blog Post"]);
  await pool.query("DELETE FROM `WorkPost` WHERE title = ?", ["Workflow Smoke Work Post"]);
  await pool.query("DELETE FROM `SeoPage` WHERE title = ?", ["Workflow Smoke SEO Page"]);
  await pool.query("DELETE FROM `MediaAsset` WHERE originalName = ?", ["workflow-smoke.png"]);
  await pool.query("DELETE FROM `Automation` WHERE name = ?", ["Workflow Smoke Follow-up"]);
  await pool.query("DELETE FROM `Activity` WHERE title LIKE ? OR body LIKE ?", ["%Workflow Smoke%", "%agency-workflow-smoke@example.com%"]);
  const leads = await pool.query("SELECT id FROM `Lead` WHERE email = ?", [email]);
  for (const lead of leads) {
    await pool.query("DELETE FROM `BackgroundJob` WHERE `idempotencyKey` = ?", [`workflow-email:lead-registration-${lead.id}`]);
    await pool.query("DELETE FROM `Activity` WHERE leadId = ?", [lead.id]);
    await pool.query("DELETE FROM `Proposal` WHERE leadId = ?", [lead.id]);
    await pool.query("DELETE FROM `Lead` WHERE id = ?", [lead.id]);
  }
  const clients = await pool.query("SELECT id FROM `Client` WHERE email = ?", [email]);
  for (const client of clients) {
    const invoices = await pool.query("SELECT id FROM `Invoice` WHERE clientId = ?", [client.id]);
    for (const invoice of invoices) {
      await pool.query("DELETE FROM `Payment` WHERE invoiceId = ?", [invoice.id]);
      await pool.query("DELETE FROM `InvoiceItem` WHERE invoiceId = ?", [invoice.id]);
      await pool.query("DELETE FROM `Invoice` WHERE id = ?", [invoice.id]);
    }
    const projects = await pool.query("SELECT id FROM `Project` WHERE clientId = ?", [client.id]);
    for (const project of projects) {
      await pool.query("DELETE FROM `TimeEntry` WHERE projectId = ?", [project.id]);
      await pool.query("DELETE FROM `Task` WHERE projectId = ?", [project.id]);
      await pool.query("DELETE FROM `Milestone` WHERE projectId = ?", [project.id]);
      await pool.query("DELETE FROM `Project` WHERE id = ?", [project.id]);
    }
    await pool.query("DELETE FROM `Contract` WHERE clientId = ?", [client.id]);
    await pool.query("DELETE FROM `Retainer` WHERE clientId = ?", [client.id]);
    await pool.query("DELETE FROM `Client` WHERE id = ?", [client.id]);
  }
}

try {
  await cleanup();
  const signup = await request("/api/auth/sign-up/email", { method: "POST", body: JSON.stringify({ name: "Workflow Smoke Owner", email, password }) });
  const signupBody = await signup.json();
  assert(signup.ok && signupBody.user?.id, `Sign-up failed (${signup.status}).`);
  userId = signupBody.user.id;
  const cookies = typeof signup.headers.getSetCookie === "function" ? signup.headers.getSetCookie() : [signup.headers.get("set-cookie")].filter(Boolean);
  const cookie = cookies.map((value) => value.split(";", 1)[0]).join("; ");
  assert(cookie, "No authenticated session cookie was returned.");

  const organizations = await pool.query("SELECT id FROM organization WHERE slug = ? LIMIT 1", ["mw-labs"]);
  assert(organizations[0]?.id, "The mw-labs organization is not configured.");
  const organizationId = organizations[0].id;
  await pool.query("INSERT INTO member (id, organizationId, userId, role, createdAt) VALUES (?, ?, ?, 'owner', NOW(3))", [crypto.randomUUID(), organizationId, userId]);

  const invitation = await request("/api/auth/organization/invite-member", { method: "POST", body: JSON.stringify({ email: inviteEmail, role: "member", organizationId }) }, cookie);
  const invitationBody = await invitation.json();
  assert(invitation.ok && invitationBody.id, `Member invitation failed (${invitation.status}).`);
  const invitationPage = await request(`/invite/${invitationBody.id}`);
  assert(invitationPage.ok && (await invitationPage.text()).includes("Join the M&amp;W Command workspace"), "The invitation acceptance page did not render.");
  const invitedSignup = await request("/api/auth/sign-up/email", { method: "POST", body: JSON.stringify({ name: "Workflow Invitee", email: inviteEmail, password }) });
  const invitedSignupBody = await invitedSignup.json();
  assert(invitedSignup.ok && invitedSignupBody.user?.id, `Invited account creation failed (${invitedSignup.status}).`);
  const invitedCookies = typeof invitedSignup.headers.getSetCookie === "function" ? invitedSignup.headers.getSetCookie() : [invitedSignup.headers.get("set-cookie")].filter(Boolean);
  const invitedCookie = invitedCookies.map((value) => value.split(";", 1)[0]).join("; ");
  const accepted = await request("/api/auth/organization/accept-invitation", { method: "POST", body: JSON.stringify({ invitationId: invitationBody.id }) }, invitedCookie);
  assert(accepted.ok, `Invitation acceptance failed (${accepted.status}).`);
  const directory = await request("/api/team", {}, cookie);
  const directoryBody = await directory.json();
  const invitedMember = directoryBody.members?.find((member) => member.email === inviteEmail);
  assert(directory.ok && invitedMember?.role === "member", "The accepted member was not added to the workspace directory.");
  const roleUpdate = await request("/api/auth/organization/update-member-role", { method: "POST", body: JSON.stringify({ memberId: invitedMember.id, role: "admin", organizationId }) }, cookie);
  assert(roleUpdate.ok, `Member role update failed (${roleUpdate.status}).`);
  const team = await request("/api/auth/organization/create-team", { method: "POST", body: JSON.stringify({ name: "Workflow Smoke Team", organizationId }) }, cookie);
  const teamBody = await team.json();
  assert(team.ok && teamBody.id, `Delivery team creation failed (${team.status}).`);

  const automation = await mutate("automations", "POST", { data: { name: "Workflow Smoke Follow-up", trigger: "lead.won", action: "create.follow_up_activity", enabled: true } }, cookie);
  ids.automation = automation.record.id;

  const lead = await mutate("leads", "POST", { data: { name: "Workflow Smoke", company: "Workflow Smoke Ltd", email, source: "Smoke test", stage: "New", value: 12000, probability: 35, score: 80 } }, cookie);
  ids.lead = lead.record.id;
  const wonLead = await mutate("leads", "PATCH", { id: ids.lead, data: { stage: "Won" } }, cookie);
  assert(String(wonLead.workflow).includes("client onboarding"), "Winning a lead did not report client conversion.");

  const clients = await pool.query("SELECT id, status FROM `Client` WHERE organizationId = ? AND email = ?", [organizationId, email]);
  assert(clients.length === 1 && clients[0].status === "Onboarding", "Won lead did not create exactly one onboarding client.");
  ids.client = clients[0].id;
  const automationRows = await pool.query("SELECT runCount FROM `Automation` WHERE id = ?", [ids.automation]);
  assert(Number(automationRows[0]?.runCount) === 1, "The enabled lead.won automation did not run exactly once.");

  const project = await mutate("projects", "POST", { data: { name: "Workflow Smoke Project", code: `SMK-${Date.now()}`, clientId: ids.client, status: "Planning", progress: 0, budget: 5000, spent: 0 } }, cookie);
  ids.project = project.record.id;
  const firstMilestone = await mutate("milestones", "POST", { data: { projectId: ids.project, name: "Workflow Smoke Discovery", status: "In progress", progress: 25 } }, cookie);
  ids.milestoneOne = firstMilestone.record.id;
  const secondMilestone = await mutate("milestones", "POST", { data: { projectId: ids.project, name: "Workflow Smoke Delivery", status: "Review", progress: 75 } }, cookie);
  ids.milestoneTwo = secondMilestone.record.id;
  const projectRows = await pool.query("SELECT progress FROM `Project` WHERE id = ?", [ids.project]);
  assert(Number(projectRows[0]?.progress) === 50, "Project progress was not derived from milestones.");

  const task = await mutate("tasks", "POST", { data: { title: "Workflow Smoke Task", projectId: ids.project, assigneeId: userId, status: "In progress", priority: "High", estimatedMinutes: 120 } }, cookie);
  ids.task = task.record.id;
  const time = await mutate("time-entries", "POST", { data: { projectId: ids.project, taskId: ids.task, description: "Workflow Smoke time", minutes: 90, billable: true, hourlyRate: 100, date: new Date().toISOString().slice(0, 10) } }, cookie);
  ids.time = time.record.id;
  const taskRows = await pool.query("SELECT trackedMinutes FROM `Task` WHERE id = ?", [ids.task]);
  assert(Number(taskRows[0]?.trackedMinutes) === 90, "Task tracked time was not reconciled.");

  const invoice = await mutate("invoices", "POST", { data: { clientId: ids.client, projectId: ids.project, number: `SMOKE-${Date.now()}`, status: "Draft", currency: "GBP", subtotal: 0, tax: 10 } }, cookie);
  ids.invoice = invoice.record.id;
  const item = await mutate("invoice-items", "POST", { data: { invoiceId: ids.invoice, description: "Workflow Smoke service", quantity: 2, unitPrice: 50 } }, cookie);
  ids.item = item.record.id;
  const invoiceAfterItem = await pool.query("SELECT subtotal, tax, total FROM `Invoice` WHERE id = ?", [ids.invoice]);
  assert(Number(invoiceAfterItem[0]?.subtotal) === 100 && Number(invoiceAfterItem[0]?.total) === 110, "Invoice totals were not derived from line items and tax.");
  const payment = await mutate("payments", "POST", { data: { invoiceId: ids.invoice, amount: 110, method: "Bank transfer", reference: "Workflow Smoke payment" } }, cookie);
  ids.payment = payment.record.id;
  const invoiceAfterPayment = await pool.query("SELECT status, paidAt FROM `Invoice` WHERE id = ?", [ids.invoice]);
  assert(invoiceAfterPayment[0]?.status === "Paid" && invoiceAfterPayment[0]?.paidAt, "Full payment did not mark the invoice paid.");

  await mutate("invoice-items", "PATCH", { id: ids.item, data: { unitPrice: 60 } }, cookie);
  const increasedInvoice = await pool.query("SELECT status, total, paidAt FROM Invoice WHERE id = ?", [ids.invoice]);
  assert(increasedInvoice[0].status === "Sent" && Number(increasedInvoice[0].total) === 130 && !increasedInvoice[0].paidAt, "Increasing a paid invoice did not reopen its outstanding balance.");
  await mutate("invoice-items", "PATCH", { id: ids.item, data: { unitPrice: 50 } }, cookie);
  const reducedInvoice = await pool.query("SELECT status FROM Invoice WHERE id = ?", [ids.invoice]);
  assert(reducedInvoice[0].status === "Paid", "Reducing an invoice to its recorded payments did not reconcile its status.");

  const seo = await mutate("seo-pages", "POST", { data: { title: "Workflow Smoke SEO Page", summary: "A complete smoke test landing page.", content: "This page proves that publishing, generated slugs, and public rendering work together.", status: "Published", noIndex: true } }, cookie);
  ids.seo = seo.record.id;
  assert(seo.record.slug && seo.record.publishedAt, "Published SEO content did not receive a slug and publication time.");
  const blog = await mutate("blog-posts", "POST", { data: { title: "Workflow Smoke Blog Post", excerpt: "Published content should reach the homepage and blog archive.", content: "This article proves the admin-to-website publishing workflow.", category: "Workflow", authorName: "M&W Labs", status: "Published", featured: true } }, cookie);
  ids.blog = blog.record.id;
  assert(blog.record.slug && blog.record.publishedAt, "Published blog content did not receive a slug and publication time.");
  const work = await mutate("work-posts", "POST", { data: { title: "Workflow Smoke Work Post", clientName: "Workflow Smoke Ltd", industry: "Testing", summary: "Published work should reach the homepage and work archive.", solution: "The CRM publishing workflow creates a dedicated public case-study page.", status: "Published", featured: true } }, cookie);
  ids.work = work.record.id;
  assert(work.record.slug && work.record.publishedAt, "Published work content did not receive a slug and publication time.");

  const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const form = new FormData();
  form.set("file", new File([pixel], "workflow-smoke.png", { type: "image/png" }));
  const uploaded = await fetch(`${baseUrl}/api/uploads`, { method: "POST", headers: { Origin: baseUrl, Cookie: cookie }, body: form });
  const uploadedBody = await uploaded.json();
  assert(uploaded.status === 201 && uploadedBody.url, `Image upload failed (${uploaded.status}).`);
  const media = await request(uploadedBody.url);
  assert(media.ok && media.headers.get("content-type") === "image/png" && (await media.arrayBuffer()).byteLength === pixel.length, "The database-backed uploaded image did not render correctly.");

  for (const [path, marker] of [["/app", "Welcome back"], ["/app/reports", "Reports &amp; forecasting"], ["/app/settings", "Workspace settings"], ["/app/team", "People &amp; teams"], ["/app/finance", "Finance &amp; billing"]]) {
    const response = await request(path, {}, cookie);
    const html = await response.text();
    assert(
      response.ok && html.includes(marker),
      `${path} did not render its live workspace marker (status ${response.status}; response: ${html.replace(/\s+/g, " ").slice(0, 500)}).`,
    );
  }
  const publicPage = await request(`/${seo.record.slug}`);
  assert(publicPage.ok && (await publicPage.text()).includes("Workflow Smoke SEO Page"), "The published SEO page did not render publicly.");
  for (const [path, marker] of [["/", "Workflow Smoke Blog Post"], ["/", "Workflow Smoke Work Post"], ["/blog", "Workflow Smoke Blog Post"], [`/blog/${blog.record.slug}`, "Workflow Smoke Blog Post"], ["/work", "Workflow Smoke Work Post"], [`/work/${work.record.slug}`, "Workflow Smoke Work Post"]]) {
    const response = await request(path);
    assert(response.ok && (await response.text()).includes(marker), `${path} did not render published CMS content.`);
  }

  const protectedDelete = await request("/api/crud/clients", { method: "DELETE", body: JSON.stringify({ id: ids.client }) }, cookie);
  assert(protectedDelete.status === 400, "A connected client was destructively deleted instead of being protected.");
  await pool.query("UPDATE member SET role = 'member' WHERE organizationId = ? AND userId = ?", [organizationId, userId]);
  const deniedFinance = await request("/api/crud/invoices", { method: "PATCH", body: JSON.stringify({ id: ids.invoice, data: { status: "Void" } }) }, cookie);
  assert(deniedFinance.status === 403, "A member role was allowed to change finance records.");

  for (const resource of ["leads", "invoices", "payments", "proposals", "contracts", "automations"]) {
    const denied = await request(`/api/crud/${resource}`, {}, cookie);
    assert(denied.status === 403, `A member could read restricted ${resource}.`);
  }
  const lookup = await request("/api/crud/leads?lookup=1", {}, cookie);
  const lookupBody = await lookup.json();
  assert(lookup.ok && lookupBody.records.every((record) => Object.keys(record).every((key) => ["id", "name", "company"].includes(key))), "Lead lookup leaked commercial fields.");
  const deniedLead = await request("/api/leads", { method: "POST", body: JSON.stringify({ name: "Denied", company: "Denied", email, source: "Test", value: 1 }) }, cookie);
  assert(deniedLead.status === 403, "The legacy lead endpoint bypassed member permissions.");
  const memberDashboard = await request("/app", {}, cookie);
  assert(!(await memberDashboard.text()).includes("Revenue pulse"), "The member dashboard exposed financial summaries.");
  const memberDirectory = await request("/api/team", {}, cookie);
  assert((await memberDirectory.json()).invitations.length === 0, "The member directory exposed pending invitations.");
  const decimalPage = await request("/api/crud/tasks?limit=10.5", {}, cookie);
  assert(decimalPage.ok, "Fractional pagination limits caused a server error.");

  console.log("Agency workflow smoke test passed: invitations, roles, teams, conversion, automation, delivery, time, finance, durable media, homepage/blog/work/SEO publishing, live pages, deletion safety, and role boundaries.");
} finally {
  await cleanup();
  await pool.end();
}
