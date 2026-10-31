"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, saveClientSession, savePinLoginContext, type ClientSession } from "../../lib/client-api";
import { getBusinessStarterTemplate } from "../../lib/business-starter-templates";
import { useColors } from "../utils/theme";

type PublicPlan = {
  name: string
  publicMonthlyPriceKsh: number | null
  annualPriceKsh: number | null
  subtitle: string
  onlineCheckoutEnabled: boolean
}

type CheckoutState = {
  planName: string
  billingPeriod: "monthly" | "annual"
  paymentId?: string
  status?: string
}

export default function SignupPage({
  registrationEnabled,
}: {
  registrationEnabled: boolean
}) {
  const router = useRouter();
  const c = useColors();
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [includeStarterCatalog, setIncludeStarterCatalog] = useState(true);
  const [password, setPassword] = useState("");
  const [initialPin, setInitialPin] = useState("");
  const [planName, setPlanName] = useState("Basic");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [plansError, setPlansError] = useState("");
  const [error, setError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkout, setCheckout] = useState<CheckoutState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedPlan = params.get("plan");
    const requestedBilling = params.get("billing");
    if (requestedPlan) setPlanName(requestedPlan);
    if (requestedBilling === "annual") setBillingPeriod("annual");

    const controller = new AbortController();
    void fetch("/api/plans", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as { plans?: PublicPlan[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to load plans.");
        setPlans(result.plans ?? []);
      })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        setPlansError(reason instanceof Error ? reason.message : "Unable to load plans.");
      });
    return () => controller.abort();
  }, []);

  const selectedPlan = plans.find((plan) => plan.name === planName);
  const starterTemplate = getBusinessStarterTemplate(businessType);
  const requiresPayment = planName !== "Basic";
  const canCheckout = !!selectedPlan?.onlineCheckoutEnabled &&
    (billingPeriod === "annual"
      ? selectedPlan.annualPriceKsh !== null
      : selectedPlan.publicMonthlyPriceKsh !== null);

  const beginCheckout = async (target: CheckoutState) => {
    setSubmitting(true);
    setCheckoutError("");
    try {
      const result = await apiFetch<{
        paymentId: string
        planName: string
        amountKsh: number
        status: string
        message?: string
      }>("/api/subscription/checkout", {
        method: "POST",
        body: JSON.stringify({
          planName: target.planName,
          billingPeriod: target.billingPeriod,
          phoneNumber: phone,
        }),
      });
      setCheckout({ ...target, paymentId: result.paymentId, status: result.status });
    } catch (reason) {
      setCheckout(target);
      setCheckoutError(reason instanceof Error ? reason.message : "Unable to start M-PESA checkout.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!checkout?.paymentId) return;
    const paymentId = checkout.paymentId;
    let active = true;
    let settled = false;
    const poll = async () => {
      if (settled) return;
      try {
        const result = await apiFetch<{
          payment: { status: string; resultDescription: string | null; receiptNumber: string | null }
        }>(`/api/subscription/checkout?paymentId=${encodeURIComponent(paymentId)}`);
        if (!active) return;
        setCheckout((current) => current ? { ...current, status: result.payment.status } : current);
        if (result.payment.status === "PAID") {
          settled = true;
          router.replace("/app");
        } else if (result.payment.status === "FAILED" || result.payment.status === "REVIEW") {
          settled = true;
          setCheckoutError(result.payment.resultDescription ?? "The payment was not confirmed. You can try again.");
        }
      } catch (reason) {
        if (active) setCheckoutError(reason instanceof Error ? reason.message : "Unable to check payment status.");
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [checkout?.paymentId, router]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const email = ownerEmail.trim().toLowerCase();
    try {
      if (checkout) {
        await beginCheckout(checkout);
        return;
      }
      const registration = await apiFetch<{
        businessId: string
        requiresPayment: boolean
        planName: string
      }>("/api/auth/onboard", {
        method: "POST",
        body: JSON.stringify({
          businessName,
          ownerName,
          ownerEmail: email,
          phone,
          businessType,
          includeStarterCatalog,
          password,
          initialPin: initialPin || undefined,
          planName,
          billingPeriod,
        }),
      });
      const session = await apiFetch<ClientSession>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier: email, password }),
      });
      saveClientSession(session);
      savePinLoginContext({
        identifier: email,
        businessId: registration.businessId,
        displayName: ownerName.trim(),
      });
      if (registration.requiresPayment) {
        const nextCheckout = { planName: registration.planName, billingPeriod };
        setCheckout(nextCheckout);
        await beginCheckout(nextCheckout);
      } else {
        router.replace("/app");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create your account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: c.bg, color: c.text, colorScheme: c.isDark ? "dark" : "light", transition: "background-color 160ms ease, color 160ms ease" }}>
      {registrationEnabled ? (
        checkout ? (
          <section style={cardStyle(c)}>
            <Link href="/" style={homeLinkStyle(c)}>← MobiDuka home</Link>
            <img src="/mobiduka_icon.svg" width="42" height="42" alt="MobiDuka"/>
            <h1 style={{ margin: 0, fontSize: 21 }}>{checkout.status === "PAID" ? "Payment confirmed" : "Complete your subscription payment"}</h1>
            <p style={copyStyle(c)}>
              {checkout.paymentId
                ? `We sent an M-PESA prompt for the ${checkout.planName} ${checkout.billingPeriod} plan to ${phone}. Enter your M-PESA PIN on your phone. Your subscription activates only after the payment is confirmed.`
                : `We could not start the M-PESA prompt for the ${checkout.planName} plan. Check your connection and try again.`}
            </p>
            <label style={fieldStyle(c)}>Payment phone number<input type="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel"/></label>
            {checkout.status === "PENDING" && <p role="status" style={copyStyle(c)}>Waiting for payment confirmation…</p>}
            {checkout.status === "REVIEW" && <p role="alert" style={copyStyle(c)}>Payment needs manual reconciliation. Please contact MobiDuka support and provide your M-PESA receipt.</p>}
            {checkoutError && <div role="alert" style={errorStyle(c)}>{checkoutError}</div>}
            <button type="button" disabled={submitting || checkout.status === "PAID" || checkout.status === "REVIEW"} onClick={() => void beginCheckout(checkout)} style={buttonStyle(c)}>
              {submitting ? "Sending prompt…" : checkout.status === "FAILED" ? "Try payment again" : checkout.status === "REVIEW" ? "Contact support" : "Resend M-PESA prompt"}
            </button>
            <Link href="/login" style={{ color: c.primary, fontSize: 13, fontWeight: 700 }}>Already have an account? Log in</Link>
          </section>
        ) : (
          <form onSubmit={submit} style={cardStyle(c)}>
            <Link href="/" style={homeLinkStyle(c)}>← MobiDuka home</Link>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img src="/mobiduka_icon.svg" width="42" height="42" alt="MobiDuka"/>
              <div><strong style={{ display: "block", fontSize: 20 }}>{requiresPayment ? `Choose ${planName}` : "Start your 14-day trial"}</strong><span style={{ color: c.muted, fontSize: 12 }}>Create a business workspace for your team.</span></div>
            </div>
            {plansError && <div role="alert" style={errorStyle(c)}>{plansError}</div>}
            <label style={fieldStyle(c)}>Plan
              <select value={planName} onChange={(event) => setPlanName(event.target.value)}>
                {plans.map((plan) => <option key={plan.name} value={plan.name} disabled={plan.name !== "Basic" && !plan.onlineCheckoutEnabled}>{plan.name}{plan.name === "Basic" ? " — 14-day trial" : plan.onlineCheckoutEnabled ? "" : " — checkout unavailable"}</option>)}
              </select>
            </label>
            {requiresPayment && (
              <>
                <label style={fieldStyle(c)}>Billing period
                  <select value={billingPeriod} onChange={(event) => setBillingPeriod(event.target.value as "monthly" | "annual")}>
                    <option value="monthly">Monthly — {selectedPlan?.publicMonthlyPriceKsh ? `KSh ${selectedPlan.publicMonthlyPriceKsh.toLocaleString()}` : "price unavailable"}</option>
                    <option value="annual" disabled={selectedPlan?.annualPriceKsh === null || selectedPlan?.annualPriceKsh === undefined}>Annual — {selectedPlan?.annualPriceKsh ? `KSh ${selectedPlan.annualPriceKsh.toLocaleString()}` : "not configured"}</option>
                  </select>
                </label>
                <p style={{ ...copyStyle(c), margin: 0 }}>Payment is collected by MobiDuka via M-PESA. No POS merchant credentials are used.</p>
              </>
            )}
            <label style={fieldStyle(c)}>Business name<input required value={businessName} onChange={event => setBusinessName(event.target.value)} autoComplete="organization"/></label>
            <label style={fieldStyle(c)}>Owner full name<input required value={ownerName} onChange={event => setOwnerName(event.target.value)} autoComplete="name"/></label>
            <label style={fieldStyle(c)}>Owner email<input required type="email" value={ownerEmail} onChange={event => setOwnerEmail(event.target.value)} autoComplete="email"/></label>
            <label style={fieldStyle(c)}>Phone number<input required={requiresPayment} type="tel" value={phone} onChange={event => setPhone(event.target.value)} autoComplete="tel"/></label>
            <label style={fieldStyle(c)}>Business type
              <select required value={businessType} onChange={event => setBusinessType(event.target.value)}>
                <option value="">Select a business type</option>
                <option value="duka">Duka</option>
                <option value="kiosk">Kiosk</option>
                <option value="mini-shop">Mini-shop</option>
                <option value="pharmacy">Pharmacy</option>
                <option value="agrovet">Agrovet</option>
                <option value="retail-chain">Growing multi-branch retailer</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label style={{ ...fieldStyle(c), display: "flex", alignItems: "flex-start", gap: 9, lineHeight: 1.5 }}>
              <input
                type="checkbox"
                checked={includeStarterCatalog}
                onChange={event => setIncludeStarterCatalog(event.target.checked)}
                style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2 }}
              />
                <span style={{ color: c.text }}>
                Add a {starterTemplate?.label ?? "business"} starter catalog
                <span style={{ display: "block", color: c.muted, fontWeight: 400 }}>
                  {starterTemplate
                    ? `${starterTemplate.categories.length} categories and ${starterTemplate.products.length} sample items. Samples have zero price and stock; review and edit before selling.`
                    : "Choose a business type to preview its starter catalog."}
                </span>
              </span>
            </label>
            <label style={fieldStyle(c)}>Password (at least 12 characters)<input required type="password" minLength={12} value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password"/></label>
            <label style={fieldStyle(c)}>Optional cashier PIN (4 digits)<input type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={initialPin} onChange={event => setInitialPin(event.target.value.replace(/\D/g, "").slice(0, 4))} autoComplete="off"/></label>
            {error && <div role="alert" style={errorStyle(c)}>{error}</div>}
            <button type="submit" disabled={submitting || (requiresPayment && !canCheckout)} style={buttonStyle(c)}>
              {submitting ? "Processing…" : requiresPayment ? `Continue to ${billingPeriod} M-PESA checkout` : "Create workspace and start trial"}
            </button>
            {requiresPayment && !canCheckout && <p role="status" style={copyStyle(c)}>This plan or billing period is not available for online checkout yet.</p>}
            <p style={{ margin: 0, textAlign: "center", color: c.muted, fontSize: 12 }}>
              Already have an account? <Link href="/login" style={{ color: c.primary, fontWeight: 700 }}>Log in</Link>
            </p>
            <p style={{ margin: 0, color: c.muted, fontSize: 11, lineHeight: 1.5 }}>Your business data is preserved if a subscription expires. New sales and synchronization pause until an owner activates a subscription.</p>
          </form>
        )
      ) : (
        <section style={cardStyle(c)}>
          <Link href="/" style={homeLinkStyle(c)}>← MobiDuka home</Link>
          <img src="/mobiduka_icon.svg" width="42" height="42" alt="MobiDuka"/>
          <h1 style={{ margin: 0, fontSize: 21 }}>Online registration is currently unavailable</h1>
          <p style={copyStyle(c)}>New business registration is paused. Existing customers can continue to sign in.</p>
          <Link href="/login" style={{ color: c.primary, fontSize: 13, fontWeight: 700 }}>Log in to MobiDuka</Link>
        </section>
      )}
    </main>
  );
}

