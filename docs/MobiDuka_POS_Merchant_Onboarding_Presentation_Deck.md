# 🏪 MobiDuka POS — Merchant Onboarding Presentation Deck Blueprint

## High-Impact Sales and Marketing Slide Framework for Kenyan Retailers

This presentation blueprint structures a merchant-facing sales deck for sales agents, marketing campaigns, and retailer group presentations. It is tailored to kiosks, mini-supermarkets, pharmacies, agrovets, and multi-branch retailers across Kenya and East Africa.

---

## 🎚️ Slide 1: Title and Hook

### Visual layout

Use a split-screen layout:

- Left: Bold primary typography over a crisp light-gray canvas (`#F8F9FA`)
- Right: Device viewport showing the Flutter app's Material Design 3 POS cart

### Slide content

**Header:** MobiDuka POS

**Core message:** Smart retail management for modern Kenyan businesses.

### Speaker presentation script

> Habari zenu! Running a retail shop in Kenya today means constantly fighting challenges such as unstable power grids, unpredictable internet drops, missing stock lines, and chaotic loose-change tracking. Welcome to MobiDuka POS, a modern retail software ecosystem built specifically for kiosks, mini-supermarkets, pharmacies, and agrovets across East Africa. We do not just provide a cash register; we give you complete control of your business, anywhere and anytime.

---

## 📊 Slide 2: The Core Problem — The Retail Leak

### Visual layout

Use a high-density three-column layout with dark charcoal containers (`#1E1E1E`) and red warning accents (`#C62828`) for contrast and scannability.

### Slide header

**The Hidden Costs of Manual Paper Bookkeeping**

### Content

- **Stock shrinkage:** Untracked shelf inventory and supplier delivery discrepancies silently reduce net profits.
- **Internet blackouts:** Basic cloud-only software freezes when cellular data fails.
- **Credit auditing gaps:** Loose paper debt logs, or *Daftari la madeni*, are easily lost or miscalculated.

### Speaker presentation script

> Let us look at the numbers. A typical retail duka can lose significant revenue through stock leakages, untracked cash shortages, and inaccurate credit-book records. When the internet goes down, the counter line stops moving. Paper books cannot scale with your store, and old desktop programs keep you tied to one physical location.

---

## 📲 Slide 3: The MobiDuka System Blueprint

### Visual layout

Use horizontal architectural layers demonstrating full-stack, multi-platform integration.

### Slide header

**One Unified Retail Workspace Network**

### Comparison overview

| Component | Target operator profile | Core operational feature set |
| --- | --- | --- |
| Flutter mobile app | Cashiers and counter staff | Fast POS checkout, local Bluetooth receipt printing, and SmartScan camera tracking |
| Next.js web portal | Store owners and auditors | Multi-branch reporting, gross profit margin analysis, and employee provisioning |
| PostgreSQL cloud | Secure infrastructure | Multi-tenant data isolation and reliable background sync payload queues |

### Speaker presentation script

> MobiDuka solves this through a dual-surface architecture. Cashiers operate on a fast, offline-first Flutter smartphone interface. At the same time, store owners can use the mobile-first Next.js web portal from any browser to track inventory valuation and net profit performance in real time.

---

## ⚡ Slide 4: High-Speed Offline Checkouts and Sync

### Visual layout

Use a minimalist workflow timeline with 12px corner radiuses and royal-blue visual anchors (`#123A8F`).

### Slide header

**Zero Network Downtime — Resilient Retail Operations**

### Content

- **Low-latency local transactions:** SQLite stores supported cash-register activity directly on the device.
- **Continuous checkouts:** Cashiers can sell products, record cash expenses, and onboard customers during network outages.
- **Idempotent synchronization:** When connectivity returns, the background sync service uploads queued records without creating duplicates.

### Speaker presentation script

> With MobiDuka, an internet outage does not mean lost sales. Every sale is written securely to the handset's local storage. The cashier continues working without delay, and when cellular data returns, the background sync engine replicates records to the cloud with protection against duplicate transactions.

---

## 🏎️ Slide 5: The Dual-Layer Lipa Na M-Pesa Race Engine

### Visual layout

Use a horizontal chart showing two independent payment-confirmation paths merging into a final checkout-success dialog.

### Slide header

**Instant Mobile Money Checkout Verification**

### Content

- **Path A — Online polling:** Automated Safaricom Daraja API STK Push status checks.
- **Path B — Device confirmation:** A supported native Android SMS listener can detect merchant confirmation messages where the required permissions and services are available.
- **Concurrency race:** The first valid confirmation unlocks the register within the configured checkout window.

### Speaker presentation script

> We designed MobiDuka for fast M-Pesa reconciliation. When a customer pays through a Buy Goods Till number, the system can check Safaricom's service while the supported mobile terminal watches for an incoming confirmation. Once a valid transaction reference is received, the payment is recorded and the receipt can be printed without requiring the cashier to manually interpret the customer's phone.

> Availability of SMS confirmation depends on device permissions, Android support, carrier behavior, and the configured payment integration.

