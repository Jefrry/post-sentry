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
  const channel: ChannelDto = {
    channelId: '1001234567890',
    channelUsername: 'public_channel',
    title: 'Public Channel',
    currentLastMessageId: 42,
  };
  const keywords = [{ value: 'TypeScript', normalizedValue: 'typescript' }];

  const stateCases = [
    {
      name: 'awaiting channel link keeps no DTOs',
      arrange: (manager: UserStateManager) =>
        manager.setAwaitingChannelLink(123),
      expected: {
        type: AWAITING_CHANNEL_LINK,
      },
    },
    {
      name: 'awaiting keywords keeps the normalized channel DTO',
      arrange: (manager: UserStateManager) =>
        manager.setAwaitingKeywords(123, channel),
      expected: {
        type: AWAITING_KEYWORDS,
        channel,
      },
    },
    {
      name: 'awaiting interval keeps channel DTO and parsed keywords',
      arrange: (manager: UserStateManager) =>
        manager.setAwaitingInterval(123, channel, keywords),
      expected: {
        type: AWAITING_INTERVAL,
        channel,
        keywords,
      },
    },
  ] as const;

  for (const testCase of stateCases) {
    it(testCase.name, () => {
      const manager = new UserStateManager();

      testCase.arrange(manager);

      assert.deepEqual(manager.get(123), testCase.expected);
    });
  }

  it('clears state for a Telegram user id', () => {
    const manager = new UserStateManager();

    manager.setAwaitingChannelLink(123);
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
