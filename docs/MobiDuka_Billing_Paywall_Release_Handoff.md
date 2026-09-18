# MobiDuka Billing and Paywall Release Handoff

## Release Scope

This release contains the subscription enforcement and billing-warning changes for the MobiDuka multi-tenant platform.

### Included files

- `proxy.ts`
  - Performs Edge-compatible JWT payload inspection.
  - Blocks expired subscriptions with HTTP `402 Payment Required`.
  - Preserves approved CORS headers on lockout responses.
- `app/api/auth/login/route.ts`
  - Adds `subscriptionStatus` to issued session tokens.
  - Adds `subscriptionExpiresAt` as a Unix timestamp when a license exists.
  - Derives subscription state from the existing `Business.status` and `License` relation.
- `app/api/cron/billing-warnings/route.ts`
  - Scans active licenses expiring three days ahead.
  - Targets active business owners with email addresses.
  - Sends warning emails through Resend when configured.
  - Reports skipped notifications instead of claiming delivery when email settings are absent.
- `vercel.json`
  - Registers the billing-warning cron at `0 6 * * *`.

## Required Environment Variables

Configure these values in the Vercel production environment:

```text
CRON_SECRET=<private cron authorization secret>
RESEND_API_KEY=<Resend API key>
BILLING_EMAIL_FROM=MobiDuka <billing@your-domain.com>
DATABASE_URL=<production PostgreSQL connection string>
JWT_SECRET=<production JWT signing secret>
```

Do not place real credentials in this document, source control, screenshots, or support tickets.

## Runtime Behavior

### Subscription lockout

The Edge proxy returns a JSON response with status `402` when either condition is true:

- `subscriptionStatus` is `EXPIRED`
- `subscriptionExpiresAt` has passed

Route handlers remain responsible for authoritative JWT signature and credential validation. The Edge parser is only a fast subscription gate.

### Billing warning cron

The Vercel cron runs daily at 06:00 UTC. It searches for active licenses whose expiry falls within the UTC calendar day three days from the current date.

A successful response includes scan and delivery counters:

```json
{
  "success": true,
  "scanned": 1,
  "emailsDispatched": 1,
  "notificationsSkipped": 0,
  "failures": 0,
  "emailProviderConfigured": true
}
```

## Validation Completed

- `pnpm exec tsc --noEmit`
- `pnpm run build`
- `git diff --check` on the release files
- `vercel.json` JSON parsing
- Production build route discovery for `/api/cron/billing-warnings`

## Archive

The release archive contains the four production billing files:

- `proxy.ts`
- `app/api/auth/login/route.ts`
- `app/api/cron/billing-warnings/route.ts`
- `vercel.json`

Archive name: `staged-changes.zip`

## Deployment Status

- A scoped local commit was created for the billing release.
- The remote `dev` branch advanced independently.
- No force push was performed.
- Deployment remains pending until the remote branch is reconciled and a maintainer explicitly pushes the release.

## Operational Checklist

- [ ] Add `CRON_SECRET` to Vercel production environment variables.
- [ ] Add `RESEND_API_KEY` to Vercel production environment variables.
- [ ] Add and verify `BILLING_EMAIL_FROM` with the email provider.
- [ ] Confirm the production `DATABASE_URL` points to the intended tenant database.
- [ ] Confirm Vercel Cron is enabled for the production project.
- [ ] Test the cron route with the configured authorization header.
- [ ] Test an expiring license in a non-production environment.
- [ ] Confirm the owner receives exactly one warning email per scheduled scan.
- [ ] Confirm an expired token receives the expected `402` response.
- [ ] Reconcile the remote `dev` branch before deployment.
