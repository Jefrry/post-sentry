import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TelegramError } from 'telegraf';

import {
  NotificationService,
  type NotificationTelegramApi,
} from './notification.service.js';

describe('NotificationService', () => {
  const cases = [
    {
      name: 'returns forward when source post can be forwarded',
      forwardError: null,
      fallbackError: null,
      expectedType: 'forward',
      expectedFallbackCalls: 0,
      expectedError: null,
    },
    {
      name: 'sends plain-text fallback when forwarding is forbidden',
      forwardError: telegramError(
        400,
        "Bad Request: message can't be forwarded",
      ),
      fallbackError: null,
      expectedType: 'fallback',
      expectedFallbackCalls: 1,
      expectedError: null,
    },
    {
      name: 'propagates error when a blocked user cannot receive fallback',
      forwardError: telegramError(
        403,
        'Forbidden: bot was blocked by the user',
      ),
      fallbackError: telegramError(
        403,
        'Forbidden: bot was blocked by the user',
      ),
      expectedType: null,
      expectedFallbackCalls: 1,
      expectedError: 'Forbidden: bot was blocked by the user',
    },
    {
      name: 'does not mask a non-Telegram forwarding failure',
      forwardError: new Error('network unavailable'),
      fallbackError: null,
      expectedType: null,
      expectedFallbackCalls: 0,
      expectedError: 'network unavailable',
    },
  ] as const;

  for (const testCase of cases) {
    it(testCase.name, async () => {
      const calls: Array<{
        operation: 'forward' | 'fallback';
        chatId: number | string;
        sourceChatId?: number | string;
        messageId?: number;
        text?: string;
      }> = [];
      const telegram: NotificationTelegramApi = {
        forwardMessage: async (chatId, sourceChatId, messageId) => {
          calls.push({
            operation: 'forward',
            chatId,
            sourceChatId,
            messageId,
          });

          if (testCase.forwardError) {
            throw testCase.forwardError;
          }
        },
        sendMessage: async (chatId, text) => {
          calls.push({ operation: 'fallback', chatId, text });

          if (testCase.fallbackError) {
            throw testCase.fallbackError;
          }
        },
      };
      const service = new NotificationService(telegram);
      const action = () =>
        service.sendMatchedPost({
          telegramId: 123456789n,
          channelUsername: 'public_channel',
          channelTitle: 'Public\nChannel',
          messageId: 42,
          matchedKeywords: [
            { value: 'TypeScript', normalizedValue: 'typescript' },
            { value: 'Prisma', normalizedValue: 'prisma' },
          ],
        });

      if (testCase.expectedError) {
        await assert.rejects(
          action,
          (error) =>
            error instanceof Error &&
            error.message.includes(testCase.expectedError),
        );
      } else {
        assert.equal(await action(), testCase.expectedType);
      }

      assert.deepEqual(calls[0], {
        operation: 'forward',
        chatId: '123456789',
        sourceChatId: '@public_channel',
        messageId: 42,
      });
      const fallbackCalls = calls.filter(
        (call) => call.operation === 'fallback',
      );
      assert.equal(fallbackCalls.length, testCase.expectedFallbackCalls);

      if (fallbackCalls.length > 0) {
        assert.equal(
          fallbackCalls[0]?.text,
          [
            'Найдено совпадение в Telegram-канале.',
            'Канал: @public_channel — Public Channel',
            'Ключевые слова: TypeScript, Prisma',
            'Ссылка: https://t.me/public_channel/42',
          ].join('\n'),
        );
      }
    });
  }
});

function telegramError(code: number, description: string): TelegramError {
  return new TelegramError({
    error_code: code,
    description,
  });
}
