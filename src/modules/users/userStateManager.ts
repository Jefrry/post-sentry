import {
  AWAITING_CHANNEL_LINK,
  AWAITING_INTERVAL,
  AWAITING_KEYWORDS,
} from '../../constants.js';
import type { ChannelDto } from '../channels/channel.types.js';
import type { ParsedKeyword } from '../tracking/tracking.types.js';

export type UserState =
  | {
      type: typeof AWAITING_CHANNEL_LINK;
    }
  | {
      type: typeof AWAITING_KEYWORDS;
      channel: ChannelDto;
    }
  | {
      type: typeof AWAITING_INTERVAL;
      channel: ChannelDto;
      keywords: ParsedKeyword[];
    };

export class UserStateManager {
  private readonly states = new Map<number, UserState>();

  setAwaitingChannelLink(telegramId: number): void {
    this.states.set(telegramId, { type: AWAITING_CHANNEL_LINK });
  }

  setAwaitingKeywords(telegramId: number, channel: ChannelDto): void {
    this.states.set(telegramId, {
      type: AWAITING_KEYWORDS,
      channel,
    });
  }

  setAwaitingInterval(
    telegramId: number,
    channel: ChannelDto,
    keywords: ParsedKeyword[],
  ): void {
    this.states.set(telegramId, {
      type: AWAITING_INTERVAL,
      channel,
      keywords,
    });
  }

  get(telegramId: number): UserState | undefined {
    return this.states.get(telegramId);
  }

  clear(telegramId: number): void {
    this.states.delete(telegramId);
  }
}
