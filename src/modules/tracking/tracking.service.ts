import { DomainError } from '../common/domainError.js';
import { parseKeywords } from '../../utils/keywordMatcher.js';
import { TrackingAlreadyExistsError } from './tracking.errors.js';
import { TrackingRepository } from './tracking.repository.js';
import {
  allowedIntervalHours,
  type DueTrackingDto,
  type ParsedKeyword,
  type TrackingDto,
  type TrackingIntervalHours,
} from './tracking.types.js';

const intervalSet = new Set<number>(allowedIntervalHours);

export type CreateTrackingInput = {
  userId: string;
  channelId: string;
  channelUsername?: string | null;
  channelTitle?: string | null;
  intervalHours: number;
  lastSeenMessageId: number;
  keywords: ParsedKeyword[];
  now?: Date;
};

export class TrackingService {
  constructor(private readonly trackingRepository = new TrackingRepository()) {}

  async create(input: CreateTrackingInput): Promise<TrackingDto> {
    const intervalHours = this.parseIntervalHours(input.intervalHours);
    const keywords = parseKeywords(
      input.keywords.map((keyword) => keyword.value).join(','),
    );
    const existingTracking = await this.trackingRepository.findByUserAndChannel(
      input.userId,
      input.channelId,
    );

    if (existingTracking) {
      throw new TrackingAlreadyExistsError();
    }

    const now = input.now ?? new Date();

    try {
      const tracking = await this.trackingRepository.createWithKeywords({
        userId: input.userId,
        channelId: input.channelId,
        channelUsername: input.channelUsername ?? null,
        channelTitle: input.channelTitle ?? null,
        intervalHours,
        lastSeenMessageId: input.lastSeenMessageId,
        lastCheckedAt: now,
        nextCheckAt: new Date(now.getTime() + intervalHours * 60 * 60 * 1000),
        keywords,
      });

      return this.toTrackingDto(tracking);
    } catch (error) {
      if (this.trackingRepository.isKnownPrismaUniqueError(error)) {
        throw new TrackingAlreadyExistsError();
      }

      throw error;
    }
  }

  async createTracking(input: CreateTrackingInput): Promise<TrackingDto> {
    return this.create(input);
  }

  async listUserTrackings(userId: string): Promise<TrackingDto[]> {
    const trackings = await this.trackingRepository.listByUser(userId);

    return trackings.map((tracking) => this.toTrackingDto(tracking));
  }

  async getOwnedTracking(
    userId: string,
    trackingId: string,
  ): Promise<TrackingDto> {
    const tracking = await this.trackingRepository.findOwned(
      trackingId,
      userId,
    );

    if (!tracking) {
      throw new DomainError('Отслеживание не найдено.');
    }

    return this.toTrackingDto(tracking);
  }

  async deleteOwnedTracking(
    userId: string,
    trackingId: string,
  ): Promise<boolean> {
    return this.deleteOwned(trackingId, userId);
  }

  async deleteOwned(trackingId: string, userId: string): Promise<boolean> {
    const result = await this.trackingRepository.deleteOwned(
      trackingId,
      userId,
    );

    return result.count > 0;
  }

  async findDueTrackings(now = new Date()): Promise<DueTrackingDto[]> {
    const trackings = await this.trackingRepository.findDue(now);

    return trackings.map((tracking) => ({
      ...this.toTrackingDto(tracking),
      user: tracking.user,
    }));
  }

  markSuccessfulCheck({
    trackingId,
    lastSeenMessageId,
    intervalHours,
    checkedAt = new Date(),
  }: {
    trackingId: string;
    lastSeenMessageId: number;
    intervalHours: number;
    checkedAt?: Date;
  }) {
    const parsedIntervalHours = this.parseIntervalHours(intervalHours);

    return this.trackingRepository.markSuccessfulCheck(trackingId, {
      lastSeenMessageId,
      lastCheckedAt: checkedAt,
      nextCheckAt: new Date(
        checkedAt.getTime() + parsedIntervalHours * 60 * 60 * 1000,
      ),
    });
  }

  markFailedCheck({
    trackingId,
    error,
    retryMs,
    checkedAt = new Date(),
  }: {
    trackingId: string;
    error: unknown;
    retryMs: number;
    checkedAt?: Date;
  }) {
    if (!Number.isInteger(retryMs) || retryMs <= 0) {
      throw new DomainError('Retry interval must be a positive integer.');
    }

    return this.trackingRepository.markFailedCheck(trackingId, {
      lastCheckedAt: checkedAt,
      nextCheckAt: new Date(checkedAt.getTime() + retryMs),
      errorMessage: this.getErrorMessage(error),
    });
  }

  parseIntervalHours(intervalHours: number): TrackingIntervalHours {
    if (!intervalSet.has(intervalHours)) {
      throw new DomainError(
        'Интервал должен быть одним из: 1, 3, 6, 12, 24 часа.',
      );
    }

    return intervalHours as TrackingIntervalHours;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'Неизвестная ошибка проверки.';
  }

  private toTrackingDto<T extends TrackingWithKeywords>(
    tracking: T,
  ): TrackingDto {
    return {
      id: tracking.id,
      userId: tracking.userId,
      channelId: tracking.channelId,
      channelUsername: tracking.channelUsername,
      channelTitle: tracking.channelTitle,
      intervalHours: tracking.intervalHours,
      lastSeenMessageId: tracking.lastSeenMessageId,
      lastCheckedAt: tracking.lastCheckedAt,
      nextCheckAt: tracking.nextCheckAt,
      isActive: tracking.isActive,
      failureCount: tracking.failureCount,
      lastError: tracking.lastError,
      createdAt: tracking.createdAt,
      updatedAt: tracking.updatedAt,
      keywords: tracking.keywords.map((keyword) => ({
        id: keyword.id,
        value: keyword.value,
        normalizedValue: keyword.normalizedValue,
      })),
    };
  }
}

type TrackingWithKeywords = {
  id: string;
  userId: string;
  channelId: string;
  channelUsername: string | null;
  channelTitle: string | null;
  intervalHours: number;
  lastSeenMessageId: number;
  lastCheckedAt: Date | null;
  nextCheckAt: Date;
  isActive: boolean;
  failureCount: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  keywords: {
    id: string;
    value: string;
    normalizedValue: string;
  }[];
};
