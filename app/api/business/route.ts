import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { authenticatedBusinessId, requireBusinessAccess } from "@/lib/auth";

const businessSelect = { id: true, name: true, branch: true, country: true, phone: true, email: true, kraPin: true, currency: true, timezone: true } as const;
const CURRENCIES = new Set(["KES", "UGX", "TZS", "USD", "GBP", "EUR"]);

export async function GET(request: Request) {
  try {
    const businessId = authenticatedBusinessId(request);
    if (!businessId) return NextResponse.json({ error: "Authenticated business context is required." }, { status: 401 });
    const business = await prisma.business.findUnique({ where: { id: businessId }, select: businessSelect });
    if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });
    return NextResponse.json({ business });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load business.", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { businessId?: string; name?: string; branch?: string | null; country?: string | null; phone?: string | null; email?: string | null; taxPin?: string | null; currency?: string };
    const businessId = requireBusinessAccess(request, body.businessId);
    if (!businessId) return NextResponse.json({ error: "Authenticated business context is required." }, { status: 401 });
    if (body.name !== undefined && !body.name.trim()) return NextResponse.json({ error: "Business name is required." }, { status: 400 });
    if (body.currency !== undefined && !CURRENCIES.has(body.currency)) return NextResponse.json({ error: "Unsupported currency." }, { status: 400 });
    const email = body.email === undefined ? undefined : body.email?.trim().toLowerCase() || null;
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Business email is invalid." }, { status: 400 });
    const business = await prisma.business.update({ where: { id: businessId }, data: { ...(body.name !== undefined ? { name: body.name.trim() } : {}), ...(body.branch !== undefined ? { branch: body.branch?.trim() || null } : {}), ...(body.country !== undefined ? { country: body.country?.trim() || null } : {}), ...(body.phone !== undefined ? { phone: body.phone?.trim() || null } : {}), ...(email !== undefined ? { email } : {}), ...(body.taxPin !== undefined ? { kraPin: body.taxPin?.trim().toUpperCase() || null } : {}), ...(body.currency !== undefined ? { currency: body.currency } : {}) }, select: businessSelect });
    return NextResponse.json({ business });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save business.", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
