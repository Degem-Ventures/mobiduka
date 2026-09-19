import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { demoEmployees } from "../data/demo-employees";

const prisma = new PrismaClient();
const roleMap = {
  "Store Manager": "OWNER",
  Cashier: "CASHIER",
  "Stock Keeper": "STOCK_KEEPER",
  Supervisor: "SUPERVISOR",
  Accountant: "ACCOUNTANT",
} as const;

async function main() {
  const businessId = process.env.BUSINESS_ID;
  if (!businessId) throw new Error("BUSINESS_ID is required");
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { id: true } });
  if (!business) throw new Error(`Business not found: ${businessId}`);

  for (const employee of demoEmployees) {
    const roleName = roleMap[employee.role];
    const role = await prisma.role.upsert({ where: { name: roleName }, update: {}, create: { name: roleName } });
    const existing = await prisma.user.findFirst({ where: { businessId, email: employee.email }, select: { id: true } });
    const data = {
      businessId,
      fullName: employee.name,
      email: employee.email,
      phone: employee.phone,
      roleId: role.id,
      pinHash: await bcrypt.hash(employee.pin, 10),
      status: employee.active ? "ACTIVE" : "INACTIVE",
      shift: employee.shift,
      salary: employee.salary,
      startDate: new Date(employee.startDate),
    };
    if (existing) await prisma.user.update({ where: { id: existing.id }, data });
    else await prisma.user.create({ data });
  }

  const employees = await prisma.user.findMany({
    where: { businessId },
    select: { fullName: true, email: true, status: true, shift: true, salary: true, startDate: true, role: { select: { name: true } } },
    orderBy: { fullName: "asc" },
  });
  console.log(JSON.stringify(employees, null, 2));
}

main()
  .catch((error) => { console.error("Employee seed failed:", error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });