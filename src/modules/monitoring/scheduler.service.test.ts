import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { DueTrackingDto } from '../tracking/tracking.types.js';
import {
  SchedulerService,
  type SchedulerLogger,
  type SchedulerTrackingService,
} from './scheduler.service.js';

const tickAt = new Date('2026-08-02T12:00:00.000Z');

describe('SchedulerService tracking isolation', () => {
  const cases = [
    {
      name: 'failure of one tracking does not block the next tracking',
      failingTrackingIds: ['tracking-1'],
      expectedCheckedIds: ['tracking-1', 'tracking-2'],
      expectedErrorLogs: 1,
    },
    {
      name: 'processes all due trackings when none fails',
      failingTrackingIds: [],
      expectedCheckedIds: ['tracking-1', 'tracking-2'],
      expectedErrorLogs: 0,
    },
  ] as const;

  for (const testCase of cases) {
    it(testCase.name, async () => {
      const trackings = [
        createTracking('tracking-1'),
        createTracking('tracking-2'),
      ];
      const checkedIds: string[] = [];
      const errorLogs: string[] = [];
      const failingTrackingIds = new Set<string>(testCase.failingTrackingIds);
      const scheduler = new SchedulerService(
        createTrackingService(trackings),
        {
          checkTracking: async (tracking, checkedAt) => {
            assert.equal(checkedAt, tickAt);
            checkedIds.push(tracking.id);

            if (failingTrackingIds.has(tracking.id)) {
              throw new Error('sensitive diagnostic details');
            }
          },
        },
        60_000,
        createLogger(errorLogs),
      );

      assert.equal(await scheduler.tick(tickAt), true);

      assert.deepEqual(checkedIds, testCase.expectedCheckedIds);
      assert.equal(errorLogs.length, testCase.expectedErrorLogs);
      assert.equal(
        errorLogs.some((message) =>
          message.includes('sensitive diagnostic details'),
        ),
        false,
      );
    });
  }
});

describe('SchedulerService lifecycle', () => {
  it('does not run overlapping ticks', async () => {
    let releaseCheck: (() => void) | undefined;
    let reportStarted: (() => void) | undefined;
    const checkStarted = new Promise<void>((resolve) => {
      reportStarted = resolve;
    });
    const checkCanFinish = new Promise<void>((resolve) => {
      releaseCheck = resolve;
    });
    const scheduler = new SchedulerService(
      createTrackingService([createTracking('tracking-1')]),
      {
        checkTracking: async () => {
          reportStarted?.();
          await checkCanFinish;
        },
      },
      60_000,
      createLogger([]),
    );

    const firstTick = scheduler.tick(tickAt);
    await checkStarted;

    assert.equal(await scheduler.tick(tickAt), false);

    releaseCheck?.();
    assert.equal(await firstTick, true);
  });

  it('starts and stops idempotently with one shared interval', async () => {
    let dueQueries = 0;
    const scheduler = new SchedulerService(
      {
        findDueTrackings: async () => {
          dueQueries += 1;
          return [];
        },
      },
      { checkTracking: async () => undefined },
      60_000,
      createLogger([]),
    );

    scheduler.start();
    scheduler.start();
    await scheduler.stop();
    await scheduler.stop();

    assert.equal(dueQueries, 1);
  });
});

function createTrackingService(
  trackings: DueTrackingDto[],
): SchedulerTrackingService {
  return {
    findDueTrackings: async (now) => {
      assert.equal(now, tickAt);
      return trackings;
    },
  };
}

function createLogger(errorLogs: string[]): SchedulerLogger {
  return {
    info: () => undefined,
    error: (message) => {
      errorLogs.push(message);
    },
  };
}

function createTracking(id: string): DueTrackingDto {
  return {
    id,
    userId: `user-${id}`,
    channelId: `channel-${id}`,
    channelUsername: `channel_${id.replace('-', '_')}`,
    channelTitle: `Channel ${id}`,
    intervalHours: 1,
    lastSeenMessageId: 10,
    lastCheckedAt: tickAt,
    nextCheckAt: tickAt,
    isActive: true,
    failureCount: 0,
    lastError: null,
    createdAt: tickAt,
    updatedAt: tickAt,
    keywords: [
      {
        id: `keyword-${id}`,
        value: 'TypeScript',
        normalizedValue: 'typescript',
      },
    ],
    user: {
      id: `user-${id}`,
      telegramId: 123456789n,
    },
  };
}
