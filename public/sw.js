const CACHE_NAME = "mobiduka-app-shell-v1"
const APP_ROOT = "/"

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      const response = await fetch(APP_ROOT, { cache: "no-store" })
      if (!response.ok) throw new Error("Unable to cache the app shell.")
      await cache.put(APP_ROOT, response.clone())

      const html = await response.text()
      const assetPaths = new Set(
        [...html.matchAll(/(?:src|href)="([^"]*\/_next\/static\/[^"]+)"/g)]
          .map((match) => match[1])
          .filter((path) => path.startsWith("/")),
      )
      await Promise.all(
        [...assetPaths].map(async (path) => {
          try {
            const asset = await fetch(path, { cache: "no-store" })
            if (asset.ok) await cache.put(path, asset)
          } catch {
            // A missing optional asset should not prevent the shell caching.
          }
        }),
      )
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys()
      await Promise.all(
        cacheNames
          .filter(
            (name) =>
              name.startsWith("mobiduka-app-shell-") && name !== CACHE_NAME,
          )
          .map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== "GET" || url.origin !== self.location.origin) return
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/monitoring")
  )
    return

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME)
        try {
          const response = await fetch(request)
          if (response.ok) await cache.put(APP_ROOT, response.clone())
          return response
        } catch {
          return (await cache.match(request)) ?? (await cache.match(APP_ROOT))
        }
      })(),
    )
    return
  }

  if (url.pathname.includes("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME)
        const cached = await cache.match(request)
        if (cached) return cached
        const response = await fetch(request)
        if (response.ok) await cache.put(request, response.clone())
        return response
      })(),
    )
  }
})
