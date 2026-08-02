import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ChannelPostDto } from '../channels/channel.types.js';
import type { DueTrackingDto } from '../tracking/tracking.types.js';
import type { CreateDeliveryData } from './delivery.repository.js';
import {
  MonitoringService,
  type MonitoringDeliveryRepository,
  type MonitoringNotifier,
  type MonitoringReader,
  type MonitoringTrackingService,
} from './monitoring.service.js';

const checkedAt = new Date('2026-08-02T12:00:00.000Z');
const retryMs = 15 * 60 * 1000;

describe('MonitoringService successful checks', () => {
  const cases = [
    {
      name: 'updates check time when there are no new posts',
      posts: [],
      keywords: [{ value: 'TypeScript', normalizedValue: 'typescript' }],
      deliveredMessageIds: [],
      expectedNotificationIds: [],
      expectedMatches: [],
      expectedCursor: 10,
    },
    {
      name: 'matches post text case-insensitively',
      posts: [createPost(11, 'Новый курс по tYpEsCrIpT')],
      keywords: [{ value: 'TypeScript', normalizedValue: 'typescript' }],
      deliveredMessageIds: [],
      expectedNotificationIds: [11],
      expectedMatches: [['TypeScript']],
      expectedCursor: 11,
    },
    {
      name: 'matches a media caption represented by message text',
      posts: [createPost(11, 'Подпись к фото про Prisma')],
      keywords: [{ value: 'prisma', normalizedValue: 'prisma' }],
      deliveredMessageIds: [],
      expectedNotificationIds: [11],
      expectedMatches: [['prisma']],
      expectedCursor: 11,
    },
    {
      name: 'sends one notification for several keywords in one post',
      posts: [createPost(11, 'TypeScript и Prisma в одном посте')],
      keywords: [
        { value: 'TypeScript', normalizedValue: 'typescript' },
        { value: 'Prisma', normalizedValue: 'prisma' },
      ],
      deliveredMessageIds: [],
      expectedNotificationIds: [11],
      expectedMatches: [['TypeScript', 'Prisma']],
      expectedCursor: 11,
    },
    {
      name: 'does not notify for an existing Delivery',
      posts: [createPost(11, 'TypeScript')],
      keywords: [{ value: 'TypeScript', normalizedValue: 'typescript' }],
      deliveredMessageIds: [11],
      expectedNotificationIds: [],
      expectedMatches: [],
      expectedCursor: 11,
    },
    {
      name: 'advances cursor past an empty media post without notifying',
      posts: [createPost(11, '')],
      keywords: [{ value: 'TypeScript', normalizedValue: 'typescript' }],
      deliveredMessageIds: [],
      expectedNotificationIds: [],
      expectedMatches: [],
      expectedCursor: 11,
    },
    {
      name: 'processes posts from oldest to newest and advances to maximum id',
      posts: [
        createPost(13, 'TypeScript third'),
        createPost(11, 'TypeScript first'),
        createPost(12, 'TypeScript second'),
      ],
      keywords: [{ value: 'TypeScript', normalizedValue: 'typescript' }],
      deliveredMessageIds: [],
      expectedNotificationIds: [11, 12, 13],
      expectedMatches: [['TypeScript'], ['TypeScript'], ['TypeScript']],
      expectedCursor: 13,
    },
  ] as const;

  for (const testCase of cases) {
    it(testCase.name, async () => {
      const harness = createHarness({
        posts: testCase.posts,
        deliveredMessageIds: testCase.deliveredMessageIds,
      });
      const tracking = createTracking({
        keywords: testCase.keywords.map((keyword, keywordIndex) => ({
          id: `keyword-${keywordIndex + 1}`,
          ...keyword,
        })),
      });

      await harness.service.checkTracking(tracking, checkedAt);

      assert.deepEqual(
        harness.notifications.map((notification) => notification.messageId),
        testCase.expectedNotificationIds,
      );
      assert.deepEqual(
        harness.notifications.map((notification) => notification.keywords),
        testCase.expectedMatches,
      );
      assert.deepEqual(
        harness.createdDeliveries.map((delivery) => delivery.channelMessageId),
        testCase.expectedNotificationIds,
      );
      assert.deepEqual(harness.successfulChecks, [
        {
          trackingId: tracking.id,
          lastSeenMessageId: testCase.expectedCursor,
          intervalHours: tracking.intervalHours,
          checkedAt,
        },
      ]);
      assert.deepEqual(harness.failedChecks, []);
    });
  }
});

