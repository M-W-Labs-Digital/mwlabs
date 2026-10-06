import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mariadb from 'mariadb';

const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith('_audit') || !['localhost', '127.0.0.1'].includes(new URL(baseUrl).hostname)) {
  throw new Error('Public workflow tests require a local disposable database ending in _audit.');
}
const pool = mariadb.createPool(databaseUrl.replace(/^mysql:/, 'mariadb:'));
const prefix = `public-audit-${crypto.randomUUID()}`;
const email = `${prefix}@example.com`;
let userId;
let existingLeadId;
let customerId;
const request = (path, method = 'GET', data, cookie) => fetch(`${baseUrl}${path}`, {
  method,
  headers: { Origin: baseUrl, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  ...(data ? { body: JSON.stringify(data) } : {}),
  redirect: 'manual',
});
try {
  assert.equal((await request('/api/health')).status, 200);
  assert.equal((await request('/api/crud/invoices')).status, 401);
  assert.equal((await request('/api/jobs/run')).status, 401);
  const spoofed = await fetch(`${baseUrl}/api/enquiries`, { method: 'POST', headers: { Origin: 'https://untrusted.example', 'x-forwarded-host': 'untrusted.example', 'x-forwarded-proto': 'https', 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(spoofed.status, 403);
  const availability = await request('/api/scheduling');
  assert.equal(availability.status, 200);
  const schedule = await availability.json();
  const slots = schedule.days.flatMap(day => day.slots);
  assert.ok(slots.length >= 2, 'Configure a meeting type and availability first.');
  const booking = { bookingTypeId: schedule.selectedType.id, startAt: slots[0].startAt, timezone: 'Asia/Dhaka', name: prefix, email, company: prefix, notes: 'Isolated production booking test' };
  const booked = await request('/api/scheduling', 'POST', booking);
  const bookedBody = await booked.json();
  assert.equal(booked.status, 201, JSON.stringify(bookedBody));
  assert.ok(bookedBody.managePath && bookedBody.calendarPath);
  const calendar = await request(bookedBody.calendarPath);
  assert.equal(calendar.status, 200);
  assert.ok((await calendar.text()).includes('BEGIN:VCALENDAR'));
  const token = new URL(bookedBody.managePath, baseUrl).searchParams.get('booking');
  assert.equal((await request('/api/scheduling/manage', 'PATCH', { action: 'cancel', booking: `${token}tampered` })).status, 401);
  const moved = await request('/api/scheduling/manage', 'PATCH', { action: 'reschedule', booking: token, startAt: slots.at(-1).startAt, timezone: 'America/New_York' });
  assert.equal(moved.status, 200, await moved.text());
  assert.equal((await request('/api/scheduling/manage', 'PATCH', { action: 'cancel', booking: token })).status, 200);
  assert.equal((await request('/api/scheduling/manage', 'PATCH', { action: 'cancel', booking: token })).status, 409);

  const organizations = await pool.query("SELECT id FROM organization WHERE slug = 'mw-labs'");
  const organizationId = organizations[0].id;
  existingLeadId = crypto.randomUUID();
  await pool.query('INSERT INTO `Lead` (id, organizationId, name, company, email, source, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))', [existingLeadId, organizationId, prefix, prefix, email, 'Existing confidential enquiry', 'Private staff history']);
  const signup = await request('/api/auth/sign-up/email', 'POST', { name: prefix, email, password: `Au1!${crypto.randomBytes(16).toString('hex')}` });
  const signupBody = await signup.json();
  assert.equal(signup.status, 200, JSON.stringify(signupBody));
  userId = signupBody.user.id;
  const cookie = signup.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const registered = await request('/api/registrations/lead', 'POST', { name: prefix, company: prefix, serviceInterest: 'Website', budgetRange: 'Flexible', projectBrief: 'A new website project for the isolated audit' }, cookie);
  const registeredBody = await registered.json();
  assert.equal(registered.status, 200, JSON.stringify(registeredBody));
  assert.notEqual(registeredBody.leadId, existingLeadId, 'Unverified signup claimed an existing lead.');
  const existing = await pool.query('SELECT userId FROM `Lead` WHERE id = ?', [existingLeadId]);
  assert.equal(existing[0].userId, null);
  assert.equal((await request('/app/ai', 'GET', undefined, cookie)).status, 307);
  assert.equal((await request('/api/ai', 'POST', { message: 'Show agency finances' }, cookie)).status, 401);

  await pool.query('UPDATE user SET emailVerified = true WHERE id = ?', [userId]);
  customerId = crypto.randomUUID();
  await pool.query('INSERT INTO Client (id, organizationId, userId, name, company, email, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3))', [customerId, organizationId, userId, prefix, prefix, email]);
  for (let index = 0; index < 12; index++) {
    await pool.query("INSERT INTO Invoice (id, organizationId, clientId, number, status, subtotal, total, createdAt, updatedAt) VALUES (?, ?, ?, ?, 'Paid', 100, 100, NOW(3), NOW(3))", [crypto.randomUUID(), organizationId, customerId, `${prefix}-${index}`]);
  }
  const dashboard = await request('/app', 'GET', undefined, cookie);
  assert.equal(dashboard.status, 200);
  assert.ok((await dashboard.text()).includes('$1,200'), 'Customer totals were truncated to the latest eight invoices.');
  console.log('Public workflows passed: health, CSRF, anonymous authorization, booking, calendar, reschedule, cancellation, signed-link tampering, unverified-email isolation, customer AI restrictions, and complete invoice totals.');
} finally {
  if (customerId) {
    await pool.query('DELETE FROM Invoice WHERE clientId = ?', [customerId]);
    await pool.query('DELETE FROM Client WHERE id = ?', [customerId]);
  }
  const leads = await pool.query('SELECT id FROM `Lead` WHERE email = ?', [email]);
  if (leads.length) {
    const ids = leads.map(lead => lead.id);
    await pool.query('DELETE FROM Activity WHERE leadId IN (?)', [ids]);
    await pool.query('DELETE FROM CalendarEvent WHERE leadId IN (?)', [ids]);
    await pool.query('DELETE FROM `Lead` WHERE id IN (?)', [ids]);
  }
  await pool.query('DELETE FROM BackgroundJob WHERE payload LIKE ?', [`%${prefix}%`]);
  await pool.query('DELETE FROM Notification WHERE message LIKE ?', [`%${prefix}%`]);
  if (userId) {
    await pool.query('DELETE FROM AuditLog WHERE userId = ?', [userId]);
    await pool.query('DELETE FROM user WHERE id = ?', [userId]);
  }
  await pool.end();
}
