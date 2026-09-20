export type ClientSession = {
  token: string;
  user: {
    id: string;
    name: string;
    businessId: string;
    role: string;
  };
};

const SESSION_KEY = "mobiduka_session";
const PIN_LOGIN_CONTEXT_KEY = "mobiduka_pin_login_context";
const LAST_SCREEN_KEY = "mobiduka_last_screen";

export type PinLoginContext = {
  identifier?: string;
  businessId: string;
  displayName: string;
};

export function getClientSession(): ClientSession | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) as ClientSession : null;
  } catch {
    return null;
  }
}

export function saveClientSession(session: ClientSession) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearClientSession() {
  window.localStorage.removeItem(SESSION_KEY);
}

export function getLastScreen() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LAST_SCREEN_KEY);
}

export function saveLastScreen(screen: string) {
  window.localStorage.setItem(LAST_SCREEN_KEY, screen);
}

export function clearLastScreen() {
  window.localStorage.removeItem(LAST_SCREEN_KEY);
}

export function getPinLoginContext(): PinLoginContext | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(PIN_LOGIN_CONTEXT_KEY);
    return value ? JSON.parse(value) as PinLoginContext : null;
  } catch {
    return null;
  }
}

export function savePinLoginContext(context: PinLoginContext) {
  window.localStorage.setItem(PIN_LOGIN_CONTEXT_KEY, JSON.stringify(context));
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = getClientSession();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (session?.token) headers.set("Authorization", `Bearer ${session.token}`);

  const response = await fetch(path, { ...init, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : `Request failed (${response.status})`);
  }
  return payload as T;
}