describe('MonitoringService failed checks', () => {
  const cases = [
    {
      name: 'does not advance cursor and schedules retry when notification fails',
      error: new Error('bot was blocked by the user'),
    },
    {
      name: 'does not advance cursor and schedules retry when reading fails',
      error: new Error('reader unavailable'),
    },
  ] as const;

  for (const [index, testCase] of cases.entries()) {
    it(testCase.name, async () => {
      const failAt = index === 0 ? 'notification' : 'reader';
      const harness = createHarness({
        posts: [createPost(11, 'TypeScript')],
        error: testCase.error,
        failAt,
      });
      const tracking = createTracking();

      await assert.rejects(
        () => harness.service.checkTracking(tracking, checkedAt),
        testCase.error,
      );

      assert.deepEqual(harness.successfulChecks, []);
      assert.deepEqual(harness.failedChecks, [
        {
          trackingId: tracking.id,
          error: testCase.error,
          retryMs,
          checkedAt,
        },
      ]);
      assert.deepEqual(harness.createdDeliveries, []);
      assert.equal(tracking.lastSeenMessageId, 10);
    });
  }
});

function createHarness(input: {
  posts: readonly ChannelPostDto[];
  deliveredMessageIds?: readonly number[];
  error?: Error;
  failAt?: 'reader' | 'notification';
}): {
  service: MonitoringService;
  notifications: Array<{ messageId: number; keywords: string[] }>;
  createdDeliveries: CreateDeliveryData[];
  successfulChecks: Array<
    Parameters<MonitoringTrackingService['markSuccessfulCheck']>[0]
  >;
  failedChecks: Array<
    Parameters<MonitoringTrackingService['markFailedCheck']>[0]
  >;
} {
  const deliveredMessageIds = new Set(input.deliveredMessageIds ?? []);
  const notifications: Array<{ messageId: number; keywords: string[] }> = [];
  const createdDeliveries: CreateDeliveryData[] = [];
  const successfulChecks: Array<
    Parameters<MonitoringTrackingService['markSuccessfulCheck']>[0]
  > = [];
  const failedChecks: Array<
    Parameters<MonitoringTrackingService['markFailedCheck']>[0]
  > = [];
  const reader: MonitoringReader = {
    getMessagesAfter: async () => {
      if (input.failAt === 'reader') {
        throw input.error;
      }

      return [...input.posts];
    },
  };
  const notifier: MonitoringNotifier = {
    sendMatchedPost: async (notification) => {
      if (input.failAt === 'notification') {
        throw input.error;
      }

      notifications.push({
        messageId: notification.messageId,
        keywords: notification.matchedKeywords.map((keyword) => keyword.value),
      });

      return 'forward';
    },
  };
  const deliveryRepository: MonitoringDeliveryRepository = {
    exists: async (_trackingId, messageId) =>
      deliveredMessageIds.has(messageId),
    create: async (delivery) => {
      deliveredMessageIds.add(delivery.channelMessageId);
      createdDeliveries.push(delivery);
    },
  };
  const trackingService: MonitoringTrackingService = {
    markSuccessfulCheck: async (check) => {
      successfulChecks.push(check);
    },
    markFailedCheck: async (check) => {
      failedChecks.push(check);
    },
  };

  return {
    service: new MonitoringService(
      trackingService,
      deliveryRepository,
      reader,
      notifier,
      retryMs,
    ),
    notifications,
    createdDeliveries,
    successfulChecks,
    failedChecks,
  };
}

function createTracking(
  overrides: Partial<DueTrackingDto> = {},
): DueTrackingDto {
  const now = new Date('2026-08-02T10:00:00.000Z');

  return {
    id: 'tracking-1',
    userId: 'user-1',
    channelId: '1001234567890',
    channelUsername: 'public_channel',
    channelTitle: 'Public Channel',
    intervalHours: 3,
    lastSeenMessageId: 10,
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
    user: {
      id: 'user-1',
      telegramId: 123456789n,
    },
    ...overrides,
  };
}

function createPost(messageId: number, text: string): ChannelPostDto {
  return {
    messageId,
    date: new Date('2026-08-02T11:00:00.000Z'),
    text,
    postUrl: `https://t.me/public_channel/${messageId}`,
    isService: false,
  };
}
