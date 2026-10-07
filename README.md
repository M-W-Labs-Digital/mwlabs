# M&W Command

The private operating system for M&W Labs. M&W Command covers lead capture, qualification, proposals, contracts, client onboarding, project delivery, tasks, time, team capacity, invoices, payments, expenses, retainers, reporting, automation, and a Gemini-powered agency second brain.

## Stack

- Next.js 16 App Router, React 19, and TypeScript
- Tailwind CSS 4 and shadcn/ui (Base UI primitives)
- Three.js / React Three Fiber and GSAP
- MySQL 8.4 in development and production
- Prisma ORM 7 with the official MySQL/MariaDB driver adapter
- Better Auth with database sessions, email/password, optional Google OAuth, organizations, teams, roles, invitations, and rate limits
- Google GenAI SDK for Gemini

## Local setup

Requirements: Node.js 20.19+ and Docker Desktop (or an existing MySQL 8 server).

```bash
# Create a local .env file with the variables listed below.
docker compose up -d mysql
npm install
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For initial setup only, set `ALLOW_INITIAL_SIGNUP=true`, create the first owner account, then set it back to `false`. Set `SEED_DEMO_DATA=true` only when you want sample records in a development workspace.

The included development database uses a non-root `mwlabs_app` user and a separate `mwlabs_shadow` database for Prisma Migrate. Replace every credential and secret before deploying.

### Secret handling

- Keep local credentials only in `.env`; every `.env*` file is ignored by Git.
- Keep `GEMINI_API_KEY`, database passwords, auth secrets, and OAuth secrets server-only. Never use a `NEXT_PUBLIC_` prefix for them.
- Configure production credentials through the deployment platform's encrypted secret manager, then redeploy after rotating a credential.
- Run `npm run security:check` before pushing. GitHub Actions also rejects tracked key patterns and credential files.
- If a provider or GitHub reports a leaked key, revoke it first. Removing it from code does not make the leaked value safe again.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | MySQL application connection string |
| `DATABASE_POOL_SIZE` | Optional per-instance connection-pool limit, default `10` (bounded to `2`–`50`) |
| `SHADOW_DATABASE_URL` | MySQL shadow database used by development migrations |
| `BETTER_AUTH_URL` | Canonical application URL |
| `NEXT_PUBLIC_SITE_URL` | Optional public canonical URL for metadata, sitemap, and robots (defaults to `BETTER_AUTH_URL`) |
| `BETTER_AUTH_SECRET` | High-entropy auth secret (`openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google OAuth |
| `GEMINI_API_KEY` | Server-only Gemini credential |
| `GEMINI_MODEL` | Gemini model, default `gemini-3.5-flash` |
| `RESEND_API_KEY` | Server-only Resend API key used for transactional notification emails |
| `NOTIFICATION_EMAIL_FROM` | Verified sender, for example `M&W Command <notifications@mwlabs.digital>` |
| `NOTIFICATION_EMAIL_REPLY_TO` | Optional reply-to address for operational emails |
| `BACKGROUND_JOB_SECRET` | High-entropy bearer secret protecting the scheduled worker endpoint (`openssl rand -hex 32`) |
| `CRON_SECRET` | Optional deployment-platform alternative to `BACKGROUND_JOB_SECRET` |
| `BACKGROUND_JOB_RETENTION_DAYS` | Optional successful-job retention period, default `30` days (bounded to `1`–`365`) |
| `ALLOW_INITIAL_SIGNUP` | Temporary owner bootstrap gate; keep `false` after setup |
| `SEED_DEMO_DATA` | Adds sample records to a new development workspace when `true` |
| `MWLABS_UPLOAD_DIR` | Optional legacy filesystem fallback for images uploaded before database media storage |

Production should use TLS for MySQL, an application-specific database user, managed secret storage, and a transaction email provider before requiring email verification.

For the Hostinger deployment, set `BETTER_AUTH_URL=https://mwlabs.digital` and `NEXT_PUBLIC_SITE_URL=https://mwlabs.digital` in the hosting environment, then rebuild and redeploy. Authentication uses an explicit public origin instead of inferring the internal Hostinger host. Production ignores HTTP/loopback URL settings and falls back to `https://mwlabs.digital`; a valid public HTTPS `BETTER_AUTH_URL` overrides this default for staging or another deployment. URL paths are removed so auth endpoints stay under `/api/auth`. Register `https://mwlabs.digital/api/auth/callback/google` as the Google OAuth redirect URI. Keep the same `BETTER_AUTH_SECRET` across builds and instances so existing sessions remain valid.

## Native scheduling workflow

Scheduling is built into M&W Command and has no third-party account, token, webhook, or paid-plan dependency. Owners and administrators configure it under `/app/scheduling`.

The workflow is:

1. Website enquiries enter the CRM and receive a signed, prefilled booking path.
2. Public availability is calculated from active meeting types, weekly working hours, minimum notice, booking horizon, duration, buffers, and existing CRM calendar conflicts.
3. Confirming a slot atomically creates a CRM calendar event, links or creates the lead, advances early-stage leads to Discovery, updates qualification signals, and records activity/audit history.
4. Each online booking receives a private signed management link for rescheduling and cancellation, plus an `.ics` calendar file.
5. Meeting times are stored as UTC instants and automatically displayed in each visitor's browser-detected IANA timezone, including daylight-saving changes. Visitors can override the detected timezone before booking or rescheduling.
6. Portal users can book and manage meetings without re-entering their profile, while owners manage every appointment in the agency calendar.

## Notifications and email

The notification inbox at `/app/inbox` receives CRUD, activity, enquiry, registration, and scheduling events. The header bell polls for unread notifications, and each user can control in-app delivery, CRUD email, activity email, booking email, and notifications for their own actions.

