import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TelegramError } from 'telegraf';

import { isMessageNotModifiedError } from './telegramError.js';

describe('isMessageNotModifiedError', () => {
  const cases = [
    {
      name: 'recognizes an unchanged message response',
      error: new TelegramError({
        error_code: 400,
        description:
          'Bad Request: message is not modified: specified new message content and reply markup are exactly the same',
      }),
      expected: true,
    },
    {
      name: 'does not hide another Telegram 400 error',
      error: new TelegramError({
        error_code: 400,
        description: 'Bad Request: message to edit not found',
      }),
      expected: false,
    },
    {
      name: 'does not hide non-Telegram errors',
      error: new Error('network error'),
      expected: false,
    },
  ] as const;

  for (const testCase of cases) {
    it(testCase.name, () => {
      assert.equal(
        isMessageNotModifiedError(testCase.error),
        testCase.expected,
      );
    });
  }
});
