# 💰 MobiDuka POS — Commercial SaaS Pricing Strategy Checklist

This checklist defines a commercial SaaS pricing strategy for MobiDuka POS across the East African retail market. It scales from micro-kiosks to multi-branch retail networks and aligns with the five-tier role-based access control model and multi-tenant architecture.

---

## 🇰🇪 Market Context Anchor

- **Base pricing currency:** Kenya Shillings (KSh), reducing currency fluctuation friction for local merchants.
- **Payment integration:** Subscription billing should support Lipa Na M-Pesa workflows, including Paybill and Buy Goods options where commercially approved.
- **Value metric:** Pricing should scale primarily by active store branches and registered device terminals rather than transaction volume, so growing merchants are not penalized for increasing sales.

---

## 🧭 Phase 1: Subscription Tier Packaging

### [ ] Tier 1: Kiosk / Single-Counter Plan

**Target customers:** Duka and kiosk owners

**Recommended pricing:** KSh 1,500–2,500 per month

#### Architecture bounds

- Strict limit of one business tenant ID (`businessId`)
- Maximum of two user accounts
- Roles limited to `OWNER` and `CASHIER`
- One active mobile device terminal
- Active hardware sync-log mapping

#### Core feature access

- Offline-first POS checkout basket
- Lipa Na M-Pesa STK Push and device payment-confirmation workflows
- Local Bluetooth thermal receipt printing using ESC/POS-compatible printers
- Basic 7-day sales summary reports

### [ ] Tier 2: Retail Grow Plan

**Target customers:** Wholesalers, pharmacies, agrovets, and growing retail stores

**Recommended pricing:** KSh 4,500–6,000 per month

#### Architecture bounds

- Up to three distinct branch locations
- Cross-branch inventory transfers enabled
- Unlimited user accounts
- Full five-tier RBAC access:
  - `OWNER`
  - `SUPERVISOR`
  - `CASHIER`
  - `ACCOUNTANT`
  - `ADMIN`, where applicable for platform operations

#### Advanced feature access

- Procurement pipeline with supplier registries and purchase-order stock increments
- Credit Book ledger, including debt warnings and customer QR-code routing
- Firebase Cloud Messaging alerts for large expenses and shift closures, where configured
- 30-day and 90-day web administration analytics
- Gross profit margin reporting
- Live inventory asset valuation

### [ ] Tier 3: Enterprise Multi-Branch Plan

**Target customers:** Supermarkets, mini-markets, and large multi-branch retailers

**Recommended pricing:** KSh 12,000+ per month or a custom annual contract

#### Architecture bounds

- Unlimited branch tenants
- Unlimited registered device terminals
- Custom service-level and onboarding agreements

#### Enterprise feature access

- Dedicated or reserved Neon PostgreSQL connection-pooling allocation where required
- Priority Sentry performance telemetry and request-tracing isolation
- Automated weekly data-backup exports in CSV and JSON formats
- Enterprise onboarding, reporting, and support terms

---

## 📲 Phase 2: M-Pesa Transaction and Payment Processing Strategy

### [ ] Transaction Fee Architecture Monetization

Choose one commercial model for the Daraja API deployment:

#### Option A: SaaS-only model

- The merchant supplies and manages their own Daraja credentials, including `MPESA_CONSUMER_KEY` and `MPESA_PASSKEY`.
- The merchant settles applicable transaction fees directly with Safaricom.
- MobiDuka charges strictly for the software subscription.
- This is recommended for initial low-friction onboarding because it keeps payment settlement and merchant ownership clear.

#### Option B: Facilitated pay-fac model

- Transactions process through a MobiDuka or aggregator shortcode.
- Funds are split or remitted according to the commercial agreement.
- This model requires additional settlement, compliance, reconciliation, and support processes.

> Confirm current Safaricom fees, product eligibility, compliance requirements, and contractual terms before publishing rates or promising a specific transaction-fee cap.

### [ ] Automated Paywall Subscription Locking

