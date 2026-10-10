"use client"

import { useEffect } from "react"

export default function OfflineServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    void navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.error("Offline app-shell caching could not be enabled.", error)
    })
  }, [])

  return null
}
