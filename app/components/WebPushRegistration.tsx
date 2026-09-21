"use client";

import { useEffect } from "react";
import { getToken, isSupported, onMessage } from "firebase/messaging";
import { getFirebaseMessaging } from "@/lib/firebase-web";
import { apiFetch, getClientSession } from "@/lib/client-api";

export default function WebPushRegistration() {
  const enable = async () => {
    const permission = await Notification.requestPermission();
    if (permission === "granted") window.location.reload();
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      if (!(await isSupported()) || !("Notification" in window) || Notification.permission !== "granted") return;
      const session = getClientSession();
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!session || !vapidKey) return;
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      const messaging = await getFirebaseMessaging();
      const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
      if (!token) return;
      await apiFetch("/api/notifications/subscriptions", { method: "POST", body: JSON.stringify({ businessId: session.user.businessId, token, platform: "web" }) });
      unsubscribe = onMessage(messaging, () => window.dispatchEvent(new Event("mobiduka-notification")));
    })().catch(() => undefined);
    return () => unsubscribe?.();
  }, []);

  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
    return <button type="button" onClick={() => void enable()} style={{ position: "fixed", right: 16, bottom: 16, zIndex: 1000, border: 0, borderRadius: 8, padding: "10px 14px", background: "#123A8F", color: "white", cursor: "pointer" }}>Enable browser alerts</button>;
  }
  return null;
}