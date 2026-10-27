import assert from "node:assert/strict"
import test from "node:test"
import { Prisma } from "@prisma/client"
import { GET as getAdminWorkspace } from "../app/api/admin/workspaces/route.ts"
import { createAuthToken } from "../lib/auth.ts"
import { requirePlatformAdmin } from "../lib/platform-admin.ts"

const activeAdminId = "active-admin-id"
const inactiveAdminId = "inactive-admin-id"

function requestWithToken(token: string) {
  return new Request(
    "http://localhost/api/admin/workspaces?workspace=unknown",
    {
      headers: { authorization: `Bearer ${token}` },
    },
  )
}

function platformAdminToken(overrides: Record<string, unknown> = {}) {
  return createAuthToken({
    sub: activeAdminId,
    role: "SUPER_ADMIN",
    scope: "platform-admin",
    exp: Math.floor(Date.now() / 1000) + 60,
    ...overrides,
  })
}

test("admin workspace route rejects requests without an admin token", async () => {
  const response = await getAdminWorkspace(
    new Request("http://localhost/api/admin/workspaces?workspace=transactions"),
  )

  assert.equal(response.status, 403)
  assert.equal(response.headers.get("cache-control"), "no-store")
})

test("admin access rejects invalid, expired, and merchant tokens before lookup", async () => {
  let lookupCount = 0
  const lookup = async () => {
    lookupCount += 1
    return { id: activeAdminId }
  }

  const requests = [
    requestWithToken("not-a-valid-token"),
    requestWithToken(
      platformAdminToken({ exp: Math.floor(Date.now() / 1000) - 1 }),
    ),
    requestWithToken(platformAdminToken({ role: "OWNER" })),
    requestWithToken(platformAdminToken({ scope: "business" })),
  ]

  for (const request of requests) {
    assert.equal(await requirePlatformAdmin(request, lookup), null)
  }
  assert.equal(lookupCount, 0)
})

test("admin access rejects an inactive platform admin", async () => {
  const request = requestWithToken(platformAdminToken({ sub: inactiveAdminId }))
  const lookedUpIds: string[] = []
  const result = await requirePlatformAdmin(request, async (adminId) => {
    lookedUpIds.push(adminId)
    return null
  })

  assert.equal(result, null)
  assert.deepEqual(lookedUpIds, [inactiveAdminId])
})

test("active SUPER_ADMIN token passes the database-backed active-status lookup", async () => {
  const request = requestWithToken(platformAdminToken())
  const result = await requirePlatformAdmin(request, async (adminId) =>
    adminId === activeAdminId ? { id: activeAdminId } : null,
  )

  assert.deepEqual(result, { id: activeAdminId })
})

test("expected live workspace models match the generated Prisma schema", () => {
  const models = new Set(
    Prisma.dmmf.datamodel.models.map((model) => model.name),
  )
  const expectedModels = [
    "Sale",
    "MpesaTransaction",
    "SyncQueue",
    "CloudBackup",
    "Device",
    "Role",
    "AuditLog",
    "PlatformSubscription",
    "BusinessSettings",
    "MpesaIntegration",
  ]

  for (const model of expectedModels) {
    assert.ok(models.has(model), `Expected Prisma model ${model}`)
  }
  assert.equal(models.has("Transaction"), false)
})
