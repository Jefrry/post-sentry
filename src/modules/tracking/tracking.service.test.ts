import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DomainError } from '../common/domainError.js';
import type {
  CreateTrackingData,
  TrackingRepository,
} from './tracking.repository.js';
import { TrackingService } from './tracking.service.js';

describe('TrackingService.parseIntervalHours', () => {
  const service = new TrackingService();

  const validIntervals = [1, 3, 6, 12, 24] as const;

  for (const interval of validIntervals) {
    it(`accepts ${interval}`, () => {
      assert.equal(service.parseIntervalHours(interval), interval);
    });
  }

  const invalidIntervals = [0, 2, 5, 25, 1.5] as const;

  for (const interval of invalidIntervals) {
    it(`rejects ${interval}`, () => {
      assert.throws(() => service.parseIntervalHours(interval), DomainError);
    });
  }
});

describe('TrackingService.create', () => {
  const cases = [
    {
      name: 'uses the current last message as cursor and schedules the first check',
      input: {
        userId: 'user-1',
        channelId: '1001234567890',
        channelUsername: 'public_channel',
        channelTitle: 'Public Channel',
        intervalHours: 3,
        lastSeenMessageId: 87,
        keywords: [
          { value: 'TypeScript', normalizedValue: 'typescript' },
          { value: 'PRISMA', normalizedValue: 'prisma' },
        ],
        now: new Date('2026-08-02T10:00:00.000Z'),
      },
      expectedNextCheckAt: new Date('2026-08-02T13:00:00.000Z'),
    },
  ] as const;

  for (const testCase of cases) {
    it(testCase.name, async () => {
      let createdData: CreateTrackingData | undefined;
      const repository = {
        findByUserAndChannel: async () => null,
        createWithKeywords: async (data: CreateTrackingData) => {
          createdData = data;

          return {
            id: 'tracking-1',
            userId: data.userId,
            channelId: data.channelId,
            channelUsername: data.channelUsername ?? null,
            channelTitle: data.channelTitle ?? null,
            intervalHours: data.intervalHours,
            lastSeenMessageId: data.lastSeenMessageId,
            lastCheckedAt: data.lastCheckedAt,
            nextCheckAt: data.nextCheckAt,
            isActive: true,
            failureCount: 0,
            lastError: null,
            createdAt: testCase.input.now,
            updatedAt: testCase.input.now,
            keywords: data.keywords.map((keyword, index) => ({
              id: `keyword-${index}`,
              ...keyword,
            })),
          };
        },
        isKnownPrismaUniqueError: () => false,
      } as unknown as TrackingRepository;
      const service = new TrackingService(repository);

      const result = await service.create({
        ...testCase.input,
        keywords: [...testCase.input.keywords],
      });

      assert.deepEqual(createdData, {
        userId: testCase.input.userId,
        channelId: testCase.input.channelId,
        channelUsername: testCase.input.channelUsername,
        channelTitle: testCase.input.channelTitle,
        intervalHours: testCase.input.intervalHours,
        lastSeenMessageId: testCase.input.lastSeenMessageId,
        lastCheckedAt: testCase.input.now,
        nextCheckAt: testCase.expectedNextCheckAt,
        keywords: testCase.input.keywords,
      });
      assert.equal(result.lastSeenMessageId, testCase.input.lastSeenMessageId);
      assert.equal(
        result.lastCheckedAt?.toISOString(),
        testCase.input.now.toISOString(),
      );
      assert.equal(
        result.nextCheckAt.toISOString(),
        testCase.expectedNextCheckAt.toISOString(),
      );
    });
  }
});

