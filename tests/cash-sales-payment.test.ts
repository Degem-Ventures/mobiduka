import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma.ts';
import { POST } from '../app/api/sales/route.ts';

test('cash sales create a cash payment record', async () => {
  const business = await prisma.business.create({
    data: {
      name: 'Test Cash Business',
      currency: 'KES',
      timezone: 'Africa/Nairobi',
      status: 'ACTIVE',
    },
  });

  const role = await prisma.role.upsert({
    where: { name: 'CASHIER' },
    update: {},
    create: { name: 'CASHIER', description: 'cashier' },
  });

  const user = await prisma.user.create({
    data: {
      businessId: business.id,
      roleId: role.id,
      fullName: 'Cashier One',
      username: 'cashier-one',
      email: 'cashier-one@example.com',
      status: 'ACTIVE',
    },
  });

  const product = await prisma.product.create({
    data: {
      businessId: business.id,
      name: 'Test Product',
      sku: 'TEST-PRODUCT-001',
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

  const response = await POST(
    new Request('http://localhost/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: business.id,
        cashierId: user.id,
        invoiceNo: 'INV-CASH-100',
        totalAmount: 100,
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

  await prisma.payment.deleteMany({ where: { sale: { businessId: business.id } } });
  await prisma.saleItem.deleteMany({ where: { sale: { businessId: business.id } } });
  await prisma.auditLog.deleteMany({ where: { businessId: business.id } });
  await prisma.syncQueue.deleteMany({ where: { businessId: business.id } });
  await prisma.sale.deleteMany({ where: { businessId: business.id } });
  await prisma.inventory.deleteMany({ where: { businessId: business.id } });
  await prisma.product.deleteMany({ where: { businessId: business.id } });
  await prisma.user.deleteMany({ where: { businessId: business.id } });
  await prisma.paymentMethod.deleteMany({ where: { name: 'CASH' } });
  await prisma.role.deleteMany({ where: { id: role.id } });
  await prisma.business.delete({ where: { id: business.id } });
});
