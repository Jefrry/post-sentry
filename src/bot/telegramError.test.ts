import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TelegramError } from 'telegraf';

import { isMessageNotModifiedError } from './telegramError.js';

describe('isMessageNotModifiedError', () => {
  it('recognizes an unchanged message response', () => {
    const error = new TelegramError({
      error_code: 400,
      description:
        'Bad Request: message is not modified: specified new message content and reply markup are exactly the same',
    });

    assert.equal(isMessageNotModifiedError(error), true);
  });

  it('does not hide other Telegram errors', () => {
    const error = new TelegramError({
      error_code: 400,
      description: 'Bad Request: message to edit not found',
    });

    assert.equal(isMessageNotModifiedError(error), false);
    assert.equal(isMessageNotModifiedError(new Error('network error')), false);
  });
});
