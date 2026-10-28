"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { apiFetch } from "../../../lib/client-api"

type PublicPlan = {
  name: string
  publicMonthlyPriceKsh: number | null
  annualPriceKsh: number | null
  onlineCheckoutEnabled: boolean
}

type Subscription = {
  planType: string
  status: string
  trialEndsAt: string | null
  currentPeriodEndsAt: string | null
  licenseCost: number
}

type Payment = {
  id: string
  planName: string
  amountKsh: number
  status: string
  resultDescription: string | null
  receiptNumber: string | null
}

export default function SubscriptionBillingPage() {
  const [plans, setPlans] = useState<PublicPlan[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [planName, setPlanName] = useState("")
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [payment, setPayment] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    void Promise.all([
      apiFetch<{ plans: PublicPlan[] }>("/api/plans"),
      apiFetch<{ subscription: Subscription }>("/api/subscription"),
    ]).then(([catalog, current]) => {
      if (!active) return
      setPlans(catalog.plans)
      setSubscription(current.subscription)
      setPlanName(current.subscription.planType[0] + current.subscription.planType.slice(1).toLowerCase())
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Unable to load subscription details.")
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  const startPayment = async () => {
    setSubmitting(true)
    setError("")
    try {
      const result = await apiFetch<{
        paymentId: string
        planName: string
        amountKsh: number
        status: string
      }>("/api/subscription/checkout", {
        method: "POST",
        body: JSON.stringify({ planName, billingPeriod, phoneNumber }),
      })
      setPayment({
        id: result.paymentId,
        planName: result.planName,
        amountKsh: result.amountKsh,
        status: result.status,
        resultDescription: null,
        receiptNumber: null,
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to start M-PESA checkout.")
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!payment || payment.status !== "PENDING") return
    let active = true
    let settled = false
    const poll = async () => {
      if (settled) return
      try {
        const result = await apiFetch<{ payment: Payment }>(
          `/api/subscription/checkout?paymentId=${encodeURIComponent(payment.id)}`,
        )
        if (!active) return
        setPayment(result.payment)
        if (result.payment.status === "PAID") {
          settled = true
          const current = await apiFetch<{ subscription: Subscription }>("/api/subscription")
          if (active) setSubscription(current.subscription)
        } else if (result.payment.status === "FAILED" || result.payment.status === "REVIEW") {
          settled = true
          setError(result.payment.resultDescription ?? "Payment was not confirmed.")
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to check payment status.")
      }
    }
    void poll()
    const timer = window.setInterval(() => void poll(), 10_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [payment?.id, payment?.status])

  const selectedPlan = plans.find((plan) => plan.name === planName)
  const amount = billingPeriod === "annual"
    ? selectedPlan?.annualPriceKsh
    : selectedPlan?.publicMonthlyPriceKsh
  const checkoutEnabled = !!selectedPlan?.onlineCheckoutEnabled && amount !== null && amount !== undefined

  if (loading) return <main style={pageStyle}><section style={cardStyle}>Loading subscription details…</section></main>

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <Link href="/app" style={{ color: "#123a8f", fontWeight: 700, textDecoration: "none" }}>← Back to MobiDuka</Link>
        <img src="/mobiduka_icon.svg" width="42" height="42" alt="MobiDuka"/>
        <h1 style={{ margin: 0 }}>Subscription & billing</h1>
        {subscription && <p style={copyStyle}>Current plan: <strong>{subscription.planType}</strong> · {subscription.status}. {subscription.currentPeriodEndsAt ? `Period ends ${new Date(subscription.currentPeriodEndsAt).toLocaleDateString("en-KE")}.` : subscription.trialEndsAt ? `Trial ends ${new Date(subscription.trialEndsAt).toLocaleDateString("en-KE")}.` : ""}</p>}
        {error && <div role="alert" style={errorStyle}>{error}</div>}
        {payment && <div role={payment.status === "FAILED" || payment.status === "REVIEW" ? "alert" : "status"} style={copyStyle}>
          {payment.status === "PENDING" && `M-PESA prompt sent for KSh ${payment.amountKsh.toLocaleString()}. Approve it on your phone. Waiting for confirmation…`}
          {payment.status === "PAID" && `Payment confirmed${payment.receiptNumber ? ` · receipt ${payment.receiptNumber}` : ""}. Your subscription is active.`}
          {payment.status === "FAILED" && "Payment failed. You can try again."}
          {payment.status === "REVIEW" && "Payment requires manual reconciliation. Contact MobiDuka support."}
        </div>}
        <label style={fieldStyle}>Plan
          <select value={planName} onChange={(event) => { setPlanName(event.target.value); setPayment(null); setError("") }}>
            {plans.map((plan) => <option key={plan.name} value={plan.name} disabled={!plan.onlineCheckoutEnabled}>{plan.name}</option>)}
          </select>
        </label>
        <label style={fieldStyle}>Billing period
          <select value={billingPeriod} onChange={(event) => { setBillingPeriod(event.target.value as "monthly" | "annual"); setPayment(null); setError("") }}>
            <option value="monthly">Monthly</option>
            <option value="annual" disabled={selectedPlan?.annualPriceKsh === null || selectedPlan?.annualPriceKsh === undefined}>Annual</option>
          </select>
        </label>
        <label style={fieldStyle}>M-PESA phone number<input type="tel" required value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} autoComplete="tel"/></label>
        {amount !== null && amount !== undefined && <p style={copyStyle}>Amount: <strong>KSh {amount.toLocaleString()}</strong></p>}
        <button type="button" disabled={submitting || !checkoutEnabled || payment?.status === "PENDING" || payment?.status === "PAID" || payment?.status === "REVIEW"} onClick={() => void startPayment()} style={buttonStyle}>
          {submitting ? "Sending prompt…" : payment?.status === "PAID" ? "Payment complete" : payment?.status === "REVIEW" ? "Contact support" : "Pay with M-PESA"}
        </button>
        {!checkoutEnabled && <p style={copyStyle}>This plan or billing period is not available for online checkout yet.</p>}
      </section>
    </main>
  )
}

const pageStyle = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  background: "#f3f6fb",
  color: "#0d1b3d",
} as const

const cardStyle = {
  width: "min(100%, 560px)",
  display: "grid",
  gap: 16,
  padding: 32,
  border: "1px solid #dce3ee",
  borderRadius: 18,
  background: "white",
  boxShadow: "0 20px 55px rgba(13,27,61,.1)",
} as const

const fieldStyle = {
  display: "grid",
  gap: 6,
  color: "#44536c",
  fontSize: 12,
  fontWeight: 700,
} as const

const copyStyle = {
  margin: 0,
  color: "#65738b",
  fontSize: 13,
  lineHeight: 1.6,
} as const

const errorStyle = {
  padding: 11,
  borderRadius: 8,
  background: "#fff1f0",
  color: "#a52822",
  fontSize: 12,
} as const

const buttonStyle = {
  minHeight: 46,
  border: 0,
  borderRadius: 9,
  background: "#123a8f",
  color: "white",
  fontWeight: 800,
} as const
