import { PrismaClient } from "@prisma/client";
import { demoShiftHistory, demoShiftTypes } from "../data/demo-employees";

const prisma = new PrismaClient();

async function main() {
  const businessId = process.env.BUSINESS_ID;
  if (!businessId) throw new Error("BUSINESS_ID is required");

  const shiftTypes = new Map<string, { id: string }>();
  for (const shiftType of demoShiftTypes) {
    const record = await prisma.shiftType.upsert({
      where: { businessId_code: { businessId, code: shiftType.code } },
      update: shiftType,
      create: { businessId, ...shiftType },
      select: { id: true },
    });
    shiftTypes.set(shiftType.code, record);
  }

  for (const shift of demoShiftHistory) {
    const cashier = await prisma.user.findFirst({ where: { businessId, fullName: shift.employeeName }, select: { id: true } });
    if (!cashier) throw new Error(`Employee not found: ${shift.employeeName}`);
    const openedAt = new Date(shift.start);
    const closedAt = new Date(shift.end);
    const shiftType = shiftTypes.get(shift.shiftType);
    if (!shiftType) throw new Error(`Shift type not found: ${shift.shiftType}`);
    const existing = await prisma.cashSession.findFirst({ where: { businessId, cashierId: cashier.id, openedAt }, select: { id: true } });
    if (existing) {
      await prisma.cashSession.update({ where: { id: existing.id }, data: { shiftTypeId: shiftType.id } });
      continue;
    }
    await prisma.cashSession.create({
      data: {
        businessId,
        cashierId: cashier.id,
        shiftTypeId: shiftType.id,
        shiftType: shift.shiftType,
        openingBalance: 0,
        closingBalance: shift.amount,
        expectedBalance: shift.amount,
        variance: 0,
        salesCount: shift.sales,
        salesAmount: shift.amount,
        openedAt,
        closedAt,
      },
    });
  }

  console.log(JSON.stringify(await prisma.cashSession.findMany({ where: { businessId }, select: { id: true, shiftType: true, openedAt: true, closedAt: true, salesCount: true, salesAmount: true, cashier: { select: { fullName: true } } }, orderBy: { openedAt: "desc" } }), null, 2));
}

main()
  .catch((error) => { console.error("Shift seed failed:", error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
