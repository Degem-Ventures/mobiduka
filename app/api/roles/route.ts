import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { authenticatedUserId, requireBusinessAccess } from "@/lib/auth";
import { PERMISSION_KEYS } from "@/lib/roles";

async function authorizedBusinessId(request: Request, requestedBusinessId: unknown) {
  const businessId = requireBusinessAccess(request, requestedBusinessId);
  const userId = authenticatedUserId(request);
  if (!businessId || !userId) return null;
  const user = await prisma.user.findFirst({ where: { id: userId, businessId }, select: { role: { select: { permissions: { where: { permissionKey: "roles" }, select: { permissionKey: true } } } } } });
  return user?.role?.permissions.length ? businessId : null;
}

const roleSelect = {
  id: true, name: true, description: true, isSystem: true, icon: true, color: true,
  permissions: { select: { permissionKey: true }, orderBy: { permissionKey: "asc" as const } },
  _count: { select: { users: true } },
} as const;

export async function GET(request: Request) {
  try {
    const businessId = await authorizedBusinessId(request, new URL(request.url).searchParams.get("businessId"));
    if (!businessId) return NextResponse.json({ error: "Roles permission is required." }, { status: 403 });
    const roles = await prisma.role.findMany({ where: { businessId }, select: roleSelect, orderBy: [{ isSystem: "desc" }, { name: "asc" }] });
    return NextResponse.json({ roles: roles.map(role => ({ ...role, permissions: role.permissions.map(permission => permission.permissionKey), userCount: role._count.users })) });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to load roles:", details);
    return NextResponse.json({ error: process.env.NODE_ENV === "development" ? `Failed to load roles: ${details}` : "Failed to load roles.", details }, { status: 500 });
  }
}

function validatedPermissions(value: unknown) {
  if (!Array.isArray(value) || value.some(permission => typeof permission !== "string" || !PERMISSION_KEYS.has(permission))) return null;
  return [...new Set(value)];
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { businessId?: string; name?: string; permissions?: unknown };
    const businessId = await authorizedBusinessId(request, body.businessId);
    const name = body.name?.trim(); const permissions = validatedPermissions(body.permissions ?? []);
    if (!businessId) return NextResponse.json({ error: "Roles permission is required." }, { status: 403 });
    if (!name || name.length > 40 || !permissions) return NextResponse.json({ error: "A role name and valid permissions are required." }, { status: 400 });
    const role = await prisma.role.create({ data: { businessId, name, permissions: { createMany: { data: permissions.map(permissionKey => ({ permissionKey })) } } }, select: roleSelect });
    return NextResponse.json({ role: { ...role, permissions: role.permissions.map(permission => permission.permissionKey), userCount: 0 } }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: "Failed to create role.", details: error instanceof Error ? error.message : "Unknown error" }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { businessId?: string; roleId?: string; name?: string; permissions?: unknown };
    const businessId = await authorizedBusinessId(request, body.businessId);
    if (!businessId) return NextResponse.json({ error: "Roles permission is required." }, { status: 403 });
    const role = body.roleId ? await prisma.role.findFirst({ where: { id: body.roleId, businessId }, select: { id: true, isSystem: true } }) : null;
    if (!role) return NextResponse.json({ error: "Role not found." }, { status: 404 });
    const permissions = body.permissions === undefined ? undefined : validatedPermissions(body.permissions);
    if (permissions === null) return NextResponse.json({ error: "One or more permissions are invalid." }, { status: 400 });
    const name = body.name?.trim();
    if (body.name !== undefined && (!name || name.length > 40 || role.isSystem)) return NextResponse.json({ error: role.isSystem ? "System role names cannot be changed." : "Role name is invalid." }, { status: 400 });
    const updated = await prisma.$transaction(async tx => {
      if (permissions !== undefined) { await tx.rolePermission.deleteMany({ where: { roleId: role.id } }); if (permissions.length) await tx.rolePermission.createMany({ data: permissions.map(permissionKey => ({ roleId: role.id, permissionKey })) }); }
      return tx.role.update({ where: { id: role.id }, data: name ? { name } : {}, select: roleSelect });
    });
    return NextResponse.json({ role: { ...updated, permissions: updated.permissions.map(permission => permission.permissionKey), userCount: updated._count.users } });
  } catch (error) { return NextResponse.json({ error: "Failed to update role.", details: error instanceof Error ? error.message : "Unknown error" }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json() as { businessId?: string; roleId?: string };
    const businessId = await authorizedBusinessId(request, body.businessId);
    if (!businessId) return NextResponse.json({ error: "Roles permission is required." }, { status: 403 });
    const role = body.roleId ? await prisma.role.findFirst({ where: { id: body.roleId, businessId }, select: { id: true, isSystem: true, _count: { select: { users: true } } } }) : null;
    if (!role) return NextResponse.json({ error: "Role not found." }, { status: 404 });
    if (role.isSystem) return NextResponse.json({ error: "System roles cannot be deleted." }, { status: 400 });
    if (role._count.users) return NextResponse.json({ error: "Move assigned users to another role before deleting this role." }, { status: 400 });
    await prisma.role.delete({ where: { id: role.id } });
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: "Failed to delete role.", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 }); }
}
