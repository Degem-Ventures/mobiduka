"use client"

import { useEffect, useState } from "react"

type PaymentRecord = {
  id: string
  planName: string
  amountKsh: number
  reportedAmountKsh: number | null
  phoneNumber: string
  status: string
  resultDescription: string | null
  receiptNumber: string | null
  createdAt: string
  business: { id: string; name: string }
}

export default function PlatformPaymentLedger() {
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadPayments = async () => {
    setError("")
    const response = await fetch("/api/admin/platform-payments", { cache: "no-store" })
    const result = await response.json() as { payments?: PaymentRecord[]; error?: string }
    if (!response.ok) throw new Error(result.error ?? "Unable to load subscription payments.")
    setPayments(result.payments ?? [])
  }

  useEffect(() => {
    void loadPayments()
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load subscription payments."))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="admin-table-panel">
      <div className="admin-table-title-row">
        <div><span>M-PESA collections</span><h2>Subscription payment ledger</h2></div>
        <button className="admin-secondary-button" type="button" onClick={() => void loadPayments().catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to refresh payments."))}>Refresh</button>
      </div>
      {error && <div className="admin-empty-state" role="alert">{error}</div>}
      <div className="admin-table-scroll">
        <table className="admin-table license-table">
          <thead><tr><th>Business</th><th>Plan</th><th>Expected / received</th><th>Phone</th><th>Status</th><th>Receipt / result</th><th>Created</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7}>Loading subscription payments…</td></tr> : payments.length === 0 ? <tr><td colSpan={7}>No subscription payment attempts yet.</td></tr> : payments.map((payment) => (
              <tr key={payment.id}>
                <td><strong>{payment.business.name}</strong></td>
                <td>{payment.planName}</td>
                <td>KSh {payment.amountKsh.toLocaleString()}{payment.reportedAmountKsh !== null && payment.reportedAmountKsh !== payment.amountKsh ? ` / KSh ${payment.reportedAmountKsh.toLocaleString()}` : ""}</td>
                <td>{payment.phoneNumber}</td>
                <td><span className={`admin-status-badge ${payment.status === "PAID" ? "active" : payment.status === "REVIEW" ? "warning" : payment.status === "FAILED" ? "suspended" : "warning"}`}><i/>{payment.status}</span></td>
                <td>{payment.receiptNumber ?? payment.resultDescription ?? "Awaiting provider confirmation"}</td>
                <td>{new Date(payment.createdAt).toLocaleString("en-KE")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
