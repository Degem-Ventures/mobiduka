"use client"

import { useEffect, useRef, useState } from "react"
import { Capacitor } from "@capacitor/core"
import { PushNotifications } from "@capacitor/push-notifications"
import type { PluginListenerHandle } from "@capacitor/core"
import {
  apiFetch,
  CLIENT_SESSION_CHANGED_EVENT,
  getClientSession,
  type ClientSession,
} from "../../lib/client-api"

type PushPermission = "prompt" | "prompt-with-rationale" | "granted" | "denied"

export default function NativePushRegistration() {
  const [isNative, setIsNative] = useState(false)
  const [session, setSession] = useState<ClientSession | null>(null)
  const [permission, setPermission] = useState<PushPermission | null>(null)
  const [isChecking, setIsChecking] = useState(true)
  const [isRequesting, setIsRequesting] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [message, setMessage] = useState("")
  const registerRef = useRef<(() => Promise<void>) | null>(null)
  const tokenRef = useRef("")

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    setIsNative(true)

    let active = true
    let listeners: PluginListenerHandle[] = []

    const saveToken = async (token: string) => {
      tokenRef.current = token
      const currentSession = getClientSession()
      if (
        !currentSession?.token ||
        currentSession.user.offline ||
        currentSession.user.demo
      ) {
        return
      }

      try {
        await apiFetch("/api/notifications/subscriptions", {
          method: "POST",
          body: JSON.stringify({
            businessId: currentSession.user.businessId,
            token,
            platform: Capacitor.getPlatform(),
          }),
        })
        if (!active) return
        setPermission("granted")
        setMessage("")
      } catch (error) {
        if (!active) return
        console.error(
          "Native push token could not be saved to the account.",
          error,
        )
        setMessage("Could not connect notifications to this account.")
      }
    }

    const registerDevice = async (askPermission: boolean) => {
      const currentSession = getClientSession()
      setSession(currentSession)
      if (
        !currentSession?.token ||
        currentSession.user.offline ||
        currentSession.user.demo
      ) {
        setIsChecking(false)
        return
      }
      if (askPermission) setIsRequesting(true)
      try {
        let status = await PushNotifications.checkPermissions()
        if (askPermission && status.receive !== "granted") {
          status = await PushNotifications.requestPermissions()
        }
        if (!active) return
        setPermission(status.receive)
        if (status.receive !== "granted") {
          setMessage(
            status.receive === "denied"
              ? "Notifications are blocked. Allow them in Android Settings, then retry."
              : "Enable notifications to receive business alerts on this device.",
          )
          setIsChecking(false)
          return
        }
        setMessage("")
        if (Capacitor.getPlatform() === "android") {
          await PushNotifications.createChannel({
            id: "mobiduka-alerts",
            name: "MobiDuka alerts",
            description: "Sales, stock, and business notifications",
            importance: 4,
            sound: "default",
            vibration: true,
          })
        }
        await PushNotifications.register()
      } catch (error) {
        if (!active) return
        console.error("Native push registration failed.", error)
        setMessage("Could not enable notifications. Please try again.")
      } finally {
        if (active) {
          setIsChecking(false)
          if (askPermission) setIsRequesting(false)
        }
      }
    }
    registerRef.current = () => registerDevice(true)

    const syncSession = () => {
      const currentSession = getClientSession()
      setSession(currentSession)
      if (
        !currentSession?.token ||
        currentSession.user.offline ||
        currentSession.user.demo
      ) {
        setIsChecking(false)
        return
      }
      if (tokenRef.current) {
        void saveToken(tokenRef.current)
      } else {
        void registerDevice(false)
      }
    }

    void (async () => {
      try {
        listeners = await Promise.all([
          PushNotifications.addListener("registration", ({ value }) => {
            if (active) void saveToken(value)
          }),
          PushNotifications.addListener("registrationError", (error) => {
            if (!active) return
            console.error("Firebase device-token registration failed.", error)
          }),
          PushNotifications.addListener(
            "pushNotificationReceived",
            (notification) => {
              window.dispatchEvent(new Event("mobiduka-notification"))
              window.dispatchEvent(
                new CustomEvent("mobiduka-native-push-received", {
                  detail: notification,
                }),
              )
            },
          ),
          PushNotifications.addListener(
            "pushNotificationActionPerformed",
            (notification) => {
              window.dispatchEvent(new Event("mobiduka-notification"))
              window.dispatchEvent(
                new CustomEvent("mobiduka-native-push-opened", {
                  detail: notification,
                }),
              )
            },
          ),
        ])
        if (!active) return
        syncSession()
        window.addEventListener(CLIENT_SESSION_CHANGED_EVENT, syncSession)
      } catch (error) {
        if (!active) return
        console.error("Native push listeners could not be initialized.", error)
      }
    })()

    return () => {
      active = false
      window.removeEventListener(CLIENT_SESSION_CHANGED_EVENT, syncSession)
      registerRef.current = null
      for (const listener of listeners) void listener.remove()
    }
  }, [])

  if (
    !isNative ||
    !session?.token ||
    session.user.offline ||
    session.user.demo ||
    permission === "granted" ||
    isDismissed ||
    isChecking
  ) {
    return null
  }

  return (
    <aside
      role="status"
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        zIndex: 1200,
        width: "min(360px, calc(100vw - 24px))",
        padding: 14,
        border: "1px solid #d5deed",
        borderRadius: 8,
        background: "white",
        color: "#0d1b3d",
        boxShadow: "0 8px 28px rgba(13,27,61,.2)",
        fontSize: 12,
      }}
    >
      <strong style={{ display: "block", marginBottom: 5 }}>
        Turn on notifications?
      </strong>
      <div style={{ color: "#53627b", lineHeight: 1.45 }}>
        {message || "Receive business alerts on this device."}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          type="button"
          disabled={isRequesting}
          onClick={() => void registerRef.current?.()}
          style={buttonStyle}
        >
          {isRequesting ? "Enabling…" : "Enable notifications"}
        </button>
        <button
          type="button"
          disabled={isRequesting}
          onClick={() => setIsDismissed(true)}
          style={dismissButtonStyle}
        >
          Not now
        </button>
      </div>
    </aside>
  )
}

const buttonStyle = {
  minHeight: 34,
  padding: "0 11px",
  border: 0,
  borderRadius: 6,
  background: "#123a8f",
  color: "white",
  font: "inherit",
  fontWeight: 700,
  cursor: "pointer",
} as const

const dismissButtonStyle = {
  minHeight: 34,
  padding: "0 11px",
  border: "1px solid #d5deed",
  borderRadius: 6,
  background: "white",
  color: "#53627b",
  font: "inherit",
  fontWeight: 600,
  cursor: "pointer",
} as const
