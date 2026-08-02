import type { ChannelPostDto } from '../channels/channel.types.js';
import type { ChannelReaderService } from '../channels/channelReader.service.js';
import type { TrackingService } from '../tracking/tracking.service.js';
import type { DueTrackingDto } from '../tracking/tracking.types.js';
import { findMatchingKeywords } from '../../utils/keywordMatcher.js';
import type { CreateDeliveryData } from './delivery.repository.js';
import type { NotificationService } from './notification.service.js';

export type MonitoringReader = Pick<ChannelReaderService, 'getMessagesAfter'>;

export type MonitoringNotifier = Pick<NotificationService, 'sendMatchedPost'>;

export type MonitoringDeliveryRepository = {
  exists(trackingId: string, channelMessageId: number): Promise<boolean>;
  create(data: CreateDeliveryData): Promise<unknown>;
};

export type MonitoringTrackingService = {
  markSuccessfulCheck(
    input: Parameters<TrackingService['markSuccessfulCheck']>[0],
  ): Promise<unknown>;
  markFailedCheck(
    input: Parameters<TrackingService['markFailedCheck']>[0],
  ): Promise<unknown>;
};

export class MonitoringService {
  constructor(
    private readonly trackingService: MonitoringTrackingService,
    private readonly deliveryRepository: MonitoringDeliveryRepository,
    private readonly channelReaderService: MonitoringReader,
    private readonly notificationService: MonitoringNotifier,
    private readonly checkRetryMs: number,
  ) {
    if (!Number.isInteger(checkRetryMs) || checkRetryMs <= 0) {
      throw new Error('checkRetryMs must be a positive integer.');
    }
  }

  async checkTracking(
    tracking: DueTrackingDto,
    checkedAt = new Date(),
  ): Promise<void> {
    try {
      const channelUsername = tracking.channelUsername;

      if (!channelUsername) {
        throw new Error('У отслеживания отсутствует username канала.');
      }

      const posts = await this.channelReaderService.getMessagesAfter(
        channelUsername,
        tracking.lastSeenMessageId,
      );
      const orderedPosts = this.sortOldestFirst(posts);
      let maxSeenMessageId = tracking.lastSeenMessageId;

      for (const post of orderedPosts) {
        maxSeenMessageId = Math.max(maxSeenMessageId, post.messageId);

        const matchedKeywords = findMatchingKeywords(
          post.text,
          tracking.keywords,
        );

        if (matchedKeywords.length === 0) {
          continue;
        }

        const wasDelivered = await this.deliveryRepository.exists(
          tracking.id,
          post.messageId,
        );

        if (wasDelivered) {
          continue;
        }

        const deliveryType = await this.notificationService.sendMatchedPost({
          telegramId: tracking.user.telegramId,
          channelUsername,
          channelTitle: tracking.channelTitle,
          messageId: post.messageId,
          matchedKeywords,
        });

        await this.deliveryRepository.create({
          trackingId: tracking.id,
          channelMessageId: post.messageId,
          deliveryType,
          deliveredAt: checkedAt,
        });
      }

      await this.trackingService.markSuccessfulCheck({
        trackingId: tracking.id,
        lastSeenMessageId: maxSeenMessageId,
        intervalHours: tracking.intervalHours,
        checkedAt,
      });
    } catch (error) {
      await this.trackingService.markFailedCheck({
        trackingId: tracking.id,
        error,
        retryMs: this.checkRetryMs,
        checkedAt,
      });

      throw error;
    }
  }

  private sortOldestFirst(posts: readonly ChannelPostDto[]): ChannelPostDto[] {
    return [...posts].sort((left, right) => left.messageId - right.messageId);
  }
}
