"use client"

import { useCallback, useEffect, useState } from "react"

type ContactMessage = {
  id: string
  fullName: string
  businessName: string
  email: string
  phone: string
  businessType: string | null
  message: string
  status: "NEW" | "READ" | "RESOLVED"
  emailSentAt: string | null
  createdAt: string
}

type InboxData = {
  messages: ContactMessage[]
  total: number
  metrics: { new: number; read: number; resolved: number }
}

export default function ContactInbox() {
  const [data, setData] = useState<InboxData | null>(null)
  const [selectedId, setSelectedId] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/contact-messages", { cache: "no-store" })
      const result = await response.json() as InboxData & { error?: string }
      if (!response.ok) throw new Error(result.error ?? "Unable to load contact messages.")
      setData(result)
      setSelectedId(current => result.messages.some(message => message.id === current)
        ? current
        : result.messages[0]?.id ?? "")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load contact messages.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const selected = data?.messages.find(message => message.id === selectedId)

  const updateStatus = async (id: string, status: "READ" | "RESOLVED") => {
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/admin/contact-messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? "Unable to update this message.")
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update this message.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-page-stack">
      <section className="ops-kpi-grid">
        {[
          ["New messages", data?.metrics.new ?? "—"],
          ["Read", data?.metrics.read ?? "—"],
          ["Resolved", data?.metrics.resolved ?? "—"],
          ["Total received", data?.total ?? "—"],
        ].map(([label, value]) => (
          <article className="ops-kpi" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <div><i className="info" />Website enquiries</div>
          </article>
        ))}
      </section>

      <section className="ops-table-panel">
        <div className="ops-table-toolbar">
          <div>
            <strong>Website enquiries</strong>
            <span>Messages submitted through the public MobiDuka contact form</span>
          </div>
          <button onClick={() => void refresh()} disabled={loading}>Refresh inbox</button>
        </div>
        {error && <div className="admin-empty-state" role="alert">{error}</div>}
        {loading && <div className="admin-empty-state">Loading contact messages…</div>}
        {!loading && !error && !data?.messages.length && (
          <div className="admin-empty-state">No website contact messages have been received yet.</div>
        )}
        {!loading && !error && !!data?.messages.length && (
          <div className="admin-table-scroll">
            <table className="admin-table ops-table">
              <thead><tr><th>Received</th><th>Name</th><th>Business</th><th>Email</th><th>Phone</th><th>Status</th></tr></thead>
              <tbody>
                {data.messages.map(message => (
                  <tr
                    key={message.id}
                    onClick={() => {
                      setSelectedId(message.id)
                      if (message.status === "NEW") void updateStatus(message.id, "READ")
                    }}
                    aria-selected={message.id === selectedId}
                    style={{ cursor: "pointer" }}
                  >
                    <td>{new Date(message.createdAt).toLocaleString()}</td>
                    <td>{message.fullName}</td>
                    <td>{message.businessName}</td>
                    <td>{message.email}</td>
                    <td>{message.phone}</td>
                    <td><span className={`ops-badge ${message.status === "RESOLVED" ? "healthy" : message.status === "NEW" ? "warning" : "info"}`}>{message.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <section className="ops-table-panel">
          <div className="ops-table-toolbar">
            <div><strong>{selected.fullName}</strong><span>{selected.businessName} · {new Date(selected.createdAt).toLocaleString()}</span></div>
            <div>
              {selected.status !== "RESOLVED" && <button onClick={() => void updateStatus(selected.id, "RESOLVED")} disabled={saving}>Resolve</button>}
              {selected.status === "RESOLVED" && <span className="ops-badge healthy">RESOLVED</span>}
            </div>
          </div>
          <div className="admin-detail-list">
            <div><span>Email</span><strong><a href={`mailto:${selected.email}`}>{selected.email}</a></strong></div>
            <div><span>Phone</span><strong><a href={`tel:${selected.phone}`}>{selected.phone}</a></strong></div>
            <div><span>Business type</span><strong>{selected.businessType || "Not specified"}</strong></div>
            <div><span>Email notification</span><strong>{selected.emailSentAt ? `Sent ${new Date(selected.emailSentAt).toLocaleString()}` : "Not delivered; message is saved in this inbox"}</strong></div>
          </div>
          <div style={{ padding: "16px 20px", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{selected.message}</div>
        </section>
      )}
    </div>
  )
}
