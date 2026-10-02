export const PAYMENT_METHODS = [
  "cash",
  "mpesa",
  "bank",
  "card",
  "credit",
] as const

const PAYMENT_METHOD_KEYS = new Set<string>(PAYMENT_METHODS)

const SENSITIVE_PAYMENT_FIELD_FRAGMENTS = [
  "consumerkey",
  "consumersecret",
  "passkey",
  "credentialciphertext",
  "apikey",
  "apisecret",
  "accesstoken",
  "authtoken",
  "privatekey",
  "secret",
  "password",
  "token",
]

const PAYMENT_CONFIG_KEYS = new Set([
  "methods",
  "mpesaConfig",
  "bankConfig",
  "roundCash",
  "creditLimit",
  "requireApproval",
])
const MPESA_CONFIG_KEYS = new Set(["type", "till", "paybill", "account"])
const BANK_CONFIG_KEYS = new Set(["name", "account", "branch"])

function normalizedFieldName(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase()
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: Set<string>) {
  return Object.keys(value).every((key) => allowed.has(key))
}

export function containsSensitivePaymentFields(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSensitivePaymentFields)
  if (!value || typeof value !== "object") return false
  return Object.entries(value as Record<string, unknown>).some(
    ([key, nested]) =>
      SENSITIVE_PAYMENT_FIELD_FRAGMENTS.some((fragment) =>
        normalizedFieldName(key).includes(fragment),
      ) || containsSensitivePaymentFields(nested),
  )
}

export function validPaymentConfig(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  if (containsSensitivePaymentFields(value)) return false

  const config = value as Record<string, unknown>
  if (!hasOnlyKeys(config, PAYMENT_CONFIG_KEYS)) return false
  if (
    !config.methods ||
    typeof config.methods !== "object" ||
    Array.isArray(config.methods)
  ) {
    return false
  }

  const methods = config.methods as Record<string, unknown>
  if (!hasOnlyKeys(methods, PAYMENT_METHOD_KEYS)) return false
  if (PAYMENT_METHODS.some((method) => typeof methods[method] !== "boolean")) {
    return false
  }
  if (!["cash", "mpesa", "credit"].some((method) => methods[method] === true)) {
    return false
  }

  const mpesa = config.mpesaConfig as Record<string, unknown> | undefined
  const bank = config.bankConfig as Record<string, unknown> | undefined
  if (
    !mpesa ||
    !bank ||
    Array.isArray(mpesa) ||
    Array.isArray(bank) ||
    !hasOnlyKeys(mpesa, MPESA_CONFIG_KEYS) ||
    !hasOnlyKeys(bank, BANK_CONFIG_KEYS)
  ) {
    return false
  }

  return (
    (mpesa.type === "till" || mpesa.type === "paybill") &&
    [mpesa.till, mpesa.paybill, mpesa.account].every(
      (field) => typeof field === "string",
    ) &&
    [bank.name, bank.account, bank.branch].every(
      (field) => typeof field === "string",
    ) &&
    typeof config.roundCash === "boolean" &&
    typeof config.creditLimit === "string" &&
    Number.isFinite(Number(config.creditLimit)) &&
    Number(config.creditLimit) >= 0 &&
    typeof config.requireApproval === "boolean"
  )
}

export function paymentConfigEnablesMpesa(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const methods = (value as Record<string, unknown>).methods
  if (!methods || typeof methods !== "object" || Array.isArray(methods)) {
    return false
  }
  return (methods as Record<string, unknown>).mpesa === true
}
