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
type RegistrationState = "checking" | "disabled" | "ready" | "registering" | "registered" | "error"

export default function NativePushRegistration() {
  const [isNative, setIsNative] = useState(false)
  const [session, setSession] = useState<ClientSession | null>(null)
  const [permission, setPermission] = useState<PushPermission | null>(null)
  const [registrationState, setRegistrationState] =
    useState<RegistrationState>("checking")
  const [message, setMessage] = useState("")
  const [isTesting, setIsTesting] = useState(false)
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
        setRegistrationState("ready")
        setMessage(
          "Push token received. Sign in online to connect this device to your business.",
        )
        return
      }

      setRegistrationState("registering")
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
        setSession(currentSession)
        setRegistrationState("registered")
        setMessage(
          "Push notifications are enabled for this account on this device.",
        )
      } catch (error) {
        if (!active) return
        console.error(
          "Native push token could not be saved to the account.",
          error,
        )
        setRegistrationState("error")
        setMessage(
          error instanceof Error
            ? `Device token received, but account registration failed: ${error.message}`
            : "Device token received, but account registration failed.",
        )
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
        setRegistrationState("ready")
        setMessage(
          "Sign in online to register this device for push notifications.",
        )
        return
      }
      try {
        let status = await PushNotifications.checkPermissions()
        if (askPermission && status.receive !== "granted") {
          status = await PushNotifications.requestPermissions()
        }
        if (!active) return
        setPermission(status.receive)
        if (status.receive !== "granted") {
          setRegistrationState("disabled")
          setMessage(
            status.receive === "denied"
              ? "Notifications are blocked for this app. Allow them in your device settings, then retry."
              : "Allow notifications so this device can receive business alerts.",
          )
          return
        }
        setRegistrationState("registering")
        setMessage("Connecting this device to Firebase Cloud Messaging…")
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
        setRegistrationState("error")
        setMessage(
          error instanceof Error
            ? `Push registration failed: ${error.message}`
            : "Push registration failed. Check native Firebase configuration.",
        )
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
        setRegistrationState("ready")
        setMessage("")
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
            setRegistrationState("error")
            setMessage(
              `Firebase could not create a device token: ${error.error}. Check Android Firebase configuration and project credentials.`,
            )
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
        setRegistrationState("error")
        setMessage(
          error instanceof Error
            ? `Native push plugin is unavailable: ${error.message}`
            : "Native push plugin is unavailable. Rebuild and sync the Capacitor app.",
        )
      }
    })()

    return () => {
      active = false
      window.removeEventListener(CLIENT_SESSION_CHANGED_EVENT, syncSession)
      registerRef.current = null
      for (const listener of listeners) void listener.remove()
    }
  }, [])

  const sendTestNotification = async () => {
    if (!session) return
    setIsTesting(true)
    setMessage("Sending a push test to this device…")
    try {
      const result = await apiFetch<{ success: boolean; message: string }>(
        "/api/notifications/subscriptions/test",
        {
          method: "POST",
          body: JSON.stringify({ businessId: session.user.businessId }),
        },
      )
      setMessage(result.message)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Push test failed: ${error.message}`
          : "Push test failed.",
      )
    } finally {
      setIsTesting(false)
    }
  }

  if (
    !isNative ||
    !session?.token ||
    session.user.offline ||
    session.user.demo
  ) {
    return null
  }

  const isRegistered = registrationState === "registered"
  const needsPermission =
    permission !== "granted" ||
    registrationState === "disabled" ||
    registrationState === "error"

  return (
    <aside
      role={registrationState === "error" ? "alert" : "status"}
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        zIndex: 1200,
        width: "min(360px, calc(100vw - 24px))",
        padding: 14,
        border: "1px solid #d5deed",
        borderRadius: 14,
        background: "white",
        color: "#0d1b3d",
        boxShadow: "0 8px 28px rgba(13,27,61,.2)",
        fontSize: 12,
      }}
    >
      <strong style={{ display: "block", marginBottom: 5 }}>
        {isRegistered
          ? "Push notifications enabled"
          : "Device push notifications"}
      </strong>
      <div style={{ color: "#53627b", lineHeight: 1.45 }}>
        {message ||
          "Checking notification permission and Firebase registration…"}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {needsPermission && (
          <button
            type="button"
            disabled={registrationState === "registering"}
            onClick={() => void registerRef.current?.()}
            style={buttonStyle}
          >
            {permission === "denied"
              ? "Retry after enabling in Settings"
              : "Enable push"}
          </button>
        )}
        {isRegistered && (
          <button
            type="button"
            disabled={isTesting}
            onClick={() => void sendTestNotification()}
            style={buttonStyle}
          >
            {isTesting ? "Sending test…" : "Send test notification"}
          </button>
        )}
      </div>
    </aside>
  )
}

const buttonStyle = {
  minHeight: 34,
  padding: "0 11px",
  border: 0,
  borderRadius: 8,
  background: "#123a8f",
  color: "white",
  font: "inherit",
  fontWeight: 700,
  cursor: "pointer",
} as const
