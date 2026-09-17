# 🚀 MobiDuka POS

## Commercial SaaS Merchant Onboarding Manual

## 📍 1. Welcome to MobiDuka

MobiDuka is an offline-first retail management platform engineered explicitly for kiosks, mini-shops, pharmacies, agrovets, convenience stores, and growing multi-branch businesses.
The application helps merchants manage:

- Sales and cash registers: Processes checkouts seamlessly with continuous station monitoring.
- Product inventory: Tracks stock levels automatically using continuous camera barcode scanning.
- Customer credit accounts: Maintains real-time debtor profiles ("Daftari la madeni") with historical ledger tracking.
- Staff access and permissions: Enforces zero data visibility leaks via explicit role-based access rules.
- M-Pesa payments: Automates instant point-of-sale customer push callbacks.
- Expenses and reports: Aggregates transaction metrics and operating costs dynamically.
- Receipt printing: Dispatches receipts instantly over local Bluetooth connections.
- Cloud synchronization: Safeguards operations via resilient, background data-uploading queues.

---

## 💻 2. Getting Started

### Access the Web Admin Console

1. Open your assigned store web terminal URL link: `https://vercel.app`.
2. Sign in using your secure administrator account credentials.
3. Confirm your business identity profile and active branch details.
4. Record your assigned `businessId` securely. Do not share it publicly.

> 🔒 Tenant Data Protection: Each business operates inside an isolated, secure tenant workspace. Sales, employees, products, expenses, and reports are strictly scoped to that business.

### Install the Mobile App

1. Download the official MobiDuka Android or iOS application package to your terminal handset.
2. Sign in using your assigned cashier credentials.
3. Allow camera, notification, Bluetooth, and SMS permissions when prompted by the phone.
4. Confirm that your store product catalog and staff roster are available.

---

## 🛡️ 3. Staff Roles and Permissions

MobiDuka supports five role tiers to match your store hierarchy:

| Role | Main Responsibility | Interface Visibility Restrictions |
| --- | --- | --- |
| `ADMIN` | Global SaaS Support | Tracks global platform health; cannot view private merchant sales lines. |
| `OWNER` | Business Proprietor | Full access permissions across profit trends, financial charts, and settings. |
| `SUPERVISOR` | Store Manager | Manages stock arrivals, suppliers, and purchase orders. Hidden from net profit graphs. |
| `CASHIER` | Register Operator | Strict Default-Deny State. Restricted entirely to POS carts, cash expenses, and closeouts. |
| `ACCOUNTANT` | Financial Auditor | Can read sales metrics, cash sessions, and expense records to balance books. |

### Register an Employee

1. Open the Staff Directory dashboard pane.
2. Select Register Employee.
3. Enter the employee’s full name, telephone contact number, email, and explicit role assignment.
4. Assign a unique four-digit PIN within the business.
5. Save the employee profile.

> 🔒 Security Safeguard: PINs are automatically hashed before storage. Never include plaintext PINs in spreadsheets, support tickets, or marketing materials.

---

## 🏧 4. Daily Store Workflow

### Open a Shift

1. Sign in on the secure lock overlay screen with your 4-digit PIN.
2. Open More and select Open Shift, if prompted.
3. Enter the exact physical opening cash balance float present in the drawer.
4. Confirm the shift to unlock the POS sales grid.

### Complete a Sale

1. Open the POS workspace.
2. Search for a product manually or tap Scan to activate the camera.
3. Review item quantities, discounts, and prices.
4. Select the payment method (CASH, MPESA, or CREDIT).
5. Complete the transaction.
6. Print or share the invoice receipt if required.

### Scan Products

The SmartScan™ camera can scan supported retail barcodes. When a matching product exists in the catalog, it is automatically added to the active basket and the device provides haptic vibration feedback.

### Add a Product Barcode

1. Open the Stock catalog layout.
2. Select Add Product.
3. Tap the scan button beside the barcode field.
4. Scan the physical product label.
5. Complete the product details (cost, retail price, minimum threshold).
6. Save the product.

---

## 💳 5. Customer Credit and QR Codes

Customer QR payloads should use an approved multi-format schema, such as:

```text
MOBIDUKA:USER:<customer-id>
CUST_<customer-id>
```

When a valid customer account QR code is scanned:

1. The customer account is located within the active business database tables.
2. The customer profile is attached to the current sale.
3. The payment method automatically changes to credit.
4. The transaction is recorded against the customer ledger.

> 🔒 Privacy Rule: Do not generate or use QR codes containing passwords, PINs, tokens, or unnecessary personal information.

---

## 📲 6. Live Lipa Na M-Pesa Till Configuration

