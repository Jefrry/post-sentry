import { prisma } from '../../db/prisma.js';

export type UpsertUserData = {
  telegramId: bigint;
  isBot: boolean;
  firstName?: string | null;
  username?: string | null;
  languageCode?: string | null;
  isPremium: boolean;
};

export class UserRepository {
  findByTelegramId(telegramId: bigint) {
    return prisma.user.findUnique({
      where: {
        telegramId,
      },
    });
  }

  upsertByTelegramId(data: UpsertUserData) {
    return prisma.user.upsert({
      where: {
        telegramId: data.telegramId,
      },
      create: data,
      update: {
        isBot: data.isBot,
        firstName: data.firstName,
        username: data.username,
        languageCode: data.languageCode,
        isPremium: data.isPremium,
      },
    });
  }
}
