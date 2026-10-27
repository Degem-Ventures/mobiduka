import { NextResponse } from "next/server.js"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin } from "@/lib/platform-admin"

const pageSize = 50

export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: "SUPER_ADMIN access is required." }, {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    })
  }

  const params = new URL(request.url).searchParams
  const requestedPage = Number.parseInt(params.get("page") ?? "1", 10)
  const page = Number.isSafeInteger(requestedPage)
    ? Math.min(1_000_000, Math.max(1, requestedPage))
    : 1
  const query = params.get("q")?.trim().slice(0, 100) ?? ""
  const role = params.get("role")?.trim()
  const where: Prisma.UserWhereInput = {}
  if (role && role !== "all") where.role = { is: { name: role } }
  if (query) {
    where.OR = [
      { id: { contains: query, mode: "insensitive" } },
      { fullName: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { business: { name: { contains: query, mode: "insensitive" } } },
    ]
  }

  try {
    const [users, total, roles, unassignedRoleCount] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          status: true,
          lastLogin: true,
          createdAt: true,
          role: { select: { name: true } },
          business: { select: { id: true, name: true, branch: true } },
          _count: { select: { devices: true } },
          devices: {
            where: { lastSeen: { not: null } },
            orderBy: { lastSeen: "desc" },
            take: 1,
            select: { lastSeen: true },
          },
        },
      }),
      prisma.user.count({ where }),
      prisma.role.findMany({
        select: { name: true, _count: { select: { users: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.user.count({ where: { roleId: null } }),
    ])

    const roleCounts = roles.reduce<Map<string, number>>((counts, entry) => {
      counts.set(entry.name, (counts.get(entry.name) ?? 0) + entry._count.users)
      return counts
    }, new Map())

    return NextResponse.json(
      {
        users: users.map((user) => ({
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          status: user.status,
          role: user.role?.name ?? "Unassigned",
          business: user.business,
          deviceCount: user._count.devices,
          lastSeen: user.devices[0]?.lastSeen ?? user.lastLogin,
          createdAt: user.createdAt,
        })),
        total,
        page,
        pageSize,
        roleCounts: [
          ...Array.from(roleCounts, ([name, count]) => ({
            role: name,
            count,
          })),
          ...(unassignedRoleCount > 0
            ? [{ role: "Unassigned", count: unassignedRoleCount }]
            : []),
        ],
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("Platform identity list failed:", error)
    return NextResponse.json({ error: "Unable to load platform users." }, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    })
  }
}
