import assert from "node:assert/strict"
import crypto from "node:crypto"
import test from "node:test"
import {
  decryptMpesaCredentials,
  encryptMpesaCredentials,
  MpesaCredentialError,
} from "../lib/mpesa-credentials.ts"
import {
  containsSensitivePaymentFields,
  validPaymentConfig,
} from "../lib/payment-config.ts"
import {
  mpesaEndpoints,
  mpesaEnvironment,
  MpesaConfigurationError,
} from "../lib/mpesa.ts"

const credentialKey = crypto.randomBytes(32).toString("base64")
const credentials = {
  consumerKey: "consumer-key",
  consumerSecret: "consumer-secret",
  passkey: "online-passkey",
}

function withCredentialKey(run: () => void) {
  const previous = process.env.MPESA_CREDENTIALS_ENCRYPTION_KEY
  process.env.MPESA_CREDENTIALS_ENCRYPTION_KEY = credentialKey
  try {
    run()
  } finally {
    if (previous === undefined) {
      delete process.env.MPESA_CREDENTIALS_ENCRYPTION_KEY
    } else {
      process.env.MPESA_CREDENTIALS_ENCRYPTION_KEY = previous
    }
  }
}

test("encrypts a tenant credential bundle with a unique nonce", () => {
  withCredentialKey(() => {
    const first = encryptMpesaCredentials("business-a", credentials)
    const second = encryptMpesaCredentials("business-a", credentials)

    assert.notEqual(first, second)
    assert.match(first, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    assert.deepEqual(decryptMpesaCredentials("business-a", first), credentials)
  })
})

test("binds encrypted credentials to the owning business", () => {
  withCredentialKey(() => {
    const ciphertext = encryptMpesaCredentials("business-a", credentials)
    assert.throws(
      () => decryptMpesaCredentials("business-b", ciphertext),
      MpesaCredentialError,
    )
  })
})

test("rejects a changed ciphertext authentication tag", () => {
  withCredentialKey(() => {
    const ciphertext = encryptMpesaCredentials("business-a", credentials)
    const altered = `${ciphertext.slice(0, -1)}${
      ciphertext.endsWith("A") ? "B" : "A"
    }`
    assert.throws(
      () => decryptMpesaCredentials("business-a", altered),
      MpesaCredentialError,
    )
  })
})

test("selects the Daraja environment only from server configuration", () => {
  const environment = process.env.MPESA_ENVIRONMENT
  const nodeEnvironment = process.env.NODE_ENV
  try {
    process.env.MPESA_ENVIRONMENT = "production"
    assert.equal(mpesaEnvironment(), "production")
    assert.match(mpesaEndpoints("sandbox").stkPush, /^https:\/\/sandbox\./)
    assert.match(mpesaEndpoints("production").stkPush, /^https:\/\/api\./)
    assert.match(
      mpesaEndpoints().stkPush,
      /^https:\/\/api\.safaricom\.co\.ke\//,
    )

    delete process.env.MPESA_ENVIRONMENT
    process.env.NODE_ENV = "production"
    assert.throws(() => mpesaEnvironment(), MpesaConfigurationError)
  } finally {
    if (environment === undefined) delete process.env.MPESA_ENVIRONMENT
    else process.env.MPESA_ENVIRONMENT = environment
    if (nodeEnvironment === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = nodeEnvironment
  }
})

test("rejects credential-like keys in general payment settings", () => {
  const config = {
    methods: {
      cash: true,
      mpesa: false,
      bank: false,
      card: false,
      credit: true,
    },
    mpesaConfig: { type: "till", till: "", paybill: "", account: "" },
    bankConfig: { name: "", account: "", branch: "" },
    roundCash: false,
    creditLimit: "5000",
    requireApproval: true,
    consumer_key: "must-not-be-stored",
  }

  assert.equal(containsSensitivePaymentFields(config), true)
  assert.equal(validPaymentConfig(config), false)
})

test("accepts only the defined public payment configuration fields", () => {
  const config = {
    methods: {
      cash: true,
      mpesa: false,
      bank: false,
      card: false,
      credit: true,
    },
    mpesaConfig: { type: "till", till: "", paybill: "", account: "" },
    bankConfig: { name: "", account: "", branch: "" },
    roundCash: false,
    creditLimit: "5000",
    requireApproval: true,
  }

  assert.equal(validPaymentConfig(config), true)
  assert.equal(
    validPaymentConfig({ ...config, merchantLabel: "Kiosk A" }),
    false,
  )
  assert.equal(
    validPaymentConfig({
      ...config,
      mpesaConfig: { ...config.mpesaConfig, internalNote: "not public" },
    }),
    false,
  )
})
