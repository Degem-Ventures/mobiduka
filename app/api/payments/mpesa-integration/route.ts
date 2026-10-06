import { NextResponse } from "next/server.js"
import {
  decryptMpesaCredentials,
  encryptMpesaCredentials,
  MpesaCredentialError,
  type MpesaCredentials,
} from "@/lib/mpesa-credentials"
import {
  findMpesaIntegration,
  isMissingMpesaIntegrationSchema,
  upsertMpesaIntegration,
} from "@/lib/mpesa-integration-store"
import { requireBusinessPermission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

type PublicMpesaIntegration = {
  configured: boolean
  environment?: "sandbox" | "production"
  accountType?: "TILL" | "PAYBILL"
  shortcode?: string
  accountReference?: string | null
  updatedAt?: string
}

type IntegrationRequest = {
  businessId?: string
  environment?: unknown
  accountType?: unknown
  shortcode?: unknown
  accountReference?: unknown
  consumerKey?: unknown
  consumerSecret?: unknown
  passkey?: unknown
}

class MpesaIntegrationInputError extends Error {}

function publicIntegration(
  value: {
    environment: string
    accountType: string
    shortcode: string
    accountReference: string | null
    updatedAt: Date
  } | null,
): PublicMpesaIntegration {
  if (!value) return { configured: false }
  if (!value) return { configured: false, environment: "sandbox" }
  return {
    configured: true,
    environment: value.environment === "production" ? "production" : "sandbox",
    accountType: value.accountType === "TILL" ? "TILL" : "PAYBILL",
    shortcode: value.shortcode,
    accountReference: value.accountReference,
    updatedAt: value.updatedAt.toISOString(),
  }
}

function requiredText(value: unknown, field: string, maxLength = 512) {
  if (typeof value !== "string") {
    throw new MpesaIntegrationInputError(`${field} is required.`)
  }
  const text = value.trim()
  if (!text || text.length > maxLength) {
    throw new MpesaIntegrationInputError(`${field} is invalid.`)
  }
  return text
}

function optionalSecret(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null
  return requiredText(value, field)
}

function validatePublicFields(body: IntegrationRequest) {
  const environment = requiredText(
    body.environment,
    "Daraja environment",
    16,
  ).toLowerCase()
  if (environment !== "sandbox" && environment !== "production") {
    throw new MpesaIntegrationInputError(
      "Daraja environment must be Sandbox or Production.",
    )
  }
  const accountType = requiredText(
    body.accountType,
    "Account type",
    16,
  ).toUpperCase()
  if (accountType !== "TILL" && accountType !== "PAYBILL") {
    throw new MpesaIntegrationInputError(
      "Account type must be Till or Paybill.",
    )
  }
  const shortcode = requiredText(body.shortcode, "Till or paybill number", 8)
  if (!/^\d{5,8}$/.test(shortcode)) {
    throw new MpesaIntegrationInputError(
      "Till or paybill number must contain 5 to 8 digits.",
    )
  }
  const accountReference = requiredText(
    body.accountReference,
    "Account reference",
    12,
  )
  if (!/^[A-Za-z0-9 ._-]+$/.test(accountReference)) {
    throw new MpesaIntegrationInputError(
      "Account reference contains unsupported characters.",
    )
  }
  return {
    environment: environment as "sandbox" | "production",
    accountType: accountType as "TILL" | "PAYBILL",
    shortcode,
    accountReference,
  }
}

function mergedCredentials(
  body: IntegrationRequest,
  existing: MpesaCredentials | null,
) {
  const consumerKey = optionalSecret(body.consumerKey, "Consumer key")
  const consumerSecret = optionalSecret(body.consumerSecret, "Consumer secret")
  const passkey = optionalSecret(body.passkey, "Online passkey")
  const credentials = {
    consumerKey: consumerKey ?? existing?.consumerKey,
    consumerSecret: consumerSecret ?? existing?.consumerSecret,
    passkey: passkey ?? existing?.passkey,
  }

  if (
    !credentials.consumerKey ||
    !credentials.consumerSecret ||
    !credentials.passkey
  ) {
    throw new MpesaIntegrationInputError(
      "Consumer key, consumer secret, and online passkey are required for the first M-Pesa setup.",
    )
  }
  return credentials as MpesaCredentials
}

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    const access =
      (await requireBusinessPermission(request, businessId, "payments")) ??
      (await requireBusinessPermission(request, businessId, "pos"))
    if (!access) {
      return NextResponse.json(
        { error: "POS or payment configuration permission is required." },
        { status: 403 },
      )
    }

    const integration = await findMpesaIntegration(access.businessId)
    return NextResponse.json({ integration: publicIntegration(integration) })
  } catch (error) {
    if (isMissingMpesaIntegrationSchema(error)) {
      return NextResponse.json(
        {
          error:
            "M-Pesa setup is pending a database migration. Deploy the latest migration, then reload this page.",
        },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { error: "Unable to load M-Pesa configuration." },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as IntegrationRequest
    const access = await requireBusinessPermission(
      request,
      body.businessId,
      "payments",
    )
    if (!access) {
      return NextResponse.json(
        { error: "Payment configuration permission is required." },
        { status: 403 },
      )
    }

    const publicFields = validatePublicFields(body)
    const existing = await findMpesaIntegration(access.businessId)
    const existingCredentials = existing
      ? decryptMpesaCredentials(
          access.businessId,
          existing.credentialCiphertext,
        )
      : null
    const credentials = mergedCredentials(body, existingCredentials)
    const credentialCiphertext = encryptMpesaCredentials(
      access.businessId,
      credentials,
    )

    const integration = await prisma.$transaction(async (tx) => {
      const saved = await upsertMpesaIntegration(
        {
          businessId: access.businessId,
          ...publicFields,
          credentialCiphertext,
        },
        tx,
      )
      await tx.auditLog.create({
        data: {
          businessId: access.businessId,
          userId: access.userId,
          action: existing
            ? "MPESA_INTEGRATION_UPDATED"
            : "MPESA_INTEGRATION_CONFIGURED",
          tableName: "MpesaIntegration",
          recordId: saved.id,
        },
      })
      return saved
    })

    return NextResponse.json({ integration: publicIntegration(integration) })
  } catch (error) {
    if (isMissingMpesaIntegrationSchema(error)) {
      return NextResponse.json(
        {
          error:
            "M-Pesa setup is pending a database migration. Deploy the latest migration, then try again.",
        },
        { status: 503 },
      )
    }
    if (error instanceof MpesaCredentialError) {
      return NextResponse.json(
        { error: "M-Pesa credentials could not be stored securely." },
        { status: 500 },
      )
    }
    if (error instanceof MpesaIntegrationInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json(
      { error: "Unable to save M-Pesa configuration." },
      { status: 500 },
    )
  }
}
