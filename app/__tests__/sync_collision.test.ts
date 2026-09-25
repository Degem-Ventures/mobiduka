import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, beforeEach, describe, it } from "node:test";

import { POST } from "../api/sync/route";
import { prisma } from "../../lib/prisma";
import { JWT_SECRET } from "../../lib/auth";

const mockBusinessId = "biz_production_test_01";
const mockEntity = "Sale";
const mockExternalId = "sale_invoice_77777";

function signJwt(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

function createRequest(body: unknown, businessId: string) {
  const token = signJwt({ businessId, exp: Math.floor(Date.now() / 1000) + 3600, sub: "test-user" });
  return new Request("https://example.com/api/sync", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

function createSalePayload(id: string, total: number) {
  return {
    id,
    businessId: mockBusinessId,
    saleNumber: `INV-${id}`,
    subtotal: total,
    discount: 0,
    tax: 0,
    total,
    saleStatus: "OPEN",
    paymentStatus: "PENDING",
    createdAt: new Date().toISOString(),
  };
}

describe("Sync ingestion collision ledger", () => {
  beforeEach(async () => {
    await prisma.syncQueue.deleteMany({ where: { businessId: mockBusinessId } });
    await prisma.auditLog.deleteMany({ where: { businessId: mockBusinessId } });
    await prisma.syncReceipt.deleteMany({ where: { businessId: mockBusinessId } });
    await prisma.saleItem.deleteMany({ where: { sale: { businessId: mockBusinessId } } });
    await prisma.payment.deleteMany({ where: { sale: { businessId: mockBusinessId } } });
    await prisma.sale.deleteMany({ where: { businessId: mockBusinessId } });
    await prisma.device.deleteMany({ where: { businessId: mockBusinessId } });
    await prisma.user.deleteMany({ where: { businessId: mockBusinessId } });

    await prisma.business.upsert({
      where: { id: mockBusinessId },
      update: { status: "ACTIVE" },
      create: {
        id: mockBusinessId,
        name: "Collision Test Business",
        status: "ACTIVE",
      },
    });

    await prisma.user.create({
      data: {
        id: "user_alpha",
        businessId: mockBusinessId,
        fullName: "Alpha Tester",
        email: "alpha@example.com",
        status: "ACTIVE",
      },
    });

    await prisma.device.create({
      data: {
        id: "device_alpha",
        businessId: mockBusinessId,
        userId: "user_alpha",
        deviceName: "Test Device",
        deviceUuid: "device_alpha",
        platform: "web",
        status: "ACTIVE",
      },
    });
  });

  after(async () => {
    await prisma.syncQueue.deleteMany({ where: { businessId: mockBusinessId } });
    await prisma.auditLog.deleteMany({ where: { businessId: mockBusinessId } });
    await prisma.syncReceipt.deleteMany({ where: { businessId: mockBusinessId } });
    await prisma.saleItem.deleteMany({ where: { sale: { businessId: mockBusinessId } } });
    await prisma.payment.deleteMany({ where: { sale: { businessId: mockBusinessId } } });
    await prisma.sale.deleteMany({ where: { businessId: mockBusinessId } });
    await prisma.device.deleteMany({ where: { businessId: mockBusinessId } });
    await prisma.user.deleteMany({ where: { businessId: mockBusinessId } });
    await prisma.business.deleteMany({ where: { id: mockBusinessId } });
    await prisma.$disconnect();
  });

  it("acknowledges exact duplicate replays and rejects divergent payload hashes for the same logical key", async () => {
    const initialRecord = {
      id: "client_id_001",
      entityName: mockEntity,
      operation: "CREATE",
      externalId: mockExternalId,
      payloadHash: "hash_signature_alpha_000",
      payload: createSalePayload(mockExternalId, 1500),
      createdAt: new Date().toISOString(),
    };

    const res1 = await POST(createRequest({
      businessId: mockBusinessId,
      deviceId: "device_alpha",
      userId: "user_alpha",
      records: [initialRecord],
    }, mockBusinessId));

    const data1 = await res1.json();
    assert.equal(res1.status, 200);
    assert.equal(data1.success, true);
    assert.equal(data1.processedCount, 1);

    const savedReceipt = await prisma.syncReceipt.findUnique({
      where: {
        businessId_entityName_externalId: {
          businessId: mockBusinessId,
          entityName: mockEntity,
          externalId: mockExternalId,
        },
      },
    });

    assert.ok(savedReceipt);
    assert.equal(savedReceipt?.payloadHash, "hash_signature_alpha_000");
    assert.equal(savedReceipt?.status, "APPLIED");

    const replayRes = await POST(createRequest({
      businessId: mockBusinessId,
      deviceId: "device_alpha",
      userId: "user_alpha",
      records: [initialRecord],
    }, mockBusinessId));

    const replayBody = await replayRes.json();
    assert.equal(replayRes.status, 200);
    assert.equal(replayBody.success, true);
    assert.equal(replayBody.processedCount, 1);

    const compromisedRecord = {
      ...initialRecord,
      id: "client_id_002",
      payloadHash: "hash_signature_compromised_999",
      payload: createSalePayload(mockExternalId, 99999),
    };

    const collisionRes = await POST(createRequest({
      businessId: mockBusinessId,
      deviceId: "device_alpha",
      userId: "user_alpha",
      records: [compromisedRecord],
    }, mockBusinessId));

    const collisionBody = await collisionRes.json();
    assert.equal(collisionRes.status, 500);
    assert.match(collisionBody.details, /Payload collision/i);

    const retainedSale = await prisma.sale.findUnique({
      where: { id: mockExternalId },
    });

    assert.ok(retainedSale);
    assert.equal(retainedSale?.total, 1500);
  });
});
