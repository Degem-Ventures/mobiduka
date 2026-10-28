"use client"

import { useEffect, useState } from "react"

type EditablePlan = {
  id: string
  name: string
  monthlyPriceKsh: number
  publicMonthlyPriceKsh: number | null
  annualPriceKsh: number | null
  subtitle: string
  audience: string
  color: "blue" | "green" | "gold"
  adminFeatures: string[]
  marketingFeatures: string[]
  featured: boolean
  cta: string
  onlineCheckoutEnabled: boolean
  isActive: boolean
}

function asFeatureLines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean)
}

export default function PlanCatalogEditor() {
  const [plans, setPlans] = useState<EditablePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [savingPlan, setSavingPlan] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const loadPlans = async () => {
    setError("")
    const response = await fetch("/api/admin/plans", { cache: "no-store" })
    const result = await response.json() as { plans?: EditablePlan[]; error?: string }
    if (!response.ok) throw new Error(result.error ?? "Unable to load subscription plans.")
    setPlans(result.plans ?? [])
  }

  useEffect(() => {
    void loadPlans()
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load subscription plans."))
      .finally(() => setLoading(false))
  }, [])

  const changePlan = (name: string, change: Partial<EditablePlan>) => {
    setPlans((current) => current.map((plan) => plan.name === name ? { ...plan, ...change } : plan))
    setNotice("")
  }

  const savePlan = async (plan: EditablePlan) => {
    setSavingPlan(plan.name)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/admin/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plan),
      })
      const result = await response.json() as { plan?: EditablePlan; error?: string }
      if (!response.ok) throw new Error(result.error ?? `Unable to save ${plan.name}.`)
      const savedPlan = result.plan
      if (savedPlan) {
        setPlans((current) => current.map((entry) => entry.name === plan.name ? savedPlan : entry))
      }
      setNotice(`${plan.name} plan saved. Public marketing and signup use the updated catalog.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Unable to save ${plan.name}.`)
    } finally {
      setSavingPlan("")
    }
  }

  if (loading) return <section className="admin-table-panel">Loading configurable plans…</section>

  return (
    <section className="admin-table-panel" aria-labelledby="plan-catalog-title">
      <div className="admin-table-title-row">
        <div><span>Commercial catalog</span><h2 id="plan-catalog-title">Plans shown to customers</h2></div>
        <button className="admin-secondary-button" type="button" onClick={() => void loadPlans().catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to reload plans."))}>Refresh</button>
      </div>
      <p>Internal prices stay private. Marketing and checkout use only approved public prices. Platform M-PESA credentials must also be configured in deployment secrets before online checkout can accept payments. Feature lists are customer-facing descriptions; they do not enforce product limits.</p>
      {error && <div className="admin-empty-state" role="alert">{error}</div>}
      {notice && <div className="admin-empty-state" role="status">{notice}</div>}
      <div style={{ display: "grid", gap: 18 }}>
        {plans.map((plan) => (
          <article key={plan.name} style={{ display: "grid", gap: 12, padding: 18, border: "1px solid #dce3ee", borderRadius: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h3 style={{ margin: 0 }}>{plan.name}</h3>
              <button className="admin-secondary-button" type="button" disabled={savingPlan === plan.name} onClick={() => void savePlan(plan)}>
                {savingPlan === plan.name ? "Saving…" : "Save plan"}
              </button>
            </div>
            <div style={fieldGrid}>
              <label style={fieldStyle}>Internal monthly cost (KSh)<input type="number" min="1" step="1" value={plan.monthlyPriceKsh} onChange={(event) => changePlan(plan.name, { monthlyPriceKsh: Number(event.target.value) })}/></label>
              <label style={fieldStyle}>Public monthly price (KSh)<input type="number" min="1" step="1" placeholder="Leave blank for price on request" value={plan.publicMonthlyPriceKsh ?? ""} onChange={(event) => changePlan(plan.name, { publicMonthlyPriceKsh: event.target.value ? Number(event.target.value) : null })}/></label>
              <label style={fieldStyle}>Public annual price (KSh)<input type="number" min="1" step="1" placeholder="Optional" value={plan.annualPriceKsh ?? ""} onChange={(event) => changePlan(plan.name, { annualPriceKsh: event.target.value ? Number(event.target.value) : null })}/></label>
              <label style={fieldStyle}>Subtitle<input maxLength={100} value={plan.subtitle} onChange={(event) => changePlan(plan.name, { subtitle: event.target.value })}/></label>
              <label style={fieldStyle}>Audience<input maxLength={120} value={plan.audience} onChange={(event) => changePlan(plan.name, { audience: event.target.value })}/></label>
              <label style={fieldStyle}>Call to action<input maxLength={60} value={plan.cta} onChange={(event) => changePlan(plan.name, { cta: event.target.value })}/></label>
              <label style={fieldStyle}>Color<select value={plan.color} onChange={(event) => changePlan(plan.name, { color: event.target.value as EditablePlan["color"] })}><option value="blue">Blue</option><option value="green">Green</option><option value="gold">Gold</option></select></label>
              <label style={fieldStyle}>Admin features (one per line)<textarea rows={4} value={plan.adminFeatures.join("\n")} onChange={(event) => changePlan(plan.name, { adminFeatures: asFeatureLines(event.target.value) })}/></label>
              <label style={fieldStyle}>Marketing features (one per line)<textarea rows={4} value={plan.marketingFeatures.join("\n")} onChange={(event) => changePlan(plan.name, { marketingFeatures: asFeatureLines(event.target.value) })}/></label>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
              <label><input type="checkbox" checked={plan.featured} onChange={(event) => changePlan(plan.name, { featured: event.target.checked })}/> Feature this plan</label>
              <label><input type="checkbox" checked={plan.isActive} onChange={(event) => changePlan(plan.name, { isActive: event.target.checked })}/> Show on marketing</label>
              <label><input type="checkbox" checked={plan.onlineCheckoutEnabled} onChange={(event) => changePlan(plan.name, { onlineCheckoutEnabled: event.target.checked })}/> Enable online checkout</label>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

const fieldGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 12,
} as const

const fieldStyle = {
  display: "grid",
  gap: 6,
  color: "#44536c",
  fontSize: 12,
  fontWeight: 700,
} as const