Email delivery uses a durable MySQL-backed background queue. Jobs are saved before the originating response completes, then processed immediately through Next.js `after()` for low latency. Atomic claims prevent duplicate workers, provider idempotency keys prevent duplicate sends, stopped workers are recovered after five minutes, and transient failures use capped exponential backoff. Successful job history is retained for 30 days by default and pruned automatically. Without `RESEND_API_KEY` and `NOTIFICATION_EMAIL_FROM`, in-app notifications remain active and email jobs are deferred without exhausting their retry allowance.

For restart recovery, call the protected worker endpoint every one to five minutes from the deployment scheduler:

```bash
curl --fail --silent --show-error \
  --header "Authorization: Bearer $BACKGROUND_JOB_SECRET" \
  "https://your-command-domain.example/api/jobs/run?limit=25"
```

Owners and administrators can inspect queue health, run due work, and retry dead jobs from `/app/settings`. In production, configure either `BACKGROUND_JOB_SECRET` or `CRON_SECRET`; the worker endpoint refuses unauthenticated production requests.

## Agency operating workflow

- Leads move through a validated pipeline. Marking a lead won creates or reuses one onboarding client, and accepting a lead-linked proposal performs the same handoff without creating duplicates.
- Projects include milestone management. Milestone progress recalculates project progress, task assignees come from the real member directory, and time entries recalculate task tracked time.
- Finance includes invoices, line items, payments, expenses, and retainers. Line-item totals are calculated server-side, invoice totals include tax, and a fully reconciled payment marks its invoice paid.
- Blog posts, case studies, and SEO pages support database-backed image uploads (durable across server restarts), draft/publish states, generated slugs, metadata, and public rendering.
- Supported automations use structured triggers and actions. Runs update counters, create audit events, and either notify owners/admins or create a follow-up activity.
- Owners and admins can invite members, copy invitation links when email is unavailable, change roles, and manage delivery teams. Invitees can create a member account from the invitation without reopening public owner signup.
- CSV/XLSX import and CSV export are available on live record workspaces. Imports validate headers and each row, accept up to 500 rows per file, and send 25-row batches with bounded database concurrency.
- Record workspaces use indexed cursor pagination, server-side search, and 50-row views, so the browser never has to render the full dataset. Blog and work archives are paginated, and large sitemaps are automatically split into 45,000-URL segments.
- Reports and dashboard indicators use database aggregates and bounded result sets instead of loading full tables into application memory. Settings shows provider/security readiness without exposing credentials.
- Email notification fan-out is inserted into the durable queue in 500-job chunks; workers claim bounded batches and safely recover interrupted work.
- Connected clients, projects, and invoices are protected from destructive cascading deletion; archive or void them to preserve operating history.

## Quality checks

```bash
npm run typecheck
npm run lint
npm run security:check
npm run jobs:smoke
npm run notifications:smoke
npm run workflow:smoke
npm run scale:smoke
npm run build
```

`npm run build` uses Webpack because the hosting build environment fails to start Turbopack's internal CSS worker. Keep the hosting build command as `npm run build` and the output directory as `.next`. Local development continues to use Turbopack through `npm run dev`.

## Architecture

- `src/app/(marketing)` — M&W Labs public brand experience and authentication layout
- `src/app/(agency)/app` — protected M&W Labs command-center layout
- `src/lib/dal.ts` — server-only session, organization, and DTO boundary
- `src/app/api` — authenticated, Zod-validated route handlers
- `prisma/schema.prisma` — multi-tenant relational domain model
- `prisma/migrations` — MySQL migration history
- `compose.yaml` — reproducible MySQL 8.4 development service

AI responses are grounded in organization-scoped data. Agency records are treated as untrusted context, secrets stay server-side, and external or consequential actions require human approval.

## Production verification

Run `npm run check`, `npm run security:runtime`, `npm run db:generate`, and `npm run build` before deployment. CI runs these checks on Node 22. `npm run security:check` also audits development tools; its remaining upstream findings are recorded in `PRODUCTION_READINESS.md`.

Run `npm run production:check` with the deployment environment injected (or `node --env-file=.env scripts/check-production.mjs` for a local configuration review). This validates required configuration without printing secrets. Apply committed migrations using `npm run db:deploy`; do not use `db:push` to deploy production schema changes. Prisma commands now load `.env` while retaining explicitly provided environment variables.

`GET /api/health` checks both database connectivity and the organization table used by registration; it returns 503 if either check fails. Monitor it alongside the scheduled background worker. Configure edge rate limits for public APIs when running multiple application instances; the application rate limits are bounded, per-process safeguards.

If `/register` or login fails while the old health endpoint reports success, inspect the Node.js runtime logs for the failing Prisma query. A successful `SELECT 1` does not verify that application tables or profile columns exist. Run `npm run db:deploy` with the production environment to apply committed migrations, and redeploy with `npm run build`. The build regenerates Prisma Client, and the generator, client runtime, and MariaDB adapter are pinned to the same version. Registration displays a retry/contact message during a database outage and keeps an account that was created before a project-profile submission failed, so retrying does not attempt to create that account again.

Run database smoke tests only against a disposable local database with transactional email and AI provider keys disabled. The scripts create and delete records, and the job smoke test processes due jobs. The additional public-flow test is `node --env-file=PATH_TO_TEST_ENV scripts/test-public-workflows.mjs`; it requires a database name ending in `_audit`, a local application URL, and an initialized `mw-labs` workspace with scheduling defaults. It covers booking, rescheduling, cancellation, signed links, customer isolation, and invoice aggregates.

Verify real email delivery, Google sign-in, Gemini responses, database TLS/backups, browser interactions, and scheduler execution in staging before launch. The local automated checks do not validate those external deployment services.
