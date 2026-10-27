import { NextRequest, NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { SUBSCRIPTION_GRACE_DAYS } from "@/lib/subscriptions";

export const runtime = "nodejs";

const THREE_DAYS_IN_MS = 3 * 24 * 60 * 60 * 1000;

type WarningEmail = {
  to: string;
  ownerName: string;
  businessName: string;
  expiryDate: Date;
  isTrial: boolean;
  isExpired: boolean;
};

function isAuthorizedCronRequest(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return true;
  const configuredSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  return Boolean(configuredSecret && authorization === `Bearer ${configuredSecret}`);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

function buildEmail({ to, ownerName, businessName, expiryDate, isTrial, isExpired }: WarningEmail) {
  const safeOwnerName = escapeHtml(ownerName);
  const safeBusinessName = escapeHtml(businessName);
  const expiryFormatted = expiryDate.toLocaleDateString("en-KE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Africa/Nairobi",
  });

  return {
    to,
    subject: isExpired
      ? `MobiDuka ${isTrial ? "trial" : "subscription"} expired: ${businessName}`
      : isTrial
        ? `MobiDuka ${businessName} TRIAL ends in 3 days`
        : `MobiDuka ${businessName} subscription expires in 3 days`,
    html: `
      <div style="font-family:Arial,sans-serif;padding:24px;color:#111827;background:#f8f9fa">
        <h2 style="color:#123A8F">MobiDuka POS Renewal Notice</h2>
        <p>Hello <strong>${safeOwnerName}</strong>,</p>
        <p>Your MobiDuka ${isTrial ? "trial" : "subscription"} for <strong>${safeBusinessName}</strong> ${isExpired ? "ended" : isTrial ? "ends" : "expires"} on <strong>${expiryFormatted}</strong>.</p>
        <p style="padding:12px;background:#fff3cd;border-left:4px solid #ffc107;color:#664d03">
          ${isExpired
            ? "New business records and synchronization are paused. Your historical data is retained. Please contact the MobiDuka team to restore write access."
            : "Please contact the MobiDuka team before this date to keep creating and synchronizing business records."}
        </p>
        ${isExpired ? "" : "<p>Use your approved MobiDuka billing workflow to complete renewal via Lipa Na M-Pesa.</p>"}
        <hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0" />
        <small style="color:#6b7280">MobiDuka SaaS Platform</small>
      </div>
    `,
  };
}

async function sendTransactionalEmail(email: ReturnType<typeof buildEmail>) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.BILLING_EMAIL_FROM;

  if (!apiKey || !from) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, ...email }),
  });

  if (!response.ok) {
    throw new Error(`Email provider returned HTTP ${response.status}.`);
  }

  return true;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized cron execution." }, { status: 401 });
  }

  try {
    const now = new Date();
    const lifecycleSubscriptions = await prisma.platformSubscription.findMany({
      where: { status: { in: ["TRIAL", "ACTIVE", "GRACE"] } },
      select: {
        id: true,
        status: true,
        trialEndsAt: true,
        currentPeriodEndsAt: true,
        graceEndsAt: true,
        business: {
          select: {
            name: true,
            users: {
              where: {
                status: "ACTIVE",
                email: { not: null },
                role: { name: { in: ["Admin", "OWNER"] } },
              },
              select: { fullName: true, email: true },
              orderBy: { createdAt: "asc" },
              take: 1,
            },
          },
        },
      },
    });
    let emailsDispatched = 0;
    let notificationsSkipped = 0;
    let failures = 0;

    for (const subscription of lifecycleSubscriptions) {
      let status = subscription.status;
      let graceEndsAt = subscription.graceEndsAt;
      if (status === "TRIAL" && (!subscription.trialEndsAt || subscription.trialEndsAt <= now)) {
        status = "EXPIRED";
      } else if (status === "ACTIVE" && (!subscription.currentPeriodEndsAt || subscription.currentPeriodEndsAt <= now)) {
        graceEndsAt ??= subscription.currentPeriodEndsAt
          ? new Date(subscription.currentPeriodEndsAt.getTime() + SUBSCRIPTION_GRACE_DAYS * 24 * 60 * 60 * 1000)
          : now;
        status = graceEndsAt > now ? "GRACE" : "EXPIRED";
      } else if (status === "GRACE" && (!graceEndsAt || graceEndsAt <= now)) {
        status = "EXPIRED";
      }
      if (status !== subscription.status || graceEndsAt !== subscription.graceEndsAt) {
        await prisma.platformSubscription.update({
          where: { id: subscription.id },
          data: { status, graceEndsAt },
        });
      }

      if (status === "EXPIRED" && subscription.status !== "EXPIRED") {
        const owner = subscription.business.users[0];
        const expiryDate = subscription.status === "TRIAL"
          ? subscription.trialEndsAt
          : subscription.graceEndsAt ?? subscription.currentPeriodEndsAt;
        if (!owner?.email || !expiryDate) {
          notificationsSkipped += 1;
          continue;
        }
        try {
          const sent = await sendTransactionalEmail(
            buildEmail({
              to: owner.email,
              ownerName: owner.fullName,
              businessName: subscription.business.name,
              expiryDate,
              isTrial: subscription.status === "TRIAL",
              isExpired: true,
            }),
          );
          if (sent) emailsDispatched += 1;
          else notificationsSkipped += 1;
        } catch (error) {
          failures += 1;
          console.error("Subscription expiry email failed:", error);
        }
      }
    }

    const targetStart = new Date(Date.now() + THREE_DAYS_IN_MS);
    targetStart.setUTCHours(0, 0, 0, 0);
    const targetEnd = new Date(targetStart);
    targetEnd.setUTCDate(targetEnd.getUTCDate() + 1);

    const expiringSubscriptions = await prisma.platformSubscription.findMany({
      where: {
        OR: [
          { status: "TRIAL", trialEndsAt: { gte: targetStart, lt: targetEnd } },
          { status: "ACTIVE", currentPeriodEndsAt: { gte: targetStart, lt: targetEnd } },
        ],
      },
      include: {
        business: {
          include: {
            users: {
              where: {
                status: "ACTIVE",
                email: { not: null },
                role: { name: { in: ["Admin", "OWNER"] } },
              },
              select: { fullName: true, email: true },
              orderBy: { createdAt: "asc" },
              take: 1,
            },
          },
        },
      },
    });

    for (const subscription of expiringSubscriptions) {
      const owner = subscription.business.users[0];
      if (!owner?.email) {
        notificationsSkipped += 1;
        continue;
      }

      try {
        const isTrial = subscription.status === "TRIAL";
        const sent = await sendTransactionalEmail(
          buildEmail({
            to: owner.email,
            ownerName: owner.fullName,
            businessName: subscription.business.name,
            expiryDate: isTrial ? subscription.trialEndsAt! : subscription.currentPeriodEndsAt!,
            isTrial,
            isExpired: false,
          }),
        );
        if (sent) emailsDispatched += 1;
        else notificationsSkipped += 1;
      } catch (error) {
        failures += 1;
        console.error("Billing warning email failed:", error);
      }
    }

    return NextResponse.json({
      success: failures === 0,
      scanned: expiringSubscriptions.length,
      emailsDispatched,
      notificationsSkipped,
      failures,
      emailProviderConfigured: Boolean(process.env.RESEND_API_KEY && process.env.BILLING_EMAIL_FROM),
    });
  } catch (error) {
    console.error("Billing warning cron failed:", error);
    return NextResponse.json({ error: "Billing warning scan failed." }, { status: 500 });
  }
}
