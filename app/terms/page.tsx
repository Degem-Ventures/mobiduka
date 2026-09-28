import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms and Conditions | MobiDuka POS",
  description: "Terms and conditions for using MobiDuka POS.",
};

const pageStyle = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "48px 20px",
  color: "#0D1B3D",
  lineHeight: 1.6,
};

export default function TermsPage() {
  return (
    <main style={pageStyle}>
      <h1>MobiDuka POS Terms and Conditions</h1>
      <p>Last updated: September 28, 2026</p>

      <h2>Acceptance of these terms</h2>
      <p>
        By creating an account, accessing, or using MobiDuka POS, you agree to
        these Terms and Conditions. If you use MobiDuka for a business, you
        confirm that you are authorised to accept these terms for that business.
      </p>

      <h2>Using MobiDuka</h2>
      <p>
        MobiDuka provides point-of-sale, inventory, customer-credit, reporting,
        and related business-management tools. You are responsible for the
        accuracy of the sales, stock, customer, payment, tax, and business data
        entered by your team.
      </p>

      <h2>Accounts and security</h2>
      <p>
        Keep your login credentials, PINs, and devices secure. You are
        responsible for activity performed through your business account and for
        promptly removing access for staff who no longer need it.
      </p>

      <h2>Payments and M-Pesa reconciliation</h2>
      <p>
        Payment records and M-Pesa receipt codes should be verified by the
        merchant before a sale is treated as settled. Optional SMS
        reconciliation is a merchant-controlled aid for matching payment
        confirmations; it does not replace Safaricom, bank, or payment-provider
        settlement records.
      </p>

      <h2>Offline use and synchronisation</h2>
      <p>
        Some features can continue using locally stored data while offline.
        You are responsible for reconnecting devices so queued changes can be
        synchronised. Conflicts, incomplete local data, or unavailable third
        party services may require review before records are finalised.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Do not use MobiDuka unlawfully, attempt to access another business&apos;s
        data, disrupt the service, reverse engineer it where prohibited by law,
        or upload harmful content. You must comply with applicable tax,
        consumer-protection, privacy, and payment regulations.
      </p>

      <h2>Availability and changes</h2>
      <p>
        We may change, improve, suspend, or discontinue features when needed to
        operate and secure the service. We may update these terms; continued use
        after a published update means you accept the revised terms.
      </p>

      <h2>Privacy</h2>
      <p>
        Your use of MobiDuka is also governed by our{" "}
        <Link href="/privacy">Privacy Policy</Link>, which explains how the
        application handles business and optional M-Pesa reconciliation data.
      </p>

      <h2>Contact</h2>
      <p>
        For questions about these terms, contact your MobiDuka business
        administrator or support channel.
      </p>
    </main>
  );
}
