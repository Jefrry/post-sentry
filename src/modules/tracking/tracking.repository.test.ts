import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { PrismaClient } from '@prisma/client';

import { TrackingRepository } from './tracking.repository.js';

describe('TrackingRepository ownership', () => {
  const ownerId = 'owner-user';
  const trackingId = 'tracking-1';

  const readCases = [
    {
      name: 'returns an owned tracking',
      userId: ownerId,
      expectedResult: { id: trackingId, userId: ownerId },
    },
    {
      name: 'does not return another user tracking',
      userId: 'another-user',
      expectedResult: null,
    },
  ] as const;

  for (const testCase of readCases) {
    it(testCase.name, async () => {
      const { repository, calls } = createRepositoryHarness();

      const result = await repository.findOwned(trackingId, testCase.userId);

      assert.deepEqual(calls, [
        {
          operation: 'findFirst',
          where: { id: trackingId, userId: testCase.userId },
        },
      ]);
      assert.deepEqual(result, testCase.expectedResult);
    });
  }

  const deleteCases = [
    {
      name: 'deletes an owned tracking',
      userId: ownerId,
      deleteAttempts: 1,
      expectedCounts: [1],
    },
    {
      name: 'reports repeated deletion as not found',
      userId: ownerId,
      deleteAttempts: 2,
      expectedCounts: [1, 0],
    },
    {
      name: 'does not delete another user tracking',
      userId: 'another-user',
      deleteAttempts: 1,
      expectedCounts: [0],
    },
  ] as const;

  for (const testCase of deleteCases) {
    it(testCase.name, async () => {
      const { repository, calls } = createRepositoryHarness();
      const counts: number[] = [];

      for (let index = 0; index < testCase.deleteAttempts; index += 1) {
        const result = await repository.deleteOwned(
          trackingId,
          testCase.userId,
        );
        counts.push(result.count);
      }

      assert.deepEqual(
        calls,
        Array.from({ length: testCase.deleteAttempts }, () => ({
          operation: 'deleteMany',
          where: { id: trackingId, userId: testCase.userId },
        })),
      );
      assert.deepEqual(counts, testCase.expectedCounts);
    });
  }
});

function createRepositoryHarness(): {
  repository: TrackingRepository;
  calls: Array<{
    operation: 'findFirst' | 'deleteMany';
    where: { id?: string; userId?: string };
  }>;
} {
  const ownerId = 'owner-user';
  const trackingId = 'tracking-1';
  let exists = true;
  const calls: Array<{
    operation: 'findFirst' | 'deleteMany';
    where: { id?: string; userId?: string };
  }> = [];
  const client = {
    tracking: {
      findFirst: async (args: { where: { id?: string; userId?: string } }) => {
        calls.push({ operation: 'findFirst', where: args.where });
        const owned =
          exists &&
          args.where.id === trackingId &&
          args.where.userId === ownerId;

        return owned ? { id: trackingId, userId: ownerId } : null;
      },
      deleteMany: async (args: { where: { id?: string; userId?: string } }) => {
        calls.push({ operation: 'deleteMany', where: args.where });
        const owned =
          exists &&
          args.where.id === trackingId &&
          args.where.userId === ownerId;

        if (owned) {
          exists = false;
        }

        return { count: owned ? 1 : 0 };
      },
    },
  } as unknown as PrismaClient;

  return {
    repository: new TrackingRepository(client),
    calls,
  };
}
