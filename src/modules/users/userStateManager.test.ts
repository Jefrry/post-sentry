import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AWAITING_CHANNEL_LINK,
  AWAITING_INTERVAL,
  AWAITING_KEYWORDS,
} from '../../constants.js';
import type { ChannelDto } from '../channels/channel.types.js';
import { UserStateManager } from './userStateManager.js';

describe('UserStateManager', () => {
  it('keeps only the DTOs required by each tracking creation step', () => {
    const manager = new UserStateManager();
    const channel: ChannelDto = {
      channelId: '1001234567890',
      channelUsername: 'public_channel',
      title: 'Public Channel',
      currentLastMessageId: 42,
    };
    const keywords = [{ value: 'TypeScript', normalizedValue: 'typescript' }];

    manager.setAwaitingChannelLink(123);
    assert.deepEqual(manager.get(123), {
      type: AWAITING_CHANNEL_LINK,
    });

    manager.setAwaitingKeywords(123, channel);
    assert.deepEqual(manager.get(123), {
      type: AWAITING_KEYWORDS,
      channel,
    });

    manager.setAwaitingInterval(123, channel, keywords);
    assert.deepEqual(manager.get(123), {
      type: AWAITING_INTERVAL,
      channel,
      keywords,
    });

    manager.clear(123);
    assert.equal(manager.get(123), undefined);
  });

  it('isolates states by Telegram user id', () => {
    const manager = new UserStateManager();

    manager.setAwaitingChannelLink(1);
    manager.setAwaitingChannelLink(2);
    manager.clear(1);

    assert.equal(manager.get(1), undefined);
    assert.deepEqual(manager.get(2), { type: AWAITING_CHANNEL_LINK });
  });
});
