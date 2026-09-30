import { prisma } from "../lib/prisma";
import { SYSTEM_ROLES } from "../lib/roles";

async function main() {
  const businessId = process.env.BUSINESS_ID?.trim();
  const businesses = await prisma.business.findMany({ where: businessId ? { id: businessId } : undefined, select: { id: true } });
  for (const business of businesses) {
    for (const definition of SYSTEM_ROLES) {
      const role = await prisma.role.upsert({
        where: { businessId_name: { businessId: business.id, name: definition.name } },
        create: { businessId: business.id, name: definition.name, isSystem: true, icon: definition.icon, color: definition.color },
        update: { isSystem: true, icon: definition.icon, color: definition.color },
      });
      const count = await prisma.rolePermission.count({ where: { roleId: role.id } });
      if (count === 0) await prisma.rolePermission.createMany({ data: definition.permissions.map(permissionKey => ({ roleId: role.id, permissionKey })), skipDuplicates: true });
    }
  }
  console.log(`Seeded missing system roles for ${businesses.length} business${businesses.length === 1 ? "" : "es"}.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
