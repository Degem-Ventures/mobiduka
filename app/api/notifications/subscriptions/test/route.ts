import { NextResponse } from "next/server.js"
import { authenticatedUserId, requireBusinessAccess } from "@/lib/auth"
import { sendPushNotificationToTokens } from "@/lib/firebase-admin"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { businessId?: string }
    const businessId = requireBusinessAccess(request, body.businessId)
    const userId = authenticatedUserId(request)
    if (!businessId || !userId) {
      return NextResponse.json(
        { error: "Authenticated business and user are required." },
        { status: 401 },
      )
    }

    const subscriptions = await prisma.notificationSubscription.findMany({
      where: {
        businessId,
        userId,
        platform: { in: ["android", "ios"] },
      },
      select: { token: true },
    })
    if (subscriptions.length === 0) {
      return NextResponse.json(
        {
          error:
            "This account has no registered native push token for this device.",
        },
        { status: 404 },
      )
    }

    const result = await sendPushNotificationToTokens(
      subscriptions.map(({ token }) => token),
      "MobiDuka push test",
      "Your Capacitor app is connected to Firebase Cloud Messaging.",
      { type: "push_test", businessId },
    )
    if (result.sent === 0) {
      return NextResponse.json(
        {
          error:
            "Firebase did not accept the test notification. Check server Firebase credentials and that the app token belongs to the same Firebase project.",
          failed: result.failed,
        },
        { status: 502 },
      )
    }
    return NextResponse.json({
      success: true,
      message:
        "Firebase accepted the test notification. Check the device notification tray.",
      sent: result.sent,
      failed: result.failed,
    })
  } catch (error) {
    console.error("Native push test failed.", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Unable to send push test: ${error.message}`
            : "Unable to send push test.",
      },
      { status: 500 },
    )
  }
}
