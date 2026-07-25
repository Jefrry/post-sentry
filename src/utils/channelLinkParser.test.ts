import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DomainError } from '../modules/common/domainError.js';
import { parseChannelLink } from './channelLinkParser.js';

describe('parseChannelLink', () => {
  const validCases = [
    ['@Some_Channel1', 'Some_Channel1'],
    ['https://t.me/somechannel', 'somechannel'],
    ['http://telegram.me/Some_Channel1', 'Some_Channel1'],
    ['t.me/somechannel', 'somechannel'],
  ] as const;

  for (const [input, username] of validCases) {
    it(`parses ${input}`, () => {
      assert.deepEqual(parseChannelLink(input), { username });
    });
  }

  const invalidCases = [
    '',
    'https://example.com/channel',
    'https://t.me/+abcdef',
    'https://t.me/joinchat/abcdef',
    'https://t.me/c/123/456',
    'https://t.me/somechannel/123',
    'https://t.me/somechannel?single',
    'https://t.me/somechannel#hash',
    '@bad',
  ] as const;

  for (const input of invalidCases) {
    it(`rejects ${input || 'empty string'}`, () => {
      assert.throws(() => parseChannelLink(input), DomainError);
    });
  }
});