Configure your commercial Daraja credentials through protected deployment environment variables inside your console settings panel:

```bash
MPESA_CONSUMER_KEY="your_live_daraja_consumer_key"
MPESA_CONSUMER_SECRET="your_live_daraja_consumer_secret"
MPESA_PASSKEY="your_live_production_online_passkey"
MPESA_SHORTCODE="401234"                        # Your 6-digit parent STORE NUMBER
MPESA_TILL_NUMBER="789012"                      # The public 6-digit counter TILL NUMBER
MPESA_TRANSACTION_TYPE="CustomerBuyGoodsOnline" # Configures proper routing directly to the Till
```

> 🔒 Security Notice: Never commit these values to Git or place them in screenshots, manuals, or support requests.

### Before going live, verify:

- Till number and store shortcode match your Safaricom certificate.
- The callback URL points to: `https://vercel.app`.
- STK query credentials are valid.
- Production Daraja approval status is complete.
- A successful test transaction has been completed.

---

## 📊 7. Shift Closeout & Variance Audits

1. Open More.
2. Select Close Shift.
3. Count the physical cash drawer.
4. Enter the counted amount.
5. Review the closeout summary window.
6. Add notes for any discrepancies.
7. Select Finalize Closeout.

The system calculates performance using these explicit metrics formulas:

$$
\text{Expected Balance} = \text{Opening Float} + \text{Cash Sales} - \text{Cash Expenses}
$$

$$
\text{Variance} = \text{Counted Cash} - \text{Expected Balance}
$$

- Negative Variance (Shortage): Appears in Bright Red type to flag a shortfall.
- Zero/Positive Variance: Appears in Bright Green type to confirm an accurate balance.

> 🔒 Data Protection: Unsynchronized transaction records must remain on the device until a successful cloud upload is confirmed.

---

## 📡 8. Offline Operation and Synchronization

MobiDuka can continue recording supported transactions during network interruptions.

### When cellular connectivity returns:

1. Pending records are automatically uploaded to the cloud database.
2. Successfully synchronized records are removed from the pending queue.
3. Failed records remain available for retry.
4. Tenant identifiers are fully preserved during synchronization.

> ⚠️ Critical Directive: Do not uninstall the app or clear application data while unsynchronized transactions exist on the phone.

---

## 🔒 9. Data Protection Guidelines

Merchants should:

- Use unique staff PINs.
- Avoid sharing user accounts.
- Lock devices when unattended.
- Restrict administrator web access.
- Keep production environment credentials private.
- Review staff access access privileges regularly.
- Report lost or stolen devices immediately.
- Never run demo seed scripts against production databases. 
> Production and demonstration tenants must remain completely separate.

---

## 🔌 10. Hardware Setup

### Bluetooth Thermal Printer

1. Turn on your portable thermal printer.
2. Pair it through the smartphone's Bluetooth system settings.
3. Open MobiDuka.
4. Tap the refresh icon next to the available printers dropdown.
5. Select the paired printer.
6. Print a test receipt.

### Camera Barcode Scanner

Ensure camera permission is enabled in the device settings. If scanning fails, confirm that:

- The camera lens is clean.
- The product barcode is well lit.
- The product exists in the catalog.
- The code label is not damaged.

---

## 📊 11. Reports and Analytics

Authorized users can review their web dashboards to track:

- Revenue & Cost of goods: Monitors gross sales and product item margins.
- Expenses: Aggregates operational overhead and outflows.
- Net profit & Profit margin: Displays true business profitability percentages.
- Inventory valuation: Displays total asset value based on `quantity × costPrice`.
- Low-stock alerts: Highlights items hitting their minimum stock thresholds.
- Open cash sessions & daily performance trends: Tracks continuous cashier status metrics.

> 🔒 Privacy Rule: Reports are tenant-scoped and should only be shared with authorized business users.

---

## 📞 12. Support Checklist

When contacting support, provide:

- Business name and branch name
- App version and device model
- Approximate time of the issue
- Screenshot of the error
- Whether the device was online or offline

> 🔴 NEVER SEND: Passwords, PINs, API keys, JWT tokens, database connection strings, or customer payment credentials.

---

## 🏁 13. Go-Live Checklist

- Business tenant profile completed
- Staff roles and security permission levels assigned
- Unique 4-digit PINs configured
- Product catalog imported
- Product barcodes verified
- Opening stock entered
- M-Pesa production credentials configured
- Printer paired and tested
- Camera scanning tested
- Staff trained on shift open and closeout
- Offline workflow tested
- Cloud synchronization verified
- Production database schema backups confirmed
- Support contact metrics distributed

---
