import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.ts';
import { DELETE as deleteProduct } from '../app/api/products/route.ts';
import { DELETE as deleteCategory } from '../app/api/categories/route.ts';

function makeJwtForBusiness(businessId: string, userId: string) {
  const secret = process.env.JWT_SECRET || 'mobiduka-dev-secret-change-me';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ businessId, sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

test('permanent inventory deletion requires prior soft-delete and preserves history', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  let businessId = '';
  let categoryId = '';
  let productId = '';
  let userId = '';

  try {
    const business = await prisma.business.create({
      data: { name: `Hard Delete Test ${suffix}`, currency: 'KES', status: 'ACTIVE' },
    });
    businessId = business.id;

    const role = await prisma.role.create({
      data: { businessId, name: `TEST-${suffix}`, description: 'inventory deletion test' },
    });
    const user = await prisma.user.create({
      data: {
        businessId,
        roleId: role.id,
        fullName: 'Inventory Test User',
        username: `inventory-${suffix}`,
        email: `inventory-${suffix}@example.com`,
      },
    });
    userId = user.id;
    const token = makeJwtForBusiness(businessId, userId);
    const category = await prisma.category.create({
      data: { businessId, name: `Deleted Category ${suffix}` },
    });
    categoryId = category.id;
    const product = await prisma.product.create({
      data: { businessId, categoryId, name: `Deleted Product ${suffix}`, status: 'ACTIVE' },
    });
    productId = product.id;
    await prisma.inventory.create({
      data: { businessId, productId, quantity: 4, reservedQuantity: 0 },
    });
    await prisma.stockMovement.create({
      data: { productId, userId, movementType: 'ADJUSTMENT', quantity: -1 },
    });

    const productUrl = (hard: boolean) =>
      `http://localhost/api/products?id=${productId}&businessId=${businessId}${hard ? '&hard=true' : ''}`;
    const categoryUrl = (hard: boolean) =>
      `http://localhost/api/categories?id=${categoryId}&businessId=${businessId}${hard ? '&hard=true' : ''}`;
    const request = (url: string) =>
      new Request(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });

    assert.equal((await deleteProduct(request(productUrl(false)))).status, 200);
    assert.equal((await deleteCategory(request(categoryUrl(false)))).status, 200);

    const categoryDelete = await deleteCategory(request(categoryUrl(true)));
    assert.equal(categoryDelete.status, 200, 'category linked only to archived products should be removable');
    assert.equal(await prisma.category.findUnique({ where: { id: categoryId } }), null);
    const archivedProduct = await prisma.product.findUnique({ where: { id: productId } });
    assert.equal(archivedProduct?.categoryId, null, 'archived product should be preserved without the deleted category');

    const protectedProduct = await deleteProduct(request(productUrl(true)));
    assert.equal(protectedProduct.status, 409, 'product with stock movement history should be protected');

    await prisma.stockMovement.deleteMany({ where: { productId } });
    const productDelete = await deleteProduct(request(productUrl(true)));
    assert.equal(productDelete.status, 200, 'unreferenced soft-deleted product should be removable');
    assert.equal(await prisma.product.findUnique({ where: { id: productId } }), null);

  } finally {
    if (productId) {
      await prisma.stockMovement.deleteMany({ where: { productId } });
      await prisma.inventory.deleteMany({ where: { productId } });
      await prisma.product.deleteMany({ where: { id: productId } });
    }
    if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
    if (businessId) {
      await prisma.user.deleteMany({ where: { businessId } });
      await prisma.role.deleteMany({ where: { businessId } });
      await prisma.business.deleteMany({ where: { id: businessId } });
    }
  }
});
