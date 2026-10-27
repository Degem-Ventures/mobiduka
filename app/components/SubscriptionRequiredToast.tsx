"use client"

import { useEffect, useRef, useState } from "react"
import { SUBSCRIPTION_REQUIRED_EVENT } from "../../lib/client-api"

export default function SubscriptionRequiredToast({
  enabled,
}: {
  enabled: boolean
}) {
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<number | null>(null)
  const lastShownAtRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    const showNotice = () => {
      const now = Date.now()
      if (now - lastShownAtRef.current < 30_000) return
      lastShownAtRef.current = now
      setVisible(true)
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
      timeoutRef.current = window.setTimeout(() => {
        setVisible(false)
        timeoutRef.current = null
      }, 8_000)
    }

    window.addEventListener(SUBSCRIPTION_REQUIRED_EVENT, showNotice)
    return () => {
      window.removeEventListener(SUBSCRIPTION_REQUIRED_EVENT, showNotice)
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [enabled])

  if (!visible || !enabled) return null

  const dismiss = () => {
    setVisible(false)
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: "fixed",
        top: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20_000,
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        width: "min(440px, calc(100vw - 32px))",
        padding: "14px 16px",
        border: "1px solid #F3D28A",
        borderRadius: 12,
        background: "#FFF8E7",
        color: "#5B4314",
        boxShadow: "0 8px 28px rgba(13, 27, 61, 0.22)",
        fontFamily: "inherit",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>
        ⚠
      </span>
      <span style={{ flex: 1, fontSize: 13, lineHeight: 1.45 }}>
        <strong style={{ display: "block", marginBottom: 2 }}>
          Subscription renewal required
        </strong>
        This change was not saved. Renew your subscription to restore write
        access. Your existing records remain available.
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss subscription notice"
        style={{
          border: 0,
          padding: 0,
          background: "transparent",
          color: "inherit",
          cursor: "pointer",
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  )
}