const cardStyle = (c: ReturnType<typeof useColors>) => ({
  width: "min(100%, 520px)",
  display: "grid",
  gap: 14,
  padding: 32,
  border: `1px solid ${c.border}`,
  borderRadius: 18,
  background: c.card,
  color: c.text,
  boxShadow: c.shadow,
})

const homeLinkStyle = (c: ReturnType<typeof useColors>) => ({
  color: c.primary,
  fontSize: 12,
  fontWeight: 700,
  textDecoration: "none",
})

const copyStyle = (c: ReturnType<typeof useColors>) => ({
  margin: 0,
  color: c.muted,
  fontSize: 13,
  lineHeight: 1.6,
})

const errorStyle = (c: ReturnType<typeof useColors>) => ({
  padding: 11,
  borderRadius: 8,
  background: c.errorBg,
  color: c.error,
  fontSize: 12,
})

const buttonStyle = (c: ReturnType<typeof useColors>) => ({
  minHeight: 46,
  border: 0,
  borderRadius: 9,
  background: c.primary,
  color: c.primaryText,
  fontWeight: 800,
  cursor: "pointer",
})

const fieldStyle = (c: ReturnType<typeof useColors>) => ({
  display: "grid",
  gap: 6,
  color: c.text,
  fontSize: 12,
  fontWeight: 700,
})
