import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { success, failure } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * One-time / recovery endpoint to ensure admin password exists in prod.
 * POST /api/admin/bootstrap
 * Header: x-bootstrap-secret: <AUTH_SECRET>
 */
export async function POST(request: Request) {
  const expected =
    process.env.ADMIN_BOOTSTRAP_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim();
  const provided = request.headers.get("x-bootstrap-secret")?.trim();

  if (!expected || !provided || provided !== expected) {
    return failure("UNAUTHORIZED", "Invalid bootstrap secret", 401);
  }

  const email = (
    process.env.ADMIN_EMAIL ?? "admin@dmproperties.ai"
  ).toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "Admin123!";

  try {
    // Ensure column exists (safe if already present).
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" TEXT`,
    );

    const passwordHash = await bcrypt.hash(password, 10);
    const company = await prisma.company.findFirst();
    const role = await prisma.role.findUnique({
      where: { name: "SUPER_ADMIN" },
    });

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        name: "Super Admin",
        emailVerified: new Date(),
        companyId: company?.id,
      },
      create: {
        email,
        name: "Super Admin",
        passwordHash,
        emailVerified: new Date(),
        companyId: company?.id,
      },
    });

    if (role) {
      await prisma.userRole.upsert({
        where: {
          userId_roleId: { userId: user.id, roleId: role.id },
        },
        update: {},
        create: { userId: user.id, roleId: role.id },
      });
    }

    return success({
      ok: true,
      email,
      userId: user.id,
      message: "Admin password set. You can sign in now.",
    });
  } catch (error) {
    console.error("[bootstrap]", error);
    return failure(
      "BOOTSTRAP_FAILED",
      error instanceof Error ? error.message : "Bootstrap failed",
      500,
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: false,
    error: {
      code: "METHOD_NOT_ALLOWED",
      message: "Use POST with x-bootstrap-secret header",
    },
  }, { status: 405 });
}
