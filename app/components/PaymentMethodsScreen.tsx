import { useEffect, useRef, useState } from "react"
import { useColors } from "../utils/theme"
import { ApiResponseError, apiFetch, getClientSession } from "../../lib/client-api"
import {
  isNativeOfflineApp,
  readOfflineCollection,
  readOfflineCollectionUpdatedAt,
  writeOfflineCollection,
} from "../../lib/offline-store"
import { useAutoDismissMessage } from "../../lib/use-auto-dismiss-message"


interface Method {
  id: string
  label: string
  sub: string
  icon: string
  color: string
  enabled: boolean
}

interface Props {
  onNavigate: (s: string) => void
}

type PaymentConfig = {
  methods: Record<string, boolean>
  mpesaConfig: {
    type: string
    till: string
    paybill: string
    account: string
  }
  bankConfig: {
    name: string
    account: string
    branch: string
  }
  roundCash: boolean
  creditLimit: string
  requireApproval: boolean
}

type SettingsResponse = {
  preferences: {
    paymentConfig: PaymentConfig | null
    mpesaEnabled: boolean
  }
}
type PaymentMethodsSnapshot = { methods: Record<string, boolean> }

type MpesaIntegration = {
  configured: boolean
  environment?: "sandbox" | "production"
  accountType?: "TILL" | "PAYBILL"
  shortcode?: string
  accountReference?: string | null
  updatedAt?: string
}

type MpesaIntegrationResponse = { integration: MpesaIntegration }

type MpesaForm = {
  environment: "sandbox" | "production"
  accountType: "TILL" | "PAYBILL"
  shortcode: string
  accountReference: string
}

type MpesaCredentialDraft = {
  consumerKey: string
  consumerSecret: string
  passkey: string
}

