// Validate deployment settings without displaying their values.
const issues = [];
for (const name of ['DATABASE_URL', 'BETTER_AUTH_URL', 'BETTER_AUTH_SECRET']) {
  if (!process.env[name]?.trim()) issues.push(`${name} is required.`);
}
for (const name of ['BETTER_AUTH_URL', 'NEXT_PUBLIC_SITE_URL']) {
  if (!process.env[name]) continue;
  try {
    const url = new URL(process.env[name]);
    if (url.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname)) issues.push(`${name} must use a public HTTPS origin.`);
  } catch { issues.push(`${name} must be a valid URL.`); }
}
if (process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_SECRET.length < 32) issues.push('BETTER_AUTH_SECRET must contain at least 32 characters.');
const workerSecret = process.env.BACKGROUND_JOB_SECRET || process.env.CRON_SECRET;
if (!workerSecret || workerSecret.length < 32) issues.push('A background worker secret of at least 32 characters is required.');
if (!process.env.RESEND_API_KEY || !process.env.NOTIFICATION_EMAIL_FROM) issues.push('Configure the email provider and sender for verification and password recovery.');
if (process.env.ALLOW_INITIAL_SIGNUP === 'true') issues.push('Disable ALLOW_INITIAL_SIGNUP after owner bootstrap.');
if (process.env.SEED_DEMO_DATA === 'true') issues.push('Disable SEED_DEMO_DATA in production.');
if (Boolean(process.env.GOOGLE_CLIENT_ID) !== Boolean(process.env.GOOGLE_CLIENT_SECRET)) issues.push('Google OAuth requires both client ID and client secret.');
if (issues.length) {
  console.error(issues.map((issue) => `- ${issue}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log('Production environment checks passed. Verify database TLS, backups, scheduler, and provider delivery in the deployment environment.');
}
