import { NextResponse } from "next/server.js"
import { prisma } from "@/lib/prisma"
import { authenticatedBusinessId, requireBusinessAccess } from "@/lib/auth"
import {
  paymentConfigEnablesMpesa,
  validPaymentConfig,
} from "@/lib/payment-config"
import { hasMpesaIntegration } from "@/lib/mpesa-integration-store"
import { requireBusinessPermission } from "@/lib/permissions"

const RECEIPT_FORMATS = new Set(["80mm", "58mm", "a4", "sms"])
const TAX_RATES = new Set(["standard", "reduced", "zero", "exempt"])
const FILING_PERIODS = new Set(["Monthly", "Quarterly", "Annual"])
const defaultPaymentConfig = {
  methods: { cash: true, mpesa: false, bank: false, card: false, credit: true },
  mpesaConfig: { type: "till", till: "", paybill: "", account: "" },
  bankConfig: { name: "", account: "", branch: "" },
  roundCash: false,
  creditLimit: "5000",
  requireApproval: true,
}

function validReceiptConfig(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const config = value as Record<string, unknown>
  const stringFields = [
    "headerText",
    "footerText",
    "format",
    "receiptPrefix",
    "nextNumber",
  ]
  const booleanFields = [
    "showLogo",
    "showTax",
    "showDiscount",
    "showCashier",
    "showShift",
    "showBarcode",
  ]
  if (stringFields.some((field) => typeof config[field] !== "string"))
    return false
  if (booleanFields.some((field) => typeof config[field] !== "boolean"))
    return false
  return (
    RECEIPT_FORMATS.has(config.format as string) &&
    /^[A-Z0-9-]{1,12}$/.test((config.receiptPrefix as string).trim()) &&
    /^\d{1,12}$/.test((config.nextNumber as string).trim())
  )
}

function receiptConfigFallback(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const candidate = (value as Record<string, unknown>).receiptConfig
  return validReceiptConfig(candidate) ? candidate : null
}

function validTaxConfig(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const config = value as Record<string, unknown>
  return (
    typeof config.vatEnabled === "boolean" &&
    typeof config.etimsEnabled === "boolean" &&
    typeof config.etimsDevice === "string" &&
    TAX_RATES.has(config.defaultRate as string) &&
    FILING_PERIODS.has(config.filingPeriod as string)
  )
}

function configFallback(
  value: unknown,
  key: "receiptConfig" | "taxConfig",
  validate: (value: unknown) => boolean,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const candidate = (value as Record<string, unknown>)[key]
  return validate(candidate) ? candidate : null
}

const settingsSelect = {
  settings: {
    select: {
      receiptPrint: true,
      lowStockAlerts: true,
      salesNotifications: true,
      dailyReport: true,
      autoBackup: true,
      mpesaEnabled: true,
      themeMode: true,
      paymentConfig: true,
    },
  },
} as const

function responseFor(business: {
  settings: {
    receiptPrint: boolean
    lowStockAlerts: boolean
    salesNotifications: boolean
    dailyReport: boolean
    autoBackup: boolean
    mpesaEnabled: boolean
    themeMode: string
    paymentConfig: unknown
  } | null
}) {
  return {
    preferences: business.settings
      ? {
          ...business.settings,
          paymentConfig: validPaymentConfig(business.settings.paymentConfig)
            ? business.settings.paymentConfig
            : defaultPaymentConfig,
        }
      : {
          receiptPrint: true,
          lowStockAlerts: true,
          salesNotifications: true,
          dailyReport: false,
          autoBackup: true,
          mpesaEnabled: false,
          themeMode: "auto",
          paymentConfig: defaultPaymentConfig,
        },
  }
}

async function loadBusiness(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: settingsSelect,
  })
  if (!business) return null
  if (!business.settings) {
    await prisma.businessSettings.create({ data: { businessId } })
    return prisma.business.findUnique({
      where: { id: businessId },
      select: settingsSelect,
    })
  }
  return business
}