export default function PaymentMethodsScreen({ onNavigate }: Props) {
  const c = useColors()
  const [methods, setMethods] = useState<Method[]>([
    {
      id: "cash",
      label: "Cash",
      sub: "Physical cash at counter",
      icon: "💵",
      color: "#2E7D32",
      enabled: true,
    },
    {
      id: "mpesa",
      label: "M-Pesa",
      sub: "Mobile money (Safaricom)",
      icon: "📱",
      color: "#2E7D32",
      enabled: false,
    },
    {
      id: "bank",
      label: "Bank Transfer",
      sub: "Direct bank / RTGS",
      icon: "🏦",
      color: "#0288D1",
      enabled: false,
    },
    {
      id: "card",
      label: "Card (Visa/MC)",
      sub: "POS terminal / tap-to-pay",
      icon: "💳",
      color: "#7B1FA2",
      enabled: false,
    },
    {
      id: "credit",
      label: "Credit / Tab",
      sub: "Defer payment to customer account",
      icon: "📋",
      color: "#D32F2F",
      enabled: true,
    },
  ])

  const [mpesaForm, setMpesaForm] = useState<MpesaForm>({
    environment: "sandbox",
    accountType: "TILL",
    shortcode: "",
    accountReference: "",
  })
  const [mpesaCredentialDrafts, setMpesaCredentialDrafts] =
    useState<Record<MpesaForm["environment"], MpesaCredentialDraft>>({
      sandbox: { consumerKey: "", consumerSecret: "", passkey: "" },
      production: { consumerKey: "", consumerSecret: "", passkey: "" },
    })
  const [showMpesaCredentials, setShowMpesaCredentials] = useState(false)
  const [mpesaIntegration, setMpesaIntegration] = useState<MpesaIntegration>({
    configured: false,
  })
  const [mpesaFormDirty, setMpesaFormDirty] = useState(false)
  const [mpesaLoading, setMpesaLoading] = useState(false)
  const [showMpesaConfig, setShowMpesaConfig] = useState(false)

  // Bank config
  const [bankConfig, setBankConfig] = useState({
    name: "",
    account: "",
    branch: "",
  })
  const [showBankConfig, setShowBankConfig] = useState(false)

  // Cash options
  const [roundCash, setRoundCash] = useState(false)
  const [showCashConfig, setShowCashConfig] = useState(false)

  // Credit options
  const [creditLimit, setCreditLimit] = useState("5000")
  const [requireApproval, setRequireApproval] = useState(true)
  const [showCreditConfig, setShowCreditConfig] = useState(false)

  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useAutoDismissMessage()
  const [saving, setSaving] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [isOfflineSnapshot, setIsOfflineSnapshot] = useState(false)
  const [snapshotUpdatedAt, setSnapshotUpdatedAt] = useState<string | null>(null)
  const hasPaymentMethodsSnapshot = useRef(false)
  const activeMpesaCredentials = mpesaCredentialDrafts[mpesaForm.environment]
  const hasStoredCredentialsForSelectedEnvironment =
    mpesaIntegration.configured &&
    (mpesaIntegration.environment ?? "sandbox") === mpesaForm.environment

  const paymentConfig = (): PaymentConfig => ({
    methods: Object.fromEntries(
      methods.map((method) => [method.id, method.enabled]),
    ),
    mpesaConfig: {
      type: mpesaForm.accountType === "TILL" ? "till" : "paybill",
      till: mpesaForm.accountType === "TILL" ? mpesaForm.shortcode : "",
      paybill: mpesaForm.accountType === "PAYBILL" ? mpesaForm.shortcode : "",
      account: mpesaForm.accountReference,
    },
    bankConfig,
    roundCash,
    creditLimit,
    requireApproval,
  })

  const applyPaymentConfig = (
    config: PaymentConfig,
    mpesaEnabled?: boolean,
  ) => {
    if (config.methods)
      setMethods((current) =>
        current.map((method) => ({
          ...method,
          enabled:
            method.id === "mpesa"
              ? (config.methods[method.id] ?? method.enabled) &&
                (mpesaEnabled ?? true)
              : (config.methods[method.id] ?? method.enabled),
        })),
      )
    if (config.bankConfig) setBankConfig(config.bankConfig)
    if (config.roundCash !== undefined) setRoundCash(config.roundCash)
    if (config.creditLimit !== undefined) setCreditLimit(config.creditLimit)
    if (config.requireApproval !== undefined)
      setRequireApproval(config.requireApproval)
  }

  useEffect(() => {
    const session = getClientSession()
    if (!session) return
    let active = true
    let requestId = 0
    const businessId = session.user.businessId
    const cacheKey = "payments.methods.v1"
    const loadPaymentMethods = async () => {
      const thisRequestId = ++requestId
      try {
        const response = await apiFetch<SettingsResponse>(
          `/api/settings?businessId=${encodeURIComponent(businessId)}`,
        )
        if (!active || thisRequestId !== requestId) return
        const config = response.preferences.paymentConfig
        if (config) {
          applyPaymentConfig(config, response.preferences.mpesaEnabled)
          const snapshot: PaymentMethodsSnapshot = {
            methods: {
              ...config.methods,
              mpesa: Boolean(config.methods.mpesa && response.preferences.mpesaEnabled),
            },
          }
          try {
            await writeOfflineCollection(businessId, cacheKey, snapshot)
            hasPaymentMethodsSnapshot.current = true
          } catch (reason) {
            console.error("Unable to cache payment method summaries for offline use.", reason)
          }
        }
        let updatedAt: string | null = null
        try {
          updatedAt = await readOfflineCollectionUpdatedAt(businessId, cacheKey)
        } catch (reason) {
          console.error("Unable to read the payment methods snapshot timestamp.", reason)
        }
        if (!active || thisRequestId !== requestId) return
        setSnapshotUpdatedAt(updatedAt)
        setIsOffline(isNativeOfflineApp() && !navigator.onLine)
        setIsOfflineSnapshot(isNativeOfflineApp() && !navigator.onLine)
        setSaveError("")
      } catch (reason) {
        const canUseCache =
          reason instanceof TypeError ||
          (reason instanceof ApiResponseError && reason.status >= 500)
        if (!canUseCache || !isNativeOfflineApp()) {
          if (active && thisRequestId === requestId) {
            setIsOffline(isNativeOfflineApp() && !navigator.onLine)
            setSaveError(reason instanceof Error ? reason.message : "Unable to load payment settings.")
          }
          return
        }
        try {
          const cached = await readOfflineCollection<PaymentMethodsSnapshot>(businessId, cacheKey)
          if (active && thisRequestId === requestId && isNativeOfflineApp()) {
            setIsOffline(true)
          }
          if (!active || thisRequestId !== requestId) return
          if (!cached) {
            throw new Error("Payment method settings are not available offline yet. Connect to the internet once to load them.")
          }
          setMethods(current => current.map(method => ({
            ...method,
            enabled: cached.methods[method.id] ?? method.enabled,
          })))
          hasPaymentMethodsSnapshot.current = true
          setShowMpesaConfig(false)
          setShowBankConfig(false)
          setShowCashConfig(false)
          setShowCreditConfig(false)
          const updatedAt = await readOfflineCollectionUpdatedAt(businessId, cacheKey)
          if (!active || thisRequestId !== requestId) return
          setSnapshotUpdatedAt(updatedAt)
          setIsOfflineSnapshot(true)
          setSaveError("")
        } catch (cacheReason) {
          if (active && thisRequestId === requestId) {
            setSaveError(cacheReason instanceof Error ? cacheReason.message : "Unable to load saved payment settings.")
          }
        }
      }
    }
    const handleOnline = () => void loadPaymentMethods()
    const handleOffline = () => {
      if (isNativeOfflineApp()) {
        setIsOffline(true)
        setIsOfflineSnapshot(hasPaymentMethodsSnapshot.current)
        setShowMpesaConfig(false)
        setShowBankConfig(false)
        setShowCashConfig(false)
        setShowCreditConfig(false)
      }
    }
    void loadPaymentMethods()
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      active = false
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const applyMpesaIntegration = (integration: MpesaIntegration) => {
    setMpesaIntegration(integration)
    if (!integration.configured) return
    setMpesaForm({
      environment: integration.environment ?? "sandbox",
      accountType: integration.accountType ?? "TILL",
      shortcode: integration.shortcode ?? "",
      accountReference: integration.accountReference ?? "",
    })
    setMpesaCredentialDrafts({
      sandbox: { consumerKey: "", consumerSecret: "", passkey: "" },
      production: { consumerKey: "", consumerSecret: "", passkey: "" },
    })
    setShowMpesaCredentials(false)
    setMpesaFormDirty(false)
  }

  useEffect(() => {
    const session = getClientSession()
    if (!session) return
    const loadMpesaIntegration = () => {
      setMpesaLoading(true)
      apiFetch<MpesaIntegrationResponse>(
        `/api/payments/mpesa-integration?businessId=${encodeURIComponent(session.user.businessId)}`,
      )
        .then((response) => applyMpesaIntegration(response.integration))
        .catch((reason) => {
          if (isNativeOfflineApp() && !navigator.onLine) return
          setSaveError(
            reason instanceof Error
              ? reason.message
              : "Unable to load M-Pesa configuration.",
          )
        })
        .finally(() => setMpesaLoading(false))
    }
    if (!isNativeOfflineApp() || navigator.onLine) loadMpesaIntegration()
    window.addEventListener("online", loadMpesaIntegration)
    return () => window.removeEventListener("online", loadMpesaIntegration)
  }, [])

  const toggle = (id: string) => {
    if (isOffline) return
    setMethods((ms) =>
      ms.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)),
    )
  }

  const updateMpesaForm = (patch: Partial<MpesaForm>) => {
    setMpesaForm((current) => ({ ...current, ...patch }))
    setMpesaFormDirty(true)
  }

  const updateMpesaCredential = (
    key: keyof MpesaCredentialDraft,
    value: string,
  ) => {
    setMpesaCredentialDrafts((current) => ({
      ...current,
      [mpesaForm.environment]: {
        ...current[mpesaForm.environment],
        [key]: value,
      },
    }))
    setMpesaFormDirty(true)
  }

  const validateMpesaForm = () => {
    if (!/^\d{5,8}$/.test(mpesaForm.shortcode.trim()))
      return "Enter a valid 5 to 8 digit till or paybill number."
    if (
      !mpesaForm.accountReference.trim() ||
      mpesaForm.accountReference.trim().length > 12
    )
      return "Enter an account reference of up to 12 characters."
    const credentialsRequired =
      !mpesaIntegration.configured ||
      (mpesaIntegration.environment ?? "sandbox") !== mpesaForm.environment
    if (
      credentialsRequired &&
      (!activeMpesaCredentials.consumerKey.trim() ||
        !activeMpesaCredentials.consumerSecret.trim() ||
        !activeMpesaCredentials.passkey.trim())
    ) {
      return `Enter the Consumer Key, Consumer Secret, and passkey for the selected ${mpesaForm.environment} environment.`
    }
    return ""
  }

  const handleSave = async () => {
    if (isOffline) return
    const session = getClientSession()
    if (!session) return
    const mpesaEnabled = methods.some(
      (method) => method.id === "mpesa" && method.enabled,
    )
    const shouldSaveMpesaIntegration =
      mpesaFormDirty || (mpesaEnabled && !mpesaIntegration.configured)
    if (shouldSaveMpesaIntegration) {
      const validationError = validateMpesaForm()
      if (validationError) {
        setSaveError(validationError)
        setShowMpesaConfig(true)
        return
      }
    }

    setSaving(true)
    try {
      if (shouldSaveMpesaIntegration) {
        const response = await apiFetch<MpesaIntegrationResponse>(
          "/api/payments/mpesa-integration",
          {
            method: "PUT",
            body: JSON.stringify({
              businessId: session.user.businessId,
              ...mpesaForm,
              ...activeMpesaCredentials,
            }),
          },
        )
        applyMpesaIntegration(response.integration)
        setMpesaFormDirty(false)
      }
      const response = await apiFetch<SettingsResponse>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          businessId: session.user.businessId,
          mpesaEnabled,
          paymentConfig: paymentConfig(),
        }),
      })
      if (response.preferences.paymentConfig)
        applyPaymentConfig(
          response.preferences.paymentConfig,
          response.preferences.mpesaEnabled,
        )
      setSaveError("")
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (reason) {
      setSaveError(
        reason instanceof Error
          ? reason.message
          : "Unable to save payment settings.",
      )
    } finally {
      setSaving(false)
    }
  }

  const enabledCount = methods.filter((m) => m.enabled).length

  return (
    <div className="screen" style={{ background: c.bg }}>
      <div
        style={{
          background: "linear-gradient(135deg, #0D1B3D, #123A8F)",
          padding: "52px 20px 24px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            className="btn"
            onClick={() => onNavigate("settings")}
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "none",
              borderRadius: 10,
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div>
            <div style={{ color: "white", fontSize: 18, fontWeight: 700 }}>
              Payment Methods
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: 12,
                marginTop: 2,
              }}
            >
              {enabledCount} of {methods.length} active
            </div>
          </div>
        </div>
      </div>

      <div
        className="scroll-area"
        style={{ padding: "16px", paddingBottom: 100 }}
      >
        {saved && (
          <div
            style={{
              background: c.successBg,
              border: `1px solid ${
                c.isDark ? "rgba(46,125,50,0.4)" : "#C8E6C9"
              }`,
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 18 }}>✅</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#2E7D32" }}>
              Payment settings saved
            </span>
          </div>
        )}
        {saveError && (
          <div
            style={{
              background: c.errorBg,
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 16,
              fontSize: 13,
              color: "#D32F2F",
            }}
          >
            {saveError}
          </div>
        )}
        {isOfflineSnapshot && (
          <div role="status" style={{ background: c.cardAlt, color: c.muted, borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 12, lineHeight: 1.5 }}>
            Showing saved payment method status{snapshotUpdatedAt ? ` from ${new Date(snapshotUpdatedAt).toLocaleString()}` : ''}. Payment settings and account details are not editable or stored in this offline view.
          </div>
        )}

        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: c.muted,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            marginBottom: 8,
            marginLeft: 4,
          }}
        >
          Accepted Payment Methods
        </div>

        {/* Method toggles */}
        <div className="card" style={{ overflow: "hidden", marginBottom: 16 }}>
          {methods.map((m, i, arr) => (
            <div key={m.id}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 16px",
                  borderBottom:
                    i < arr.length - 1 ||
                    (m.enabled &&
                      (m.id === "mpesa" ||
                        m.id === "bank" ||
                        m.id === "cash" ||
                        m.id === "credit"))
                      ? c.divider
                      : "none",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: c.tint(m.color),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    flexShrink: 0,
                  }}
                >
                  {m.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>
                    {m.sub}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {!isOffline && (m.id === "mpesa" ||
                    (m.enabled &&
                      (m.id === "bank" ||
                        m.id === "cash" ||
                        m.id === "credit"))) && (
                    <button
                      className="btn"
                      disabled={isOffline}
                      onClick={() => {
                        if (isOffline) return
                        if (m.id === "mpesa") setShowMpesaConfig((v) => !v)
                        if (m.id === "bank") setShowBankConfig((v) => !v)
                        if (m.id === "cash") setShowCashConfig((v) => !v)
                        if (m.id === "credit") setShowCreditConfig((v) => !v)
                      }}
                      style={{
                        background: "none",
                        border: `1px solid ${c.isDark ? "#1A3366" : "#E8ECF4"}`,
                        borderRadius: 8,
                        padding: "4px 10px",
                        fontSize: 11,
                        fontWeight: 600,
                        color: c.muted,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Configure
                    </button>
                  )}
                  <button
                    className="btn"
                    disabled={isOffline}
                    onClick={() => toggle(m.id)}
                    style={{
                      width: 48,
                      height: 27,
                      borderRadius: 14,
                      flexShrink: 0,
                      background: m.enabled
                        ? m.color
                        : c.isDark
                          ? "#1A3366"
                          : "#D0D7E8",
                      border: "none",
                      cursor: isOffline ? "default" : "pointer",
                      opacity: isOffline ? 0.6 : 1,
                      position: "relative",
                      transition: "background 0.2s",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 3,
                        left: m.enabled ? 24 : 3,
                        width: 21,
                        height: 21,
                        borderRadius: "50%",
                        background: "white",
                        transition: "left 0.2s",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                      }}
                    />
                  </button>
                </div>
              </div>

              {/* Inline config panels */}
              {!isOffline && m.id === "mpesa" && showMpesaConfig && (
                <div
                  aria-busy={mpesaLoading}
                  style={{
                    background: c.cardAlt,
                    padding: "16px",
                    borderBottom: c.divider,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: c.muted,
                      marginBottom: 10,
                    }}
                  >
                    M-PESA CONFIGURATION
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: c.muted,
                        marginBottom: 6,
                      }}
                    >
                      Daraja Environment
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {(["sandbox", "production"] as const).map(
                        (environment) => (
                          <button
                            key={environment}
                            type="button"
                            className="btn"
                            aria-pressed={mpesaForm.environment === environment}
                            onClick={() => updateMpesaForm({ environment })}
                            style={{
                              flex: 1,
                              padding: "9px",
                              borderRadius: 10,
                              border:
                                mpesaForm.environment === environment
                                  ? "2px solid #2E7D32"
                                  : `1.5px solid ${
                                      c.isDark ? "#1A3366" : "#E8ECF4"
                                    }`,
                              background:
                                mpesaForm.environment === environment
                                  ? c.isDark
                                    ? "rgba(46,125,50,0.2)"
                                    : "rgba(46,125,50,0.08)"
                                  : c.card,
                              color:
                                mpesaForm.environment === environment
                                  ? "#2E7D32"
                                  : c.muted,
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              textTransform: "capitalize",
                            }}
                          >
                            {environment}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                  <div
                    role="status"
                    aria-live="polite"
                    style={{
                      background:
                        mpesaForm.environment === "production"
                          ? c.isDark
                            ? "rgba(249,168,37,0.12)"
                            : "#FFF8E1"
                          : c.infoBg,
                      borderRadius: 10,
                      padding: "10px 12px",
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        color: c.text,
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 3,
                      }}
                    >
                      {mpesaForm.environment === "production"
                        ? "Live mode"
                        : "Test mode"}
                    </div>
                    <div
                      style={{ color: c.muted, fontSize: 11, lineHeight: 1.5 }}
                    >
                      {mpesaForm.environment === "production"
                        ? "Live payments use this merchant's approved production shortcode and credentials."
                        : "Use Safaricom sandbox credentials. No real money is moved."}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: c.text,
                      marginBottom: 8,
                    }}
                  >
                    Merchant account
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    {(["TILL", "PAYBILL"] as const).map((accountType) => (
                      <button
                        key={accountType}
                        type="button"
                        className="btn"
                        aria-pressed={mpesaForm.accountType === accountType}
                        onClick={() => updateMpesaForm({ accountType })}
                        style={{
                          flex: 1,
                          padding: "9px",
                          borderRadius: 10,
                          border:
                            mpesaForm.accountType === accountType
                              ? "2px solid #2E7D32"
                              : `1.5px solid ${
                                  c.isDark ? "#1A3366" : "#E8ECF4"
                                }`,
                          background:
                            mpesaForm.accountType === accountType
                              ? c.isDark
                                ? "rgba(46,125,50,0.2)"
                                : "rgba(46,125,50,0.08)"
                              : c.card,
                          color:
                            mpesaForm.accountType === accountType
                              ? "#2E7D32"
                              : c.muted,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {accountType === "TILL" ? "Till" : "Paybill"}
                      </button>
                    ))}
                  </div>
                  {mpesaForm.accountType === "TILL" ? (
                    <>
                      <div style={{ marginBottom: 12 }}>
                        <label
                          htmlFor="mpesa-till-number"
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: c.muted,
                            display: "block",
                            marginBottom: 6,
                          }}
                        >
                          Till Number
                        </label>
                        <input
                          id="mpesa-till-number"
                          className="input"
                          inputMode="numeric"
                          maxLength={8}
                          placeholder="e.g. 123456"
                          value={mpesaForm.shortcode}
                          onChange={(e) =>
                            updateMpesaForm({
                              shortcode: e.target.value.replace(/\D/g, ""),
                            })
                          }
                        />
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <label
                          htmlFor="mpesa-account-reference"
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: c.muted,
                            display: "block",
                            marginBottom: 6,
                          }}
                        >
                          Account Reference
                        </label>
                        <input
                          id="mpesa-account-reference"
                          className="input"
                          maxLength={12}
                          placeholder="e.g. MobiDuka"
                          value={mpesaForm.accountReference}
                          onChange={(e) =>
                            updateMpesaForm({
                              accountReference: e.target.value,
                            })
                          }
                        />
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <label
                          htmlFor="mpesa-paybill-number"
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: c.muted,
                            display: "block",
                            marginBottom: 6,
                          }}
                        >
                          Paybill No.
                        </label>
                        <input
                          id="mpesa-paybill-number"
                          className="input"
                          inputMode="numeric"
                          maxLength={8}
                          placeholder="e.g. 400200"
                          value={mpesaForm.shortcode}
                          onChange={(e) =>
                            updateMpesaForm({
                              shortcode: e.target.value.replace(/\D/g, ""),
                            })
                          }
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label
                          htmlFor="mpesa-paybill-account"
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: c.muted,
                            display: "block",
                            marginBottom: 6,
                          }}
                        >
                          Account No.
                        </label>
                        <input
                          id="mpesa-paybill-account"
                          className="input"
                          maxLength={12}
                          placeholder="Account"
                          value={mpesaForm.accountReference}
                          onChange={(e) =>
                            updateMpesaForm({
                              accountReference: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                  <div
                    style={{
                      borderTop: c.divider,
                      marginTop: 16,
                      paddingTop: 16,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          fontSize: 12,
                          fontWeight: 700,
                          color: c.text,
                          textTransform: "capitalize",
                        }}
                      >
                        {mpesaForm.environment} credentials
                      </div>
                      <button
                        type="button"
                        className="btn"
                        aria-label={
                          showMpesaCredentials
                            ? "Hide M-Pesa credential values"
                            : "Show M-Pesa credential values"
                        }
                        onClick={() =>
                          setShowMpesaCredentials((visible) => !visible)
                        }
                        style={{
                          background: "none",
                          border: "none",
                          padding: "3px 0",
                          color: c.muted,
                          fontSize: 11,
                          fontWeight: 600,
                          fontFamily: "inherit",
                          cursor: "pointer",
                        }}
                      >
                        {showMpesaCredentials ? "Hide values" : "Show values"}
                      </button>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: c.muted,
                        lineHeight: 1.5,
                        marginBottom: 14,
                      }}
                    >
                      Use matching {mpesaForm.environment} credentials for this
                      merchant&apos;s Till or Paybill. Credentials are encrypted
                      by the backend before storage.
                    </div>
                    {hasStoredCredentialsForSelectedEnvironment && (
                      <div
                        style={{
                          fontSize: 11,
                          color: c.muted,
                          lineHeight: 1.5,
                          marginBottom: 14,
                        }}
                      >
                        If the server encryption key changed, restore its
                        original value or enter all three credentials here to
                        replace them.
                      </div>
                    )}
                    {[
                      {
                        id: "mpesa-consumer-key",
                        label: "Consumer Key",
                        key: "consumerKey" as const,
                        placeholder: `Enter Daraja ${mpesaForm.environment} consumer key`,
                      },
                      {
                        id: "mpesa-consumer-secret",
                        label: "Consumer Secret",
                        key: "consumerSecret" as const,
                        placeholder: `Enter Daraja ${mpesaForm.environment} consumer secret`,
                      },
                      {
                        id: "mpesa-passkey",
                        label: "Lipa Na M-PESA Passkey",
                        key: "passkey" as const,
                        placeholder: `Enter ${mpesaForm.environment} passkey`,
                      },
                    ].map((field) => (
                      <div
                        key={field.key}
                        style={{
                          marginBottom: field.key === "passkey" ? 0 : 12,
                        }}
                      >
                        <label
                          htmlFor={field.id}
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: c.muted,
                            display: "block",
                            marginBottom: 6,
                          }}
                        >
                          {field.label}
                        </label>
                        <input
                          id={field.id}
                          className="input"
                          type={showMpesaCredentials ? "text" : "password"}
                          autoComplete="new-password"
                          spellCheck={false}
                          maxLength={512}
                          placeholder={
                            hasStoredCredentialsForSelectedEnvironment
                              ? "Leave blank to keep unchanged"
                              : field.placeholder
                          }
                          value={activeMpesaCredentials[field.key]}
                          onChange={(e) =>
                            updateMpesaCredential(field.key, e.target.value)
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isOffline && m.id === "bank" && m.enabled && showBankConfig && (
                <div
                  style={{
                    background: c.cardAlt,
                    padding: "16px",
                    borderBottom: c.divider,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: c.muted,
                      marginBottom: 10,
                    }}
                  >
                    BANK ACCOUNT DETAILS
                  </div>
                  {[
                    {
                      label: "Bank Name",
                      key: "name",
                      placeholder: "e.g. Equity Bank",
                    },
                    {
                      label: "Account Number",
                      key: "account",
                      placeholder: "0123456789",
                    },
                    {
                      label: "Branch",
                      key: "branch",
                      placeholder: "e.g. Nairobi CBD",
                    },
                  ].map((f) => (
                    <div key={f.key} style={{ marginBottom: 12 }}>
                      <label
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: c.muted,
                          display: "block",
                          marginBottom: 6,
                        }}
                      >
                        {f.label}
                      </label>
                      <input
                        className="input"
                        placeholder={f.placeholder}
                        value={bankConfig[(f.key as keyof typeof bankConfig)]}
                        onChange={(e) =>
                          setBankConfig((p) => ({
                            ...p,
                            [f.key]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              {!isOffline && m.id === "cash" && m.enabled && showCashConfig && (
                <div
                  style={{
                    background: c.cardAlt,
                    padding: "16px",
                    borderBottom: c.divider,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{ fontSize: 13, fontWeight: 600, color: c.text }}
                      >
                        Round to nearest KSh 5
                      </div>
                      <div
                        style={{ fontSize: 11, color: c.muted, marginTop: 2 }}
                      >
                        Helps cashiers avoid giving small change
                      </div>
                    </div>
                    <button
                      className="btn"
                      onClick={() => setRoundCash((v) => !v)}
                      style={{
                        width: 48,
                        height: 27,
                        borderRadius: 14,
                        background: roundCash
                          ? "#2E7D32"
                          : c.isDark
                            ? "#1A3366"
                            : "#D0D7E8",
                        border: "none",
                        cursor: "pointer",
                        position: "relative",
                        transition: "background 0.2s",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 3,
                          left: roundCash ? 24 : 3,
                          width: 21,
                          height: 21,
                          borderRadius: "50%",
                          background: "white",
                          transition: "left 0.2s",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                        }}
                      />
                    </button>
                  </div>
                </div>
              )}

              {!isOffline && m.id === "credit" && m.enabled && showCreditConfig && (
                <div
                  style={{
                    background: c.cardAlt,
                    padding: "16px",
                    borderBottom: i < arr.length - 1 ? c.divider : "none",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: c.muted,
                      marginBottom: 12,
                    }}
                  >
                    CREDIT / TAB SETTINGS
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: c.muted,
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      Default Credit Limit (KSh)
                    </label>
                    <input
                      className="input"
                      type="number"
                      placeholder="5000"
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(e.target.value)}
                    />
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{ fontSize: 13, fontWeight: 600, color: c.text }}
                      >
                        Require manager approval
                      </div>
                      <div
                        style={{ fontSize: 11, color: c.muted, marginTop: 2 }}
                      >
                        For credit sales above the limit
                      </div>
                    </div>
                    <button
                      className="btn"
                      onClick={() => setRequireApproval((v) => !v)}
                      style={{
                        width: 48,
                        height: 27,
                        borderRadius: 14,
                        background: requireApproval
                          ? "#D32F2F"
                          : c.isDark
                            ? "#1A3366"
                            : "#D0D7E8",
                        border: "none",
                        cursor: "pointer",
                        position: "relative",
                        transition: "background 0.2s",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 3,
                          left: requireApproval ? 24 : 3,
                          width: 21,
                          height: 21,
                          borderRadius: "50%",
                          background: "white",
                          transition: "left 0.2s",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                        }}
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Info */}
        <div
          style={{
            background: c.infoBg,
            border: `1px solid ${c.isDark ? "rgba(18,58,143,0.4)" : "#BBDEFB"}`,
            borderRadius: 14,
            padding: "14px 16px",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: c.isDark ? "#90CAF9" : "#1565C0",
              marginBottom: 4,
            }}
          >
            ℹ️ Admin note
          </div>
          <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.5 }}>
            Disabled payment methods will be hidden from cashiers during
            checkout. Changes take effect immediately.
          </div>
        </div>

        <button
          className="btn"
          onClick={handleSave}
          disabled={saving || isOffline}
          style={{
            width: "100%",
            padding: "16px",
            background: "linear-gradient(135deg, #123A8F, #1A4FBF)",
            border: "none",
            borderRadius: 16,
            fontSize: 15,
            fontWeight: 700,
            color: "white",
            cursor: saving ? "wait" : isOffline ? "default" : "pointer",
            opacity: saving ? 0.72 : isOffline ? 0.6 : 1,
            fontFamily: "inherit",
            boxShadow: "0 4px 16px rgba(18,58,143,0.35)",
          }}
        >
          {saving ? "Saving..." : "Save Payment Settings"}
        </button>
      </div>
    </div>
  )
}
