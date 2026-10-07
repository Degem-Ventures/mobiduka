import test from "node:test"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { prisma } from "../lib/prisma.ts"
import {
  GET,
  PUT,
} from "../app/api/cash/session/device/route.ts"

function makeJwtForBusiness(businessId: string, userId: string) {
  const secret =
    process.env.JWT_SECRET || "mobiduka-local-dev-secret-change-me"
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url")
  const payload = Buffer.from(
    JSON.stringify({
      businessId,
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url")
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url")
  return `${header}.${payload}.${signature}`
}

test("current cash session selection persists on its registered device", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  let businessId = ""
  let deviceUuid = ""

  try {
    const business = await prisma.business.create({
      data: {
        name: `Test Device Shift ${suffix}`,
        currency: "KES",
        timezone: "Africa/Nairobi",
        status: "ACTIVE",
      },
    })
    businessId = business.id
    const role = await prisma.role.create({
      data: {
        businessId,
        name: "CASHIER",
        permissions: { create: [{ permissionKey: "pos" }] },
      },
    })
    const user = await prisma.user.create({
      data: {
        businessId,
        roleId: role.id,
        fullName: "Device Shift Cashier",
        username: `device-shift-${suffix}`,
        email: `device-shift-${suffix}@example.com`,
        status: "ACTIVE",
      },
    })
    const cashSession = await prisma.cashSession.create({
      data: {
        businessId,
        cashierId: user.id,
        shiftType: "morning",
        openingBalance: 0,
      },
    })
    deviceUuid = crypto.randomUUID()
    const token = makeJwtForBusiness(businessId, user.id)
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }

    const registerResponse = await GET(
      new Request(
        `http://localhost/api/cash/session/device?businessId=${businessId}&deviceUuid=${deviceUuid}`,
        { headers },
      ),
    )
    assert.equal(registerResponse.status, 200)
    assert.equal((await registerResponse.json()).currentShiftId, null)

    const assignResponse = await PUT(
      new Request("http://localhost/api/cash/session/device", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          businessId,
          deviceUuid,
          cashSessionId: cashSession.id,
        }),
      }),
    )
    assert.equal(assignResponse.status, 200)

    const reloadResponse = await GET(
      new Request(
        `http://localhost/api/cash/session/device?businessId=${businessId}&deviceUuid=${deviceUuid}`,
        { headers },
      ),
    )
    assert.equal(reloadResponse.status, 200)
    assert.equal(
      (await reloadResponse.json()).currentShiftId,
      cashSession.id,
      "the selected shift should remain assigned after reloading the device",
    )
  } finally {
    if (businessId) {
      await prisma.device.deleteMany({ where: { businessId } })
      await prisma.cashSession.deleteMany({ where: { businessId } })
      await prisma.user.deleteMany({ where: { businessId } })
      await prisma.role.deleteMany({ where: { businessId } })
      await prisma.business.delete({ where: { id: businessId } })
    }
  }
})
