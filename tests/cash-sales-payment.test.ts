import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.ts';
import { GET, POST } from '../app/api/sales/route.ts';

function makeJwtForBusiness(businessId: string, userId: string) {
  const secret = process.env.JWT_SECRET || 'mobiduka-dev-secret-change-me';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ businessId, sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

test('cash sales create a cash payment record', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const invoiceNo = `INV-CASH-${suffix}`;
  const businessName = `Test Cash Business ${suffix}`;
  const roleName = `CASHIER`;
  const email = `cashier-${suffix}@example.com`;
  const username = `cashier-${suffix}`;
  const operatorEmail = `operator-${suffix}@example.com`;
  const operatorUsername = `operator-${suffix}`;
  const productSku = `TEST-PRODUCT-${suffix}`;

  let businessId = '';

  try {
    const business = await prisma.business.create({
      data: {
        name: businessName,
        currency: 'KES',
        timezone: 'Africa/Nairobi',
        status: 'ACTIVE',
      },
    });
    businessId = business.id;

    const role = await prisma.role.upsert({
      where: { businessId_name: { businessId: business.id, name: roleName } },
      update: {},
      create: { businessId: business.id, name: roleName, description: 'cashier' },
    });

    const user = await prisma.user.create({
      data: {
        businessId: business.id,
        roleId: role.id,
        fullName: 'Cashier One',
        username,
        email,
        status: 'ACTIVE',
      },
    });
    const operator = await prisma.user.create({
      data: {
        businessId: business.id,
        roleId: role.id,
        fullName: 'Cashier Two',
        username: operatorUsername,
        email: operatorEmail,
        status: 'ACTIVE',
      },
    });
    const product = await prisma.product.create({
      data: {
        businessId: business.id,
        name: `Test Product ${suffix}`,
        sku: productSku,
        sellingPrice: 100,
        costPrice: 50,
        status: 'ACTIVE',
      },
    });
    await prisma.inventory.create({
      data: {
        businessId: business.id,
        productId: product.id,
        quantity: 10,
        reservedQuantity: 0,
      },
    });

    const token = makeJwtForBusiness(business.id, user.id);

    const response = await POST(
      new Request('http://localhost/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          businessId: business.id,
          cashierId: operator.id,
          invoiceNo,
          totalAmount: 90,
          subtotal: 100,
          discountAmount: 10,
          paymentMode: 'CASH',
          items: [{ productId: product.id, quantity: 1, unitPrice: 100, total: 100 }],
        }),
      }),
    );

    assert.equal(response.status, 201, 'sale should be created');

    const payments = await prisma.payment.findMany({
      where: { sale: { businessId: business.id } },
      include: { paymentMethod: true },
    });

    assert.equal(payments.length, 1, 'cash sale should persist a payment record');
    assert.equal(payments[0].paymentMethod.name, 'CASH', 'cash payment method should be stored');
    assert.equal(payments[0].amount, 90, 'payment amount should use the discounted total');

    const historyResponse = await GET(
      new Request(`http://localhost/api/sales?businessId=${business.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    assert.equal(historyResponse.status, 200, 'receipt history should load');
    const history = await historyResponse.json();
    const receipt = history.receipts.find(
      (item: { saleNumber: string }) => item.saleNumber === invoiceNo,
    );
    assert.ok(receipt, 'completed sale should appear in receipt history');
    assert.equal(receipt.subtotal, 100, 'history should retain the pre-discount subtotal');
    assert.equal(receipt.discountAmount, 10, 'history should retain the discount');
    assert.equal(receipt.total, 90, 'history should show the paid total');
    assert.equal(receipt.cashier, 'Cashier Two');
    assert.equal(receipt.paymentMethod, 'CASH');
    assert.equal(receipt.items[0].quantity, 1);
  } finally {
    if (businessId) {
      await prisma.payment.deleteMany({ where: { sale: { businessId: businessId } } });
      await prisma.saleItem.deleteMany({ where: { sale: { businessId: businessId } } });
      await prisma.auditLog.deleteMany({ where: { businessId: businessId } });
      await prisma.notification.deleteMany({ where: { businessId: businessId } });
      await prisma.syncQueue.deleteMany({ where: { businessId: businessId } });
      await prisma.sale.deleteMany({ where: { businessId: businessId } });
      await prisma.inventory.deleteMany({ where: { businessId: businessId } });
      await prisma.product.deleteMany({ where: { businessId: businessId } });
      await prisma.user.deleteMany({ where: { businessId: businessId } });
      await prisma.business.delete({ where: { id: businessId } });
    }
  }
});
