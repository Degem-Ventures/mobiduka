import { NextRequest, NextResponse } from "next/server.js"
import { createServerBusinessBackup } from "@/lib/create-server-business-backup"
import {
  getAutoBackupPeriodStart,
  isAutoBackupFrequency,
  isAutoBackupScheduledToday,
} from "@/lib/backup-schedule"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

function isAuthorizedCronRequest(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return true
  const configuredSecret = process.env.CRON_SECRET
  return Boolean(
    configuredSecret &&
      request.headers.get("authorization") === `Bearer ${configuredSecret}`,
  )
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized cron execution." }, {
      status: 401,
    })
  }

  try {
    const now = new Date()
    const settings = await prisma.businessSettings.findMany({
      where: { autoBackup: true },
      select: { businessId: true, autoBackupFrequency: true },
    })
    const result = { created: 0, failed: 0, skipped: 0 }

    for (const { businessId, autoBackupFrequency } of settings) {
      if (!isAutoBackupFrequency(autoBackupFrequency)) {
        result.failed++
        console.error(
          `Invalid automatic backup frequency for business ${businessId}.`,
          autoBackupFrequency,
        )
        continue
      }
      const frequency = autoBackupFrequency
      if (!isAutoBackupScheduledToday(now, frequency)) {
        result.skipped++
        continue
      }
      const periodStart = getAutoBackupPeriodStart(now, frequency)
      const existingAttempt = await prisma.cloudBackup.findFirst({
        where: {
          businessId,
          backupType: "SERVER",
          triggerType: "AUTO",
          createdAt: { gte: periodStart },
        },
        select: { id: true },
      })
      if (existingAttempt) {
        result.skipped++
        continue
      }

      try {
        await createServerBusinessBackup(businessId, null, "AUTO")
        result.created++
      } catch (error) {
        result.failed++
        console.error(
          `Automatic server backup failed for business ${businessId}.`,
          error,
        )
      }
    }

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("Automatic backup cron failed.", error)
    return NextResponse.json(
      { error: "Automatic backups could not be processed." },
      { status: 500 },
    )
  }
}
