import { prisma } from "../lib/prisma";
import { canonicalRoleName, systemRole } from "../lib/roles";

async function main() {
  const users = await prisma.user.findMany({ where: { roleId: { not: null } }, select: { id: true, businessId: true, role: { select: { name: true } } } });
  for (const user of users) {
    if (!user.role) continue;
    const name = canonicalRoleName(user.role.name);
    const definition = systemRole(name);
    const role = await prisma.role.upsert({
      where: { businessId_name: { businessId: user.businessId, name } },
      create: { businessId: user.businessId, name, isSystem: Boolean(definition), icon: definition?.icon ?? "🔧", color: definition?.color ?? "#6B7A99" },
      update: {},
    });
    if (definition) await prisma.rolePermission.createMany({ data: definition.permissions.map(permissionKey => ({ roleId: role.id, permissionKey })), skipDuplicates: true });
    await prisma.user.update({ where: { id: user.id }, data: { roleId: role.id } });
  }
  await prisma.role.deleteMany({ where: { businessId: null, users: { none: {} } } });
  console.log(`Migrated ${users.length} user role assignments to tenant roles.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
