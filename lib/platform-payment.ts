import { prisma } from "@/lib/prisma"
import { queryPlatformStkStatus } from "@/lib/platform-mpesa"

const transientResultCodes = new Set([1037, 4999])

export async function reconcilePlatformPayment(paymentId: string) {
  const payment = await prisma.platformPayment.findUnique({ where: { id: paymentId } })
  if (!payment) throw new Error("Subscription payment was not found.")
  if (payment.status !== "PENDING" || !payment.checkoutRequestId) return payment.status

  const providerResult = await queryPlatformStkStatus(payment.checkoutRequestId)
  if (
    providerResult.resultCode === null ||
    !Number.isSafeInteger(providerResult.resultCode) ||
    transientResultCodes.has(providerResult.resultCode)
  ) {
    return "PENDING"
  }

  if (providerResult.resultCode !== 0) {
    await prisma.$transaction(async (transaction) => {
      const updated = await transaction.platformPayment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: {
          status: "FAILED",
          resultCode: providerResult.resultCode,
          resultDescription: providerResult.resultDescription.slice(0, 500) || "M-PESA payment was not completed.",
        },
      })
      if (updated.count) {
        await transaction.auditLog.create({
          data: {
            businessId: payment.businessId,
            action: "SUBSCRIPTION_PAYMENT_FAILED",
            tableName: "PlatformPayment",
            recordId: payment.id,
          },
        })
      }
    })
    return "FAILED"
  }

  if (payment.resultCode !== 0) return "PENDING"

  if (
    payment.reportedAmountKsh !== payment.amountKsh ||
    !payment.receiptNumber?.trim()
  ) {
    await prisma.$transaction(async (transaction) => {
      const updated = await transaction.platformPayment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: {
          status: "REVIEW",
          resultCode: 0,
          resultDescription: "Safaricom confirmed payment, but callback amount or receipt is missing or does not match.",
        },
      })
      if (updated.count) {
        await transaction.auditLog.create({
          data: {
            businessId: payment.businessId,
            action: "SUBSCRIPTION_PAYMENT_REVIEW_REQUIRED",
            tableName: "PlatformPayment",
            recordId: payment.id,
          },
        })
      }
    })
    return "REVIEW"
  }

  await prisma.$transaction(async (transaction) => {
    const updated = await transaction.platformPayment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: {
        status: "PAID",
        resultCode: 0,
        resultDescription: providerResult.resultDescription.slice(0, 500) || "Payment confirmed.",
      },
    })
    if (!updated.count) return

    const plan = await transaction.subscriptionPlan.findUnique({
      where: { name: payment.planName },
      select: { monthlyPriceKsh: true },
    })
    if (!plan) throw new Error(`Paid plan ${payment.planName} no longer exists.`)

    const subscription = await transaction.platformSubscription.findUnique({
      where: { businessId: payment.businessId },
      select: { currentPeriodEndsAt: true },
    })
    if (!subscription) throw new Error(`Subscription for business ${payment.businessId} was not found.`)

    const now = new Date()
    const periodStart = subscription.currentPeriodEndsAt && subscription.currentPeriodEndsAt > now
      ? subscription.currentPeriodEndsAt
      : now
    await transaction.platformSubscription.update({
      where: { businessId: payment.businessId },
      data: {
        planType: payment.planName.toUpperCase(),
        status: "ACTIVE",
        trialEndsAt: null,
        currentPeriodEndsAt: new Date(periodStart.getTime() + payment.billingDays * 24 * 60 * 60 * 1000),
        graceEndsAt: null,
        licenseCost: plan.monthlyPriceKsh,
        autoRenewActive: false,
        isTrialClaimed: true,
      },
    })
    await transaction.auditLog.create({
      data: {
        businessId: payment.businessId,
        action: "SUBSCRIPTION_PAYMENT_COMPLETED",
        tableName: "PlatformPayment",
        recordId: payment.id,
      },
    })
  })

  return "PAID"
}
