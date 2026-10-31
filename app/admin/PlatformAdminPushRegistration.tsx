"use client"

import { useEffect, useRef, useState } from "react"
import { getToken, isSupported, onMessage } from "firebase/messaging"
import type { Unsubscribe } from "firebase/messaging"
import { getFirebaseMessaging } from "@/lib/firebase-web"

type PushPermission = NotificationPermission | "unsupported"

export default function PlatformAdminPushRegistration() {
  const [isReady, setIsReady] = useState(false)
  const [permission, setPermission] = useState<PushPermission | null>(null)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [message, setMessage] = useState("")
  const registerRef = useRef<(() => Promise<void>) | null>(null)
  const messageListenerRef = useRef<Unsubscribe | null>(null)
  const activeRef = useRef(true)

  useEffect(() => {
    activeRef.current = true

    const registerSubscription = async () => {
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
      if (!vapidKey || !(await isSupported())) {
        if (activeRef.current) {
          setPermission("unsupported")
          setMessage("Browser push notifications are unavailable on this device.")
          setIsReady(true)
        }
        return
      }

      try {
        const registration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
        )
        const messaging = await getFirebaseMessaging()
        const token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: registration,
        })
        if (!token) throw new Error("Firebase did not provide a browser token.")

        const response = await fetch("/api/admin/push-subscriptions", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        })
        if (!response.ok) {
          const result = await response.json().catch(() => ({})) as { error?: string }
          throw new Error(result.error ?? "Unable to save this browser subscription.")
        }
        if (!activeRef.current) return

        setIsSubscribed(true)
        setMessage("")
        messageListenerRef.current?.()
        messageListenerRef.current = onMessage(messaging, (payload) => {
          if (Notification.permission !== "granted") return
          const notification = new Notification(
            payload.notification?.title ?? "MobiDuka support",
            {
              body: payload.notification?.body ?? "A new support request is ready for review.",
              icon: "/icons/icon-192.png",
            },
          )
          notification.onclick = () => {
            window.focus()
            window.location.assign("/admin")
            notification.close()
          }
        })
      } catch (error) {
        if (!activeRef.current) return
        console.error("Platform admin browser push setup failed.", error)
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to enable support alerts in this browser.",
        )
      } finally {
        if (activeRef.current) setIsRequesting(false)
      }
    }

    const initialize = async () => {
      if (!("Notification" in window) || !(await isSupported())) {
        setPermission("unsupported")
        setMessage("Browser push notifications are unavailable on this device.")
        setIsReady(true)
        return
      }

      setPermission(Notification.permission)
      if (Notification.permission === "granted") {
        setIsRequesting(true)
        await registerSubscription()
      }
      if (activeRef.current) setIsReady(true)
    }

    registerRef.current = registerSubscription
    void initialize().catch((error: unknown) => {
      if (!activeRef.current) return
      console.error("Platform admin push initialization failed.", error)
      setMessage("Unable to check browser notification support.")
      setIsReady(true)
    })

    return () => {
      activeRef.current = false
      registerRef.current = null
      messageListenerRef.current?.()
      messageListenerRef.current = null
    }
  }, [])

  const enable = async () => {
    setIsRequesting(true)
    setMessage("")
    try {
      const nextPermission = await Notification.requestPermission()
      setPermission(nextPermission)
      if (nextPermission !== "granted") {
        setMessage(
          nextPermission === "denied"
            ? "Notifications are blocked for this site. Allow them in browser settings, then retry."
            : "Choose Allow in your browser to receive support alerts.",
        )
        setIsRequesting(false)
        return
      }

      await registerRef.current?.()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to enable support alerts in this browser.",
      )
      setIsRequesting(false)
    }
  }

  if (
    !isReady ||
    isSubscribed ||
    isDismissed ||
    permission === "granted" && !message
  ) {
    return null
  }

  return (
    <aside className="admin-push-prompt" role="status">
      <div>
        <strong>Enable support alerts?</strong>
        <p>{message || "Get a browser notification when someone contacts MobiDuka support."}</p>
      </div>
      <div className="admin-push-prompt-actions">
        {permission !== "unsupported" && (
          <button type="button" disabled={isRequesting} onClick={() => void enable()}>
            {isRequesting ? "Enabling…" : "Enable alerts"}
          </button>
        )}
        <button type="button" disabled={isRequesting} onClick={() => setIsDismissed(true)}>
          Not now
        </button>
      </div>
    </aside>
  )
}