export async function GET(request: Request) {
  try {
    const businessId = authenticatedBusinessId(request)
    if (!businessId)
      return NextResponse.json(
        { error: "Authenticated business context is required." },
        { status: 401 },
      )
    const business = await loadBusiness(businessId)
    if (!business)
      return NextResponse.json({ error: "Business not found." }, {
        status: 404,
      })
    const params = new URL(request.url).searchParams
    const includeReceiptConfig = params.get("includeReceiptConfig") === "true"
    const includeTaxConfig = params.get("includeTaxConfig") === "true"
    const response = responseFor(business)
    if (includeReceiptConfig || includeTaxConfig) {
      try {
        const settings = await prisma.businessSettings.findUnique({
          where: { businessId },
          select: { receiptConfig: true, taxConfig: true },
        })
        return NextResponse.json({
          ...response,
          preferences: {
            ...response.preferences,
            ...(includeReceiptConfig
              ? { receiptConfig: settings?.receiptConfig ?? null }
              : {}),
            ...(includeTaxConfig
              ? { taxConfig: settings?.taxConfig ?? null }
              : {}),
          },
        })
      } catch {
        const settings = await prisma.businessSettings.findUnique({
          where: { businessId },
          select: { paymentConfig: true },
        })
        return NextResponse.json({
          ...response,
          preferences: {
            ...response.preferences,
            ...(includeReceiptConfig
              ? {
                  receiptConfig: receiptConfigFallback(settings?.paymentConfig),
                }
              : {}),
            ...(includeTaxConfig
              ? {
                  taxConfig: configFallback(
                    settings?.paymentConfig,
                    "taxConfig",
                    validTaxConfig,
                  ),
                }
              : {}),
          },
        })
      }
    }
    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load settings.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      businessId?: string
      receiptPrint?: boolean
      lowStockAlerts?: boolean
      salesNotifications?: boolean
      dailyReport?: boolean
      autoBackup?: boolean
      mpesaEnabled?: boolean
      themeMode?: string
      paymentConfig?: unknown
      receiptConfig?: unknown
      taxConfig?: unknown
    }
    const businessId = requireBusinessAccess(request, body.businessId)
    if (!businessId)
      return NextResponse.json(
        { error: "Authenticated business context is required." },
        { status: 401 },
      )
    if (body.paymentConfig !== undefined || body.mpesaEnabled !== undefined) {
      const paymentAccess = await requireBusinessPermission(
        request,
        businessId,
        "payments",
      )
      if (!paymentAccess) {
        return NextResponse.json(
          { error: "Payment configuration permission is required." },
          { status: 403 },
        )
      }
    }
    if (
      body.themeMode !== undefined &&
      !["light", "dark", "auto"].includes(body.themeMode)
    ) {
      return NextResponse.json({ error: "Unsupported theme mode." }, {
        status: 400,
      })
    }
    if (
      body.receiptConfig !== undefined &&
      !validReceiptConfig(body.receiptConfig)
    ) {
      return NextResponse.json({ error: "Receipt settings are invalid." }, {
        status: 400,
      })
    }
    if (body.taxConfig !== undefined && !validTaxConfig(body.taxConfig)) {
      return NextResponse.json({ error: "Tax settings are invalid." }, {
        status: 400,
      })
    }
    if (
      body.paymentConfig !== undefined &&
      !validPaymentConfig(body.paymentConfig)
    ) {
      return NextResponse.json({ error: "Payment settings are invalid." }, {
        status: 400,
      })
    }
    if (
      body.mpesaEnabled !== undefined &&
      typeof body.mpesaEnabled !== "boolean"
    ) {
      return NextResponse.json({ error: "M-Pesa status is invalid." }, {
        status: 400,
      })
    }
    const configuredMpesaEnabled =
      body.paymentConfig !== undefined
        ? paymentConfigEnablesMpesa(body.paymentConfig)
        : undefined
    if (
      configuredMpesaEnabled !== undefined &&
      body.mpesaEnabled !== undefined &&
      body.mpesaEnabled !== configuredMpesaEnabled
    ) {
      return NextResponse.json(
        { error: "M-Pesa status must match the selected payment methods." },
        { status: 400 },
      )
    }
    const requestedMpesaEnabled = configuredMpesaEnabled ?? body.mpesaEnabled
    if (
      requestedMpesaEnabled === true
    ) {
      if (!(await hasMpesaIntegration(businessId))) {
        return NextResponse.json(
          {
            error:
              "Configure M-Pesa credentials before enabling M-Pesa payments.",
          },
          { status: 400 },
        )
      }
    }
    const preferenceKeys = [
      "receiptPrint",
      "lowStockAlerts",
      "salesNotifications",
      "dailyReport",
      "autoBackup",
    ] as const
    const preferences = Object.fromEntries(
      preferenceKeys
        .filter((key) => body[key] !== undefined)
        .map((key) => [key, body[key]]),
    )
    const settingsData = {
      ...preferences,
      ...(requestedMpesaEnabled !== undefined
        ? { mpesaEnabled: requestedMpesaEnabled }
        : {}),
      ...(body.themeMode !== undefined ? { themeMode: body.themeMode } : {}),
      ...(body.paymentConfig !== undefined
        ? { paymentConfig: body.paymentConfig as object }
        : {}),
      ...(body.receiptConfig !== undefined
        ? { receiptConfig: body.receiptConfig as object }
        : {}),
      ...(body.taxConfig !== undefined
        ? { taxConfig: body.taxConfig as object }
        : {}),
    }
    if (Object.keys(settingsData).length > 0) {
      try {
        await prisma.businessSettings.upsert({
          where: { businessId },
          create: { businessId, ...settingsData },
          update: settingsData,
        })
      } catch (error) {
        if (body.receiptConfig === undefined && body.taxConfig === undefined)
          throw error
        const current = await prisma.businessSettings.findUnique({
          where: { businessId },
          select: { paymentConfig: true },
        })
        const paymentConfig = {
          ...(current?.paymentConfig &&
          typeof current.paymentConfig === "object" &&
          !Array.isArray(current.paymentConfig)
            ? current.paymentConfig as Record<string, unknown>
            : {}),
          ...(body.receiptConfig !== undefined
            ? { receiptConfig: body.receiptConfig }
            : {}),
          ...(body.taxConfig !== undefined
            ? { taxConfig: body.taxConfig }
            : {}),
        }
        const fallbackData = {
          ...preferences,
          ...(body.themeMode !== undefined
            ? { themeMode: body.themeMode }
            : {}),
          ...(body.paymentConfig !== undefined
            ? { paymentConfig: body.paymentConfig as object }
            : { paymentConfig }),
        }
        await prisma.businessSettings.upsert({
          where: { businessId },
          create: { businessId, ...fallbackData },
          update: fallbackData,
        })
      }
    }

    const business = await loadBusiness(businessId)
    if (!business)
      return NextResponse.json({ error: "Business not found." }, {
        status: 404,
      })
    return NextResponse.json(responseFor(business))
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to save settings.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
