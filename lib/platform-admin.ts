import { authenticatedPlatformAdminId } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export type PlatformAdminLookup = (
  adminId: string,
) => Promise<{ id: string } | null>

export async function requirePlatformAdmin(
  request: Request,
  findActiveAdmin: PlatformAdminLookup = (adminId) =>
    prisma.platformAdmin.findFirst({
      where: { id: adminId, status: "ACTIVE" },
      select: { id: true },
    }),
) {
  const adminId = authenticatedPlatformAdminId(request)
  if (!adminId) return null
  return findActiveAdmin(adminId)
}
