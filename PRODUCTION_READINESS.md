# Production readiness review — 2026-10-06

## Changes

- Updated Next.js to 16.3.8 and refreshed affected dependencies. Pinned patched MariaDB, MySQL2, and deepmerge-ts transitive packages. Moved the shadcn CLI to development dependencies. Generated the Prisma client for the resolved 7.10.0 runtime.
- Added server-side read permissions to CRUD APIs, preserved minimal lead selectors for scheduling, and closed the alternate lead-creation permission bypass. Unknown roles fail closed.
- Restricted member AI context, financial dashboard summaries, pending invitations, and notifications. Customers cannot enter the internal AI page.
- Required verified email ownership before connecting existing lead/client records. Customer invoice totals now aggregate all matching records, scoped to the signed-in customer and workspace.
- Reconciled invoice payment status when line-item totals change.
- Fixed empty form timers silently discarding legitimate submissions. Failed submissions remain retryable, and successful duplicates produce a conflict instead of false success. Booking fingerprints distinguish separate slots.
- Bounded upload stream reads and visitor-rate-limit memory. Enquiries share the application's origin validation instead of trusting forwarded host headers.
- Added error recovery pages, database health endpoint, deployment configuration checks, regression tests, and CI checks. Prisma configuration explicitly loads local environment files.

## Verification

Verified against a disposable MySQL 8.4 container and a local production server with external email, AI, and OAuth credentials disabled:

- All 13 committed migrations applied to an empty database.
- TypeScript, ESLint, regression tests, Prisma schema validation, and production build.
- Production dependency audit and repository secret scan.
- Agency workflow: invitations, roles, teams, lead conversion, automation, milestones, tasks, time, invoice calculations, payments, media, CMS publishing, protected deletion, and access controls.
- Durable jobs: atomic claims, stale-lock recovery, completion, and acknowledgement.
- Notifications: inbox, deferred email, read state, preferences, and deletion.
- Scale: 2,000 records, cursor pagination, bounded responses, and a 25-record audited import.
- Public workflows: booking, ICS download, rescheduling across timezones, cancellation, tampered tokens, CSRF rejection, unverified-email isolation, customer AI restrictions, and totals across 12 invoices.

## Remaining launch requirements

- `npm audit --omit=dev` reports **zero vulnerabilities**. The full audit reports **9 high findings** through development tooling's `braces` dependency, for which no patched release was available during this review. The full security check intentionally continues to report these findings. Do not use forced major downgrades just to silence the audit. Advisory: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm.
- The local environment fails deployment validation because its auth URL is HTTP localhost, no sufficiently long worker secret is configured, and demo seeding is enabled. Set production values in the deployment secret manager and rerun `production:check`.
- No connected browser was available, so visual, interaction, accessibility, and mobile checks remain unverified.
- Real email delivery, Google OAuth, Gemini, database TLS/backups, cron invocation, and production hosting were not exercised. No deployment was performed.
- Rate limits and duplicate suppression are process-local. Use trusted proxy header handling and an edge/shared rate limiter for multi-instance production. The smoke tests verify representative flows, not exhaustive concurrency, load, or financial accounting behavior.

This review improves the tested application substantially; it is not a guarantee that every defect has been eliminated or that an unverified deployment is ready to launch.
