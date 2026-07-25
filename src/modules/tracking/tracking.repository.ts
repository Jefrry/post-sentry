import { Prisma } from '@prisma/client';

import { prisma } from '../../db/prisma.js';
import type { ParsedKeyword } from './tracking.types.js';

export type CreateTrackingData = {
  userId: string;
  channelId: string;
  channelUsername?: string | null;
  channelTitle?: string | null;
  intervalHours: number;
  lastSeenMessageId: number;
  nextCheckAt: Date;
  keywords: ParsedKeyword[];
};

export class TrackingRepository {
  findByUserAndChannel(userId: string, channelId: string) {
    return prisma.tracking.findUnique({
      where: {
        userId_channelId: {
          userId,
          channelId,
        },
      },
    });
  }

  createWithKeywords(data: CreateTrackingData) {
    return prisma.$transaction((tx) =>
      tx.tracking.create({
        data: {
          userId: data.userId,
          channelId: data.channelId,
          channelUsername: data.channelUsername ?? null,
          channelTitle: data.channelTitle ?? null,
          intervalHours: data.intervalHours,
          lastSeenMessageId: data.lastSeenMessageId,
          nextCheckAt: data.nextCheckAt,
          keywords: {
            create: data.keywords,
          },
        },
        include: {
          keywords: true,
        },
      }),
    );
  }

  listByUser(userId: string) {
    return prisma.tracking.findMany({
      where: {
        userId,
      },
      include: {
        keywords: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findOwned(id: string, userId: string) {
    return prisma.tracking.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        keywords: true,
      },
    });
  }

  deleteOwned(id: string, userId: string) {
    return prisma.tracking.deleteMany({
      where: {
        id,
        userId,
      },
    });
  }

  findDue(now: Date) {
    return prisma.tracking.findMany({
      where: {
        isActive: true,
        nextCheckAt: {
          lte: now,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
          },
        },
        keywords: true,
      },
      orderBy: {
        nextCheckAt: 'asc',
      },
    });
  }

  markSuccessfulCheck(
    id: string,
    data: {
      lastSeenMessageId: number;
      lastCheckedAt: Date;
      nextCheckAt: Date;
    },
  ) {
    return prisma.tracking.update({
      where: {
        id,
      },
      data: {
        lastSeenMessageId: data.lastSeenMessageId,
        lastCheckedAt: data.lastCheckedAt,
        nextCheckAt: data.nextCheckAt,
        failureCount: 0,
        lastError: null,
      },
    });
  }

  markFailedCheck(
    id: string,
    data: {
      lastCheckedAt: Date;
      nextCheckAt: Date;
      errorMessage: string;
    },
  ) {
    return prisma.tracking.update({
      where: {
        id,
      },
      data: {
        lastCheckedAt: data.lastCheckedAt,
        nextCheckAt: data.nextCheckAt,
        failureCount: {
          increment: 1,
        },
        lastError: data.errorMessage,
      },
    });
  }

  isKnownPrismaUniqueError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
