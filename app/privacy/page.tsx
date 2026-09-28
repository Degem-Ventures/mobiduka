import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | MobiDuka POS",
  description: "How MobiDuka POS handles merchant and payment data.",
};

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px", color: "#0D1B3D", lineHeight: 1.6 }}>
      <h1>MobiDuka POS Privacy Policy</h1>
      <p>Last updated: September 26, 2026</p>

      <h2>M-Pesa SMS reconciliation</h2>
      <p>
        This feature is optional and is disabled by default. When a merchant explicitly enables it on an Android device,
        MobiDuka may read recent SMS inbox messages while the app is open to identify M-Pesa payment confirmations.
      </p>
      <p>
        The app parses only messages that identify an M-Pesa confirmation. It stores the confirmation receipt code,
        amount, payer details when present, and reconciliation status locally on the merchant&apos;s device. It does not
        upload or use unrelated SMS messages.
      </p>

      <h2>How payment data is used</h2>
      <p>
        Parsed M-Pesa confirmation details are used only to reconcile Till or Paybill payments, including matching a
        payment to a customer credit balance when there is an unambiguous local match. The merchant can disable this
        feature at any time in Settings. Manual M-Pesa receipt-code entry remains available without SMS access.
      </p>

      <h2>Data control</h2>
      <p>
        Reconciliation records remain on the merchant&apos;s device and may be synchronised to the merchant&apos;s MobiDuka
        business account for ledger continuity. Merchants can clear local application data by uninstalling the app or
        using supported data-management controls. Do not enable SMS reconciliation on a device you do not control.
      </p>

      <h2>Contact</h2>
      <p>For privacy questions, contact your MobiDuka business administrator or support channel.</p>

      <p>
        See also the <Link href="/terms">MobiDuka POS Terms and Conditions</Link>.
      </p>
    </main>
  );
}
