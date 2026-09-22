/**
 * One-off: set/reset admin password on the current DATABASE_URL.
 * Usage: npx tsx scripts/set-admin-password.ts
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const EMAIL = process.env.ADMIN_EMAIL ?? "admin@dmproperties.ai";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "Admin123!";

async function main() {
  const prisma = new PrismaClient();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const company = await prisma.company.findFirst();
  const role = await prisma.role.findUnique({ where: { name: "SUPER_ADMIN" } });

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {
      passwordHash,
      name: "Super Admin",
      emailVerified: new Date(),
    },
    create: {
      email: EMAIL,
      name: "Super Admin",
      passwordHash,
      emailVerified: new Date(),
      companyId: company?.id,
    },
  });

  if (role) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
  }

  console.log(`Updated admin password for ${EMAIL}`);
  console.log(`Login with: ${EMAIL} / ${PASSWORD}`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
