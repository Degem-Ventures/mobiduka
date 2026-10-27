import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

async function main() {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  if (!email || !password || password.length < 16) {
    throw new Error("Set PLATFORM_ADMIN_EMAIL and a PLATFORM_ADMIN_PASSWORD of at least 16 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.platformAdmin.upsert({
    where: { email },
    create: { email, passwordHash, status: "ACTIVE" },
    update: { passwordHash, status: "ACTIVE", failedLoginAttempts: 0, lockedUntil: null },
  });
  console.log(`Platform administrator provisioned: ${email}`);
}

main()
  .catch(error => {
    console.error("Platform administrator provisioning failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
