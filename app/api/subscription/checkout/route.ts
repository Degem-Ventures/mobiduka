import { NextResponse } from "next/server.js"
import { authenticatedBusinessId, authenticatedUserId } from "@/lib/auth"
import { createPlatformStkPush, normalizePlatformPhone } from "@/lib/platform-mpesa"
import { reconcilePlatformPayment } from "@/lib/platform-payment"
import { prisma } from "@/lib/prisma"
import { MpesaConfigurationError } from "@/lib/mpesa"

export const runtime = "nodejs"

async function requireOwner(request: Request) {
  const businessId = authenticatedBusinessId(request)
  const userId = authenticatedUserId(request)
  if (!businessId || !userId) return null
  const owner = await prisma.user.findFirst({
    where: {
      id: userId,
      businessId,
      status: "ACTIVE",
      role: { name: { in: ["Admin", "OWNER", "ADMIN"] } },
    },
    select: { id: true },
  })
  return owner ? { businessId, userId } : null
}

export async function GET(request: Request) {
  const owner = await requireOwner(request)
  if (!owner) {
    return NextResponse.json({ error: "Business owner access is required." }, { status: 403 })
  }
  const paymentId = new URL(request.url).searchParams.get("paymentId")?.trim()
  if (!paymentId) return NextResponse.json({ error: "paymentId is required." }, { status: 400 })

  const payment = await prisma.platformPayment.findFirst({
    where: { id: paymentId, businessId: owner.businessId },
    select: {
      id: true,
      planName: true,
      amountKsh: true,
      status: true,
      resultDescription: true,
      receiptNumber: true,
      checkoutRequestId: true,
    },
  })
  if (!payment) return NextResponse.json({ error: "Payment attempt was not found." }, { status: 404 })
  if (payment.status === "PENDING" && payment.checkoutRequestId) {
    try {
      await reconcilePlatformPayment(payment.id)
    } catch (error) {
      console.error("Platform payment status reconciliation failed:", error)
      return NextResponse.json({ error: "Unable to verify payment status with Safaricom. Try again shortly." }, { status: 502 })
    }
  }
  const currentPayment = await prisma.platformPayment.findFirst({
    where: { id: paymentId, businessId: owner.businessId },
    select: {
      id: true,
      planName: true,
      amountKsh: true,
      status: true,
      resultDescription: true,
      receiptNumber: true,
    },
  })
  return NextResponse.json({ payment: currentPayment }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const owner = await requireOwner(request)
  if (!owner) {
    return NextResponse.json({ error: "Business owner access is required." }, { status: 403 })
  }

  try {
    const body = await request.json() as {
      planName?: unknown
      billingPeriod?: unknown
      phoneNumber?: unknown
    }
    const planName = typeof body.planName === "string" ? body.planName.trim() : ""
    if (
      body.billingPeriod !== undefined &&
      body.billingPeriod !== "monthly" &&
      body.billingPeriod !== "annual"
    ) {
      return NextResponse.json({ error: "billingPeriod must be monthly or annual." }, { status: 400 })
    }
    const billingPeriod = body.billingPeriod === "annual" ? "annual" : "monthly"
    const phoneNumber = normalizePlatformPhone(body.phoneNumber)
    if (!phoneNumber) {
      return NextResponse.json({ error: "Enter a valid Kenyan mobile number." }, { status: 400 })
    }

    const plan = await prisma.subscriptionPlan.findFirst({
      where: { name: planName, isActive: true, onlineCheckoutEnabled: true },
      select: {
        name: true,
        monthlyPriceKsh: true,
        publicMonthlyPriceKsh: true,
        annualPriceKsh: true,
      },
    })
    if (!plan) {
      return NextResponse.json({ error: "This plan is not available for online checkout." }, { status: 400 })
    }
    const amountKsh = billingPeriod === "annual"
      ? plan.annualPriceKsh
      : plan.publicMonthlyPriceKsh
    if (!amountKsh || !Number.isSafeInteger(amountKsh) || amountKsh < 1) {
      return NextResponse.json({ error: `An approved ${billingPeriod} price is not configured for this plan.` }, { status: 400 })
    }

    const attempt = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Business" WHERE "id" = ${owner.businessId} FOR UPDATE
      `
      const activePayment = await transaction.platformPayment.findFirst({
        where: {
          businessId: owner.businessId,
          status: { in: ["PENDING", "REVIEW"] },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, planName: true, amountKsh: true, status: true },
      })
      if (activePayment) return { payment: activePayment, reused: true }
      const payment = await transaction.platformPayment.create({
        data: {
          businessId: owner.businessId,
          planName: plan.name,
          amountKsh,
          billingDays: billingPeriod === "annual" ? 365 : 30,
          phoneNumber,
        },
        select: { id: true, planName: true, amountKsh: true, status: true },
      })
      return { payment, reused: false }
    })
    if (attempt.reused) {
      return NextResponse.json({
        paymentId: attempt.payment.id,
        planName: attempt.payment.planName,
        amountKsh: attempt.payment.amountKsh,
        status: attempt.payment.status,
        message: attempt.payment.status === "REVIEW"
          ? "A previous payment requires manual reconciliation before another checkout can start."
          : "A subscription payment is already being processed. Wait for its result before starting another.",
      })
    }
    const payment = attempt.payment

    try {
      const push = await createPlatformStkPush({
        phoneNumber,
        amountKsh: payment.amountKsh,
        accountReference: `MD${payment.id.replace(/-/g, "").slice(0, 10)}`,
      })
      await prisma.platformPayment.update({
        where: { id: payment.id },
        data: {
          merchantRequestId: push.merchantRequestId,
          checkoutRequestId: push.checkoutRequestId,
        },
      })
      await prisma.auditLog.create({
        data: {
          businessId: owner.businessId,
          userId: owner.userId,
          action: "SUBSCRIPTION_PAYMENT_INITIATED",
          tableName: "PlatformPayment",
          recordId: payment.id,
        },
      })
      return NextResponse.json({
        paymentId: payment.id,
        planName: plan.name,
        amountKsh,
        status: "PENDING",
      }, { status: 201 })
    } catch (error) {
      await prisma.platformPayment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          resultDescription: error instanceof Error ? error.message.slice(0, 500) : "Unable to start M-PESA checkout.",
        },
      })
      throw error
    }
  } catch (error) {
    if (error instanceof MpesaConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Platform subscription checkout initiation failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start subscription checkout." },
      { status: 502 },
    )
  }
}