- Add subscription status checks to the appropriate Next.js authentication and API authorization layers.
- When a tenant subscription becomes `EXPIRED`, block or limit protected API operations according to the signed commercial policy.
- Define whether `/api/sync` uploads are blocked immediately or allowed during a grace period.
- Allow the Flutter app to enter a clearly communicated read-only local archive state when policy requires it.
- Provide renewal through an approved M-Pesa STK Push or other configured billing workflow.
- Preserve locally stored transaction data until synchronization and subscription-state handling are safely resolved.

---

## 🛡️ Phase 3: Financial and Technical Safeguards

### [ ] Production Data Seeding Separation

- Ensure onboarding and support tools enforce the `seed:demo` production safety guard.
- Never run sample-data seeding against live merchant-facing databases.
- Refuse demo seeding when `NODE_ENV=production` or the database URL identifies a live environment unless an explicit controlled override is required.
- Keep demonstration tenants and production tenants completely separate.

### [ ] Database Multi-Tenant Protection

- Verify that tenant-owned tables use indexed `businessId` query paths.
- Confirm every business query is scoped to the authenticated tenant.
- Test concurrent sync traffic across multiple branches and businesses.
- Confirm that data from one tenant cannot be read or modified by another tenant.
- Monitor query latency and connection-pool utilization as merchant count grows.

---

## 🚀 Phase 4: Commercial Go-To-Market Execution

### [ ] KSh 0 14-Day Risk-Free Trial

- Provide a 14-day fully featured trial with clear start and end dates.
- Collect only the account information required for onboarding and support.
- Allow merchants to test barcode scanning, offline workflows, and Bluetooth printing before connecting live payment services.
- Make trial limitations, renewal terms, and data-retention behavior explicit.
- Notify merchants before the trial expires and provide a simple renewal path.

### [ ] Technical Hardware Bundling Strategy

Offer an optional commercial starter package combining the MobiDuka subscription with partner hardware:

- One Android handset POS terminal with a suitable camera
- One 58 mm portable Bluetooth thermal receipt printer
- Printer pairing and test-print assistance
- Camera, scanning, and receipt-printing onboarding
- Warranty and replacement terms documented separately

---

## ✅ Commercial Readiness Checklist

- [ ] Pricing is displayed in KSh.
- [ ] Monthly and annual billing options are defined.
- [ ] Annual discount rules are approved.
- [ ] Trial eligibility and expiry behavior are documented.
- [ ] Branch, user, and device limits are enforced by the subscription plan.
- [ ] Feature entitlements are mapped to the five RBAC tiers.
- [ ] M-Pesa merchant-owned and aggregator models are evaluated.
- [ ] Daraja transaction fees and compliance obligations are confirmed.
- [ ] Subscription renewal and grace-period behavior are implemented.
- [ ] Tenant isolation is tested across API routes and synchronization.
- [ ] Production and demonstration databases are separated.
- [ ] Hardware bundle pricing and support terms are documented.
- [ ] Customer support and escalation procedures are ready.
- [ ] Terms of service, privacy policy, billing terms, and cancellation rules are published.

---

## Decisions to Finalize

- [ ] Select the M-Pesa monetization model: merchant-owned Till or MobiDuka-facilitated aggregation.
- [ ] Select the first billing cycle priority: monthly subscriptions or annual plans with discounts.
- [ ] Confirm the final limits for branches, users, terminals, and data retention per tier.
- [ ] Confirm whether payment processing fees are passed through, bundled, or charged separately.
- [ ] Approve trial conversion and subscription-expiry policies.
- [ ] Approve the hardware starter-package margin and support model.

---

## Next Implementation Options

- Build Next.js subscription-verification middleware and tenant entitlement checks.
- Configure an automated daily backup pipeline for the production Neon PostgreSQL database.
- Add a subscription ledger model and billing-event audit trail to Prisma.
- Add plan-aware limits and feature gates to employee, sync, reporting, and device workflows.
