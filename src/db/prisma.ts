import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
