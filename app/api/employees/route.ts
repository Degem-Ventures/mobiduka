import { NextResponse } from "next/server.js";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/auth";
import { createSystemNotification } from "@/lib/notifications";

const ALLOWED_ROLES = ["ADMIN", "OWNER", "SUPERVISOR", "CASHIER", "STOCK_KEEPER", "ACCOUNTANT"] as const;
const JWT_SECRET = process.env.JWT_SECRET || "mobiduka-dev-secret-change-me";

type AllowedRole = (typeof ALLOWED_ROLES)[number];

function normalizeRole(value: unknown): AllowedRole | null {
  const rawRole = String(value ?? "").trim().toUpperCase();
  const role = rawRole === "MANAGER" ? "SUPERVISOR" : rawRole;
  return (ALLOWED_ROLES as readonly string[]).includes(role) ? (role as AllowedRole) : null;
}

function authenticatedBusinessId(request: Request): string | null {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) return null;
  const expectedSignature = crypto.createHmac("sha256", JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
  const actual = Buffer.from(encodedSignature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as { businessId?: unknown; exp?: unknown };
    if (typeof payload.businessId !== "string" || (typeof payload.exp === "number" && payload.exp < Date.now() / 1000)) return null;
    return payload.businessId;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const businessId = requireBusinessAccess(request, new URL(request.url).searchParams.get("businessId"));
    if (!businessId) return NextResponse.json({ error: "Authenticated business context is required." }, { status: 401 });
    const includePinHashes = new URL(request.url).searchParams.get("includePinHashes") === "true";
    if (includePinHashes && authenticatedBusinessId(request) !== businessId) {
      return NextResponse.json({ error: "Authenticated business context is required for roster credential sync." }, { status: 403 });
    }

    const employees = await prisma.user.findMany({
      where: { businessId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        shift: true,
        salary: true,
        startDate: true,
        ...(includePinHashes ? { pinHash: true } : {}),
        createdAt: true,
        role: { select: { name: true } },
      },
      orderBy: { fullName: "asc" },
    });

    return NextResponse.json({
      success: true,
      employees: employees.map((employee) => ({
        ...employee,
        role: employee.role?.name ?? "CASHIER",
        isActive: employee.status === "ACTIVE",
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load business employee roster.", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = typeof body.id === "string" && body.id.trim() && body.id.trim().toLowerCase() !== "string"
      ? body.id.trim()
      : undefined;
    const businessId = requireBusinessAccess(request, body.businessId);
    const fullName = String(body.name ?? body.fullName ?? "").trim();
    const role = normalizeRole(body.role);
    const email = typeof body.email === "string" && body.email.trim() ? body.email.trim().toLowerCase() : null;
    const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
    const pin = typeof body.pin === "string" && body.pin.length > 0 ? body.pin : undefined;
    const status = body.isActive === false ? "INACTIVE" : "ACTIVE";
    const shift = String(body.shift ?? "Morning").trim() || "Morning";
    const salary = Number(body.salary ?? 0);
    const startDate = body.startDate ? new Date(String(body.startDate)) : null;

    if (!businessId || !fullName || !role) {
      return NextResponse.json({ error: "Authenticated business context, name, and a valid role are required." }, { status: 401 });
    }
    if (pin !== undefined && !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: "PIN must contain exactly 4 digits." }, { status: 400 });
    }
    if (!Number.isFinite(salary) || salary < 0 || (startDate && Number.isNaN(startDate.getTime()))) {
      return NextResponse.json({ error: "Salary must be non-negative and startDate must be valid." }, { status: 400 });
    }

    const employee = await prisma.$transaction(async (tx) => {
      const business = await tx.business.findUnique({ where: { id: businessId }, select: { id: true } });
      if (!business) throw new Error("Target business was not found.");

      const existingRole = await tx.role.upsert({
        where: { name: role },
        update: {},
        create: { name: role },
      });
      if (pin) {
        const candidates = await tx.user.findMany({
          where: {
            businessId,
            pinHash: { not: null },
            ...(id ? { id: { not: id } } : {}),
          },
          select: { pinHash: true },
        });
        for (const candidate of candidates) {
          if (candidate.pinHash && await bcrypt.compare(pin, candidate.pinHash)) {
            throw new Error("That PIN is already assigned to another employee in this business.");
          }
        }
      }
      const pinHash = pin ? await bcrypt.hash(pin, 10) : undefined;
      const data = {
        businessId,
        fullName,
        email,
        phone,
        roleId: existingRole.id,
        status,
        shift,
        salary,
        ...(startDate ? { startDate } : {}),
        ...(pinHash ? { pinHash } : {}),
      };

      if (id) {
        const existing = await tx.user.findUnique({ where: { id }, select: { businessId: true } });
        if (existing && existing.businessId !== businessId) throw new Error("Employee does not belong to this business.");
        return tx.user.upsert({ where: { id }, update: data, create: { id, ...data } });
      }

      return tx.user.create({ data });
    });

    if (!id) {
      await createSystemNotification({
        businessId,
        type: "success",
        title: "Employee Added",
        body: `${employee.fullName} has been added to the team as ${role}.`,
        eventKey: `employee-created:${employee.id}`,
      });
    }

    return NextResponse.json({ success: true, employeeId: employee.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Staff profile orchestration failed.", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 },
    );
  }
}
