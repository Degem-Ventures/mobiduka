export type ClientSession = {
  token: string
  user: {
    id: string
    name: string
    businessId: string
    role: string
    offline?: boolean
    demo?: boolean
    subscription?: {
      planType: string
      status: "TRIAL" | "ACTIVE" | "GRACE" | "EXPIRED" | "REVOKED" | "MISSING"
      trialEndsAt: string | null
      currentPeriodEndsAt: string | null
      graceEndsAt: string | null
    }
  }
}

export class ApiResponseError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = "ApiResponseError"
  }
}

export const SUBSCRIPTION_REQUIRED_EVENT = "mobiduka-subscription-required"
export const CLIENT_SESSION_CHANGED_EVENT = "mobiduka-client-session-changed"

const SESSION_KEY = "mobiduka_session"
const PIN_LOGIN_CONTEXT_KEY = "mobiduka_pin_login_context"
const LAST_SCREEN_KEY = "mobiduka_last_screen"
const POS_CREDITOR_INTENT_PREFIX = "mobiduka.pos_credit_sale_intent.v1"
const inFlightGetResponses = new Map<string, Promise<string>>()

function createApiHeaders(init: RequestInit, session: ClientSession | null) {
  const headers = new Headers(init.headers)
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  if (session?.token)
    headers.set("Authorization", ["Bearer", session.token].join(" "))
  return headers
}

function createApiRequestUrl(path: string) {
  const apiOrigin =
    process.env.NEXT_PUBLIC_API_ORIGIN?.replace(/\/+$/, "") ?? ""
  return apiOrigin && path.startsWith("/")
    ? new URL(path, apiOrigin).toString()
    : path
}

function getRequestKey(
  path: string,
  init: RequestInit,
  session: ClientSession | null,
) {
  const headers = Array.from(createApiHeaders(init, session).entries()).sort(
    ([left], [right]) => left.localeCompare(right),
  )
  return JSON.stringify([
    createApiRequestUrl(path),
    headers,
    init.cache,
    init.credentials,
    init.integrity,
    init.mode,
    init.redirect,
    init.referrer,
    init.referrerPolicy,
  ])
}

function fetchGetResponseText(
  path: string,
  init: RequestInit,
  session: ClientSession | null,
) {
  const key = getRequestKey(path, init, session)
  const existingRequest = inFlightGetResponses.get(key)
  if (existingRequest) return existingRequest

  const request = apiFetchResponse(path, init).then((response) =>
    response.text(),
  )
  inFlightGetResponses.set(key, request)
  void request.then(
    () => {
      if (inFlightGetResponses.get(key) === request) {
        inFlightGetResponses.delete(key)
      }
    },
    () => {
      if (inFlightGetResponses.get(key) === request) {
        inFlightGetResponses.delete(key)
      }
    },
  )
  return request
}

function posCreditorIntentKey(businessId: string, userId: string) {
  return `${POS_CREDITOR_INTENT_PREFIX}:${businessId}:${userId}`
}

export function startCreditorSale(customerId: string) {
  const session = getClientSession()
  if (!session || !customerId) return false
  window.localStorage.setItem(
    posCreditorIntentKey(session.user.businessId, session.user.id),
    JSON.stringify({ customerId, createdAt: Date.now() }),
  )
  return true
}

export function takeCreditorSaleIntent(businessId: string, userId: string) {
  const key = posCreditorIntentKey(businessId, userId)
  const raw = window.localStorage.getItem(key)
  if (!raw) return null
  window.localStorage.removeItem(key)
  try {
    const intent = JSON.parse(raw) as {
      customerId?: unknown
      createdAt?: unknown
    }
    if (
      typeof intent.customerId !== "string" ||
      typeof intent.createdAt !== "number" ||
      Date.now() - intent.createdAt > 5 * 60 * 1000
    )
      return null
    return { customerId: intent.customerId }
  } catch {
    return null
  }
}

export type PinLoginContext = {
  identifier?: string
  businessId: string
  displayName: string
}

export function getClientSession(): ClientSession | null {
  if (typeof window === "undefined") return null
  try {
    const value = window.localStorage.getItem(SESSION_KEY)
    return value ? JSON.parse(value) as ClientSession : null
  } catch {
    return null
  }
}

export function saveClientSession(session: ClientSession) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  window.dispatchEvent(new Event(CLIENT_SESSION_CHANGED_EVENT))
}

export function clearClientSession() {
  window.localStorage.removeItem(SESSION_KEY)
  window.dispatchEvent(new Event(CLIENT_SESSION_CHANGED_EVENT))
}

export function getLastScreen() {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(LAST_SCREEN_KEY)
}

export function saveLastScreen(screen: string) {
  window.localStorage.setItem(LAST_SCREEN_KEY, screen)
}

export function clearLastScreen() {
  window.localStorage.removeItem(LAST_SCREEN_KEY)
}

export function getPinLoginContext(): PinLoginContext | null {
  if (typeof window === "undefined") return null
  try {
    const value = window.localStorage.getItem(PIN_LOGIN_CONTEXT_KEY)
    return value ? JSON.parse(value) as PinLoginContext : null
  } catch {
    return null
  }
}

export function savePinLoginContext(context: PinLoginContext) {
  window.localStorage.setItem(PIN_LOGIN_CONTEXT_KEY, JSON.stringify(context))
}

export async function apiFetchResponse(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const session = getClientSession()
  if (session?.user.offline) {
    throw new TypeError(
      "Offline sessions can access saved data only. Sign in online to synchronize.",
    )
  }
  const headers = createApiHeaders(init, session)
  const response = await fetch(createApiRequestUrl(path), { ...init, headers })
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/api/auth/")) {
      clearClientSession()
      clearLastScreen()
      window.dispatchEvent(new Event("mobiduka-auth-expired"))
    }
    const payload: unknown = await response
      .clone()
      .json()
      .catch(() => ({}))
    const errorPayload =
      typeof payload === "object" && payload !== null
        ? payload as Record<string, unknown>
        : {}
    const errorCode =
      typeof errorPayload.code === "string"
        ? errorPayload.code
        : errorPayload.error === "PAYMENT_REQUIRED"
          ? "SUBSCRIPTION_WRITE_LOCKED"
          : undefined
    if (
      errorCode === "SUBSCRIPTION_WRITE_LOCKED" &&
      typeof window !== "undefined"
    ) {
      window.dispatchEvent(new Event(SUBSCRIPTION_REQUIRED_EVENT))
    }
    throw new ApiResponseError(
      typeof errorPayload.error === "string"
        ? errorPayload.error
        : `Request failed (${response.status})`,
      response.status,
      errorCode,
    )
  }
  return response
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if ((init.method ?? "GET").toUpperCase() === "GET" && !init.signal) {
    const responseText = await fetchGetResponseText(
      path,
      init,
      getClientSession(),
    )
    try {
      return JSON.parse(responseText) as T
    } catch {
      return {} as T
    }
  }
  const response = await apiFetchResponse(path, init)
  const payload = await response.json().catch(() => ({}))
  return payload as T
}
