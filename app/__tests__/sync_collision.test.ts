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
    await prisma.notification.deleteMany({ where: { businessId: mockBusinessId } });
    await prisma.syncQueue.deleteMany({ where: { businessId: mockBusinessId } });
    await prisma.auditLog.deleteMany({ where: { businessId: mockBusinessId } });
    await prisma.syncReceipt.deleteMany({ where: { businessId: mockBusinessId } });
    await prisma.saleItem.deleteMany({ where: { sale: { businessId: mockBusinessId } } });
    await prisma.payment.deleteMany({ where: { sale: { businessId: mockBusinessId } } });
    await prisma.sale.deleteMany({ where: { businessId: mockBusinessId } });
    await prisma.inventory.deleteMany({ where: { businessId: mockBusinessId } });
    await prisma.product.deleteMany({ where: { businessId: mockBusinessId } });
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
    await prisma.notification.deleteMany({ where: { businessId: mockBusinessId } });
    await prisma.syncQueue.deleteMany({ where: { businessId: mockBusinessId } });
    await prisma.auditLog.deleteMany({ where: { businessId: mockBusinessId } });
    await prisma.syncReceipt.deleteMany({ where: { businessId: mockBusinessId } });
    await prisma.saleItem.deleteMany({ where: { sale: { businessId: mockBusinessId } } });
    await prisma.payment.deleteMany({ where: { sale: { businessId: mockBusinessId } } });
    await prisma.sale.deleteMany({ where: { businessId: mockBusinessId } });
    await prisma.inventory.deleteMany({ where: { businessId: mockBusinessId } });
    await prisma.product.deleteMany({ where: { businessId: mockBusinessId } });
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
            externalId: "client_id_001",
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

  it("reconciles an offline cash sale, payment, and stock decrement exactly once", async () => {
    const product = await prisma.product.create({
      data: {
        id: "product_offline_cash",
        businessId: mockBusinessId,
        name: "Offline test product",
        sellingPrice: 100,
        inventory: {
          create: {
            businessId: mockBusinessId,
            quantity: 10,
            reservedQuantity: 0,
          },
        },
      },
    });
    const saleId = "offline_sale_001";
    const record = {
      id: "offline_sale_event_001",
      entityName: "Sale",
      operation: "CREATE",
      externalId: saleId,
      payloadHash: "offline-sale-payload-hash",
      payload: {
        ...createSalePayload(saleId, 200),
        id: saleId,
        cashierId: "user_alpha",
        paymentMethod: "CASH",
        paymentStatus: "PAID",
        saleStatus: "COMPLETED",
        items: [
          {
            productId: product.id,
            quantity: 2,
            unitPrice: 100,
            total: 200,
          },
        ],
      },
      createdAt: new Date().toISOString(),
    };
    const request = createRequest(
      {
        businessId: mockBusinessId,
        deviceId: "device_alpha",
        userId: "user_alpha",
        records: [record],
      },
      mockBusinessId,
    );

    const response = await POST(request);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.processedCount, 1);

    const [savedSale, savedPayment, savedInventory] = await Promise.all([
      prisma.sale.findUnique({
        where: { id: saleId },
        include: { items: true },
      }),
      prisma.payment.findFirst({
        where: { saleId },
        include: { paymentMethod: true },
      }),
      prisma.inventory.findUnique({ where: { productId: product.id } }),
    ]);
    assert.equal(savedSale?.saleStatus, "COMPLETED");
    assert.equal(savedSale?.items.length, 1);
    assert.equal(savedPayment?.amount, 200);
    assert.equal(savedPayment?.paymentMethod.name, "CASH");
    assert.equal(savedInventory?.quantity, 8);

    const replay = await POST(
      createRequest(
        {
          businessId: mockBusinessId,
          deviceId: "device_alpha",
          userId: "user_alpha",
          records: [record],
        },
        mockBusinessId,
      ),
    );
    assert.equal(replay.status, 200);
    assert.equal(await prisma.payment.count({ where: { saleId } }), 1);
    assert.equal(
      (await prisma.inventory.findUnique({ where: { productId: product.id } }))
        ?.quantity,
      8,
    );
  });

  it("acknowledges an offline fallback when the online sale already committed", async () => {
    const product = await prisma.product.create({
      data: {
        id: "product_response_lost",
        businessId: mockBusinessId,
        name: "Response-lost test product",
        sellingPrice: 100,
        inventory: {
          create: {
            businessId: mockBusinessId,
            quantity: 8,
            reservedQuantity: 0,
          },
        },
      },
    });
    const invoiceNo = "POS-response-lost";
    await prisma.sale.create({
      data: {
        id: "sale_response_lost",
        businessId: mockBusinessId,
        cashierId: "user_alpha",
        saleNumber: invoiceNo,
        subtotal: 200,
        total: 200,
        saleStatus: "COMPLETED",
        paymentStatus: "PAID",
        items: {
          create: {
            productId: product.id,
            quantity: 2,
            unitPrice: 100,
            total: 200,
          },
        },
      },
    });
    const paymentMethod = await prisma.paymentMethod.upsert({
      where: { name: "CASH" },
      update: {},
      create: { name: "CASH" },
    });
    await prisma.payment.create({
      data: {
        saleId: "sale_response_lost",
        paymentMethodId: paymentMethod.id,
        amount: 200,
      },
    });
    const record = {
      id: "offline_response_lost_event",
      entityName: "Sale",
      operation: "CREATE",
      externalId: "offline_response_lost_sale",
      payloadHash: "offline-response-lost-payload-hash",
      payload: {
        ...createSalePayload("offline_response_lost_sale", 200),
        id: "offline_response_lost_sale",
        saleNumber: invoiceNo,
        cashierId: "user_alpha",
        paymentMethod: "CASH",
        paymentStatus: "PAID",
        saleStatus: "COMPLETED",
        items: [
          {
            productId: product.id,
            quantity: 2,
            unitPrice: 100,
            total: 200,
          },
        ],
      },
      createdAt: new Date().toISOString(),
    };

    const response = await POST(
      createRequest(
        {
          businessId: mockBusinessId,
          deviceId: "device_alpha",
          userId: "user_alpha",
          records: [record],
        },
        mockBusinessId,
      ),
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.processedCount, 1);
    assert.equal(await prisma.sale.count({ where: { saleNumber: invoiceNo } }), 1);
    assert.equal(await prisma.payment.count({ where: { saleId: "sale_response_lost" } }), 1);
    assert.equal(
      (
        await prisma.inventory.findUnique({
          where: { productId: product.id },
        })
      )?.quantity,
      8,
    );
  });
});
