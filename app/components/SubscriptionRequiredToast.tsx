"use client"

import { useEffect, useRef, useState } from "react"
import { SUBSCRIPTION_REQUIRED_EVENT } from "../../lib/client-api"

type SubscriptionRequiredDetail = { message?: string }

export default function SubscriptionRequiredToast() {
  const [message, setMessage] = useState<string | null>(null)
  const visible = useRef(false)
  const timeout = useRef<number | null>(null)

  useEffect(() => {
    const showToast = (event: Event) => {
      if (visible.current) return
      visible.current = true
      const detail = (event as CustomEvent<SubscriptionRequiredDetail>).detail
      setMessage(
        detail?.message ??
          "Renew your subscription to continue creating and syncing business records. Your existing data is retained.",
      )
      timeout.current = window.setTimeout(() => {
        visible.current = false
        setMessage(null)
        timeout.current = null
      }, 8000)
    }

    window.addEventListener(SUBSCRIPTION_REQUIRED_EVENT, showToast)
    return () => {
      window.removeEventListener(SUBSCRIPTION_REQUIRED_EVENT, showToast)
      if (timeout.current !== null) window.clearTimeout(timeout.current)
    }
  }, [])

  if (!message) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: "fixed",
        zIndex: 10000,
        top: 18,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(440px, calc(100vw - 32px))",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "14px 16px",
        border: "1px solid rgba(212, 175, 55, 0.65)",
        borderLeft: "5px solid #D4AF37",
        borderRadius: 8,
        background: "#0D1B3D",
        color: "#FFFFFF",
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.28)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
          Subscription renewal required
        </strong>
        <span style={{ fontSize: 13, lineHeight: 1.45 }}>{message}</span>
      </div>
      <button
        type="button"
        aria-label="Dismiss subscription warning"
        onClick={() => {
          visible.current = false
          setMessage(null)
          if (timeout.current !== null) window.clearTimeout(timeout.current)
          timeout.current = null
        }}
        style={{
          flex: "0 0 auto",
          border: 0,
          padding: "0 2px",
          background: "transparent",
          color: "#FFFFFF",
          fontSize: 22,
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>
  )
}
