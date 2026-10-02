import { authenticatedUserId, requireBusinessAccess } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PERMISSION_KEYS } from "@/lib/roles"

export type AuthorizedBusinessContext = {
  businessId: string
  userId: string
}

export async function requireBusinessPermission(
  request: Request,
  requestedBusinessId: unknown,
  permissionKey: string,
): Promise<AuthorizedBusinessContext | null> {
  if (!PERMISSION_KEYS.has(permissionKey)) return null

  const businessId = requireBusinessAccess(request, requestedBusinessId)
  const userId = authenticatedUserId(request)
  if (!businessId || !userId) return null

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      businessId,
      status: "ACTIVE",
      role: {
        permissions: {
          some: { permissionKey },
        },
      },
    },
    select: { id: true },
  })

  return user ? { businessId, userId } : null
}