---

## 📳 Slide 6: SmartScan™ Camera and Hardware Integrations

### Visual layout

Use clean light-mode surfaces (`#FFFFFF`) with amber highlights (`#EF6C00`).

### Slide header

**Turn Any Smartphone Into a Retail Barcode Terminal**

### Content

- **Inventory identification:** The rear camera reads standard product labels such as EAN-13 and UPC-A and can provide haptic feedback.
- **Customer QR routing:** Approved customer account QR codes can attach a debtor to a sale and switch the transaction to credit.
- **Bluetooth ESC/POS printing:** Local printing works with paired 58 mm or 80 mm thermal printers and does not require internet access.

### Speaker presentation script

> No more expensive barcode hardware or complex scanner setups. MobiDuka converts a phone camera into a high-speed scanner for instant cart additions and customer QR account routing. Pair it with a wireless Bluetooth thermal printer and you have a complete portable retail terminal.

---

## 💳 Slide 7: Store Credit Books and Cashier Audits

### Visual layout

Use a two-column comparison view showing customer credit balances alongside cash-drawer flows.

### Slide header

**Tighter Credit Ledgers and Daily Shift Audits**

### Content

- **Daftari la madeni:** Monitors customer balances and highlights risk profiles with visual warnings.
- **Shift opening floats:** Requires the cashier to enter the opening cash balance before the shift workflow begins.
- **Variance equation:** Calculates the closing position using:

  $$
  \text{Expected Balance} = \text{Opening Float} + \text{Cash Sales} - \text{Cash Expenses}
  $$

  $$
  \text{Variance} = \text{Counted Cash} - \text{Expected Balance}
  $$

### Speaker presentation script

> MobiDuka digitizes manual credit tracking. The system monitors outstanding balances and calculates the customer ledger automatically. It also requires opening float information and compares expected cash with the physical closing count, making shortages and overages visible at the end of every shift.

---

## 📈 Slide 8: Real-Time Web Management Analytics

### Visual layout

Use a high-fidelity desktop dashboard frame featuring a daily revenue line chart and a shift-variance bar chart.

### Slide header

**Total Transparency Over Business Performance**

### Content

- **Inventory asset valuation:** Calculates stock value using quantities on hand and unit cost prices.
- **Net profit margins:** Deducts cost of goods and operating expenses from revenue.
- **Risk summaries:** Highlights low-stock thresholds and active open cash sessions in one dashboard.

### Speaker presentation script

> As an owner, you gain clear visibility into your business. The analytics engine tracks inventory asset values and maps sales against wholesale product costs. The dashboard shows revenue trends, low-stock alerts, cash-session status, and net profit margins so you can make better decisions.

---

## 🚀 Slide 9: Onboarding and Subscription Commercial Tiers

### Visual layout

Use a structured three-column subscription grid with clear, bold KSh pricing.

### Slide header

**Scalable SaaS Pricing Built to Grow With You**

### Plan summary

| Plan | Indicative price | Included scope |
| --- | --- | --- |
| Kiosk Plan | KSh 2,000/month | One business tenant, one counter device, two user accounts, POS, M-Pesa workflows, and receipt printing |
| Retail Grow Plan | KSh 5,000/month | Three branches, unlimited staff, expanded RBAC, Credit Book, procurement, and push alerts where configured |
| Enterprise Plan | Custom | Unlimited multi-branch operations, dedicated infrastructure options, and scheduled data exports |

### Speaker presentation script

> We have priced MobiDuka to be accessible at every stage of business growth. Small kiosks can start with the Kiosk Plan for one register. Growing shops can link three branches, unlock expanded Supervisor and Accountant permissions, and use advanced customer credit tools. There are no hidden setup fees, and your plan can grow as your store network expands.

> Final prices, limits, taxes, payment fees, and included services should be confirmed in the signed commercial agreement.

---

## 🏁 Slide 10: Call to Action and Go-Live Step

### Visual layout

Use a clean minimalist canvas with a large checklist on the left and contact details on the right.

### Slide header

**Start Optimizing Your Retail Profits Today**

### Content

- **Risk-free trial:** Start with a 14-day fully featured trial, subject to the published trial terms.
- **Quick integration:** Create the store profile and import the stock catalogue with guided onboarding.
- **Hardware bundles:** Partner packages can include Android terminals and Bluetooth thermal printers.

### Speaker presentation script

> Ready to reduce stock leakages and secure your register cash flows? Start today with a 14-day trial. Our team can help configure your business profile, connect your approved M-Pesa Till parameters, pair your printer, and import your product list. Let us make your retail operations smarter, safer, and more profitable with MobiDuka POS. Asanteni sana!

---

## Campaign Customization Questions

- What brand colors, logo assets, and typography should appear on the final slides?
- Will the deck target kiosk owners, pharmacies, agrovets, wholesalers, or multi-branch retailers?
- Should the call to action point to a sales representative, web signup form, WhatsApp number, or product demonstration?
- Is a one-page sales leave-behind flyer required to accompany this deck?