describe('TrackingService ownership', () => {
  const now = new Date('2026-08-02T10:00:00.000Z');
  const ownedTracking = {
    id: 'tracking-1',
    userId: 'current-user',
    channelId: '1001234567890',
    channelUsername: 'public_channel',
    channelTitle: 'Public Channel',
    intervalHours: 3,
    lastSeenMessageId: 87,
    lastCheckedAt: now,
    nextCheckAt: now,
    isActive: true,
    failureCount: 0,
    lastError: null,
    createdAt: now,
    updatedAt: now,
    keywords: [
      {
        id: 'keyword-1',
        value: 'TypeScript',
        normalizedValue: 'typescript',
      },
    ],
  };

  const readCases = [
    {
      name: 'returns a tracking owned by the user',
      repositoryResult: ownedTracking,
      expectedTrackingId: 'tracking-1',
      expectedErrorMessage: null,
    },
    {
      name: 'does not return a tracking that is not owned by the user',
      repositoryResult: null,
      expectedTrackingId: null,
      expectedErrorMessage: 'Отслеживание не найдено.',
    },
  ] as const;

  for (const testCase of readCases) {
    it(testCase.name, async () => {
      const repository = {
        findOwned: async (trackingId: string, userId: string) => {
          assert.equal(trackingId, 'tracking-1');
          assert.equal(userId, 'current-user');

          return testCase.repositoryResult;
        },
      } as unknown as TrackingRepository;
      const service = new TrackingService(repository);

      if (testCase.expectedErrorMessage) {
        await assert.rejects(
          () => service.getOwnedTracking('current-user', 'tracking-1'),
          (error: unknown) =>
            error instanceof DomainError &&
            error.message === testCase.expectedErrorMessage,
        );

        return;
      }

      const result = await service.getOwnedTracking(
        'current-user',
        'tracking-1',
      );

      assert.equal(result.id, testCase.expectedTrackingId);
    });
  }

  const deleteCases = [
    {
      name: 'reports successful ownership-safe deletion',
      repositoryCounts: [1],
      expectedResults: [true],
    },
    {
      name: 'reports repeated ownership-safe deletion without throwing',
      repositoryCounts: [1, 0],
      expectedResults: [true, false],
    },
  ] as const;

  for (const testCase of deleteCases) {
    it(testCase.name, async () => {
      const repositoryCounts = [...testCase.repositoryCounts];
      const repository = {
        deleteOwned: async (trackingId: string, userId: string) => {
          assert.equal(trackingId, 'tracking-1');
          assert.equal(userId, 'current-user');

          return { count: repositoryCounts.shift() ?? 0 };
        },
      } as unknown as TrackingRepository;
      const service = new TrackingService(repository);

      const results: boolean[] = [];

      for (const expectedResult of testCase.expectedResults) {
        void expectedResult;
        results.push(await service.deleteOwned('tracking-1', 'current-user'));
      }

      assert.deepEqual(results, testCase.expectedResults);
    });
  }
});

describe('TrackingService check scheduling', () => {
  const checkedAt = new Date('2026-08-02T12:00:00.000Z');
  const cases = [
    {
      name: 'schedules the next regular check after a successful check',
      operation: 'success',
      intervalHours: 3,
      expectedData: {
        lastSeenMessageId: 99,
        lastCheckedAt: checkedAt,
        nextCheckAt: new Date('2026-08-02T15:00:00.000Z'),
      },
    },
    {
      name: 'schedules retry and persists diagnostic after a failed check',
      operation: 'failure',
      expectedData: {
        lastCheckedAt: checkedAt,
        nextCheckAt: new Date('2026-08-02T12:15:00.000Z'),
        errorMessage: 'bot was blocked by the user',
      },
    },
  ] as const;

  for (const testCase of cases) {
    it(testCase.name, async () => {
      let persistedData: unknown;
      const repository = {
        markSuccessfulCheck: async (_trackingId: string, data: unknown) => {
          persistedData = data;
        },
        markFailedCheck: async (_trackingId: string, data: unknown) => {
          persistedData = data;
        },
      } as unknown as TrackingRepository;
      const service = new TrackingService(repository);

      if (testCase.operation === 'success') {
        await service.markSuccessfulCheck({
          trackingId: 'tracking-1',
          lastSeenMessageId: 99,
          intervalHours: testCase.intervalHours,
          checkedAt,
        });
      } else {
        await service.markFailedCheck({
          trackingId: 'tracking-1',
          error: new Error('bot was blocked by the user'),
          retryMs: 15 * 60 * 1000,
          checkedAt,
        });
      }

      assert.deepEqual(persistedData, testCase.expectedData);
    });
  }
});
