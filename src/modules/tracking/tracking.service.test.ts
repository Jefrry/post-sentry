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
  it('uses the current last message as cursor and schedules the first check', async () => {
    const now = new Date('2026-08-02T10:00:00.000Z');
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
          createdAt: now,
          updatedAt: now,
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
      now,
    });

    assert.deepEqual(createdData, {
      userId: 'user-1',
      channelId: '1001234567890',
      channelUsername: 'public_channel',
      channelTitle: 'Public Channel',
      intervalHours: 3,
      lastSeenMessageId: 87,
      lastCheckedAt: now,
      nextCheckAt: new Date('2026-08-02T13:00:00.000Z'),
      keywords: [
        { value: 'TypeScript', normalizedValue: 'typescript' },
        { value: 'PRISMA', normalizedValue: 'prisma' },
      ],
    });
    assert.equal(result.lastSeenMessageId, 87);
    assert.equal(result.lastCheckedAt?.toISOString(), now.toISOString());
    assert.equal(result.nextCheckAt.toISOString(), '2026-08-02T13:00:00.000Z');
  });
});
