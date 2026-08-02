import { TelegramError } from 'telegraf';

import type { ParsedKeyword } from '../tracking/tracking.types.js';
import type { DeliveryType } from './delivery.repository.js';

export type NotificationTelegramApi = {
  forwardMessage(
    chatId: number | string,
    fromChatId: number | string,
    messageId: number,
  ): Promise<unknown>;
  sendMessage(chatId: number | string, text: string): Promise<unknown>;
};

export type SendMatchedPostInput = {
  telegramId: bigint;
  channelUsername: string;
  channelTitle: string | null;
  messageId: number;
  matchedKeywords: readonly ParsedKeyword[];
};

export class NotificationService {
  constructor(private readonly telegram: NotificationTelegramApi) {}

  async sendMatchedPost(input: SendMatchedPostInput): Promise<DeliveryType> {
    const targetChatId = input.telegramId.toString();
    const sourceChatId = `@${input.channelUsername}`;

    try {
      await this.telegram.forwardMessage(
        targetChatId,
        sourceChatId,
        input.messageId,
      );

      return 'forward';
    } catch (error) {
      if (!this.canUseFallback(error)) {
        throw error;
      }
    }

    await this.telegram.sendMessage(
      targetChatId,
      this.formatFallbackMessage(input),
    );

    return 'fallback';
  }

  private canUseFallback(error: unknown): boolean {
    return (
      error instanceof TelegramError &&
      (error.code === 400 || error.code === 403)
    );
  }

  private formatFallbackMessage(input: SendMatchedPostInput): string {
    const username = this.compactPlainText(input.channelUsername);
    const title = input.channelTitle
      ? ` — ${this.compactPlainText(input.channelTitle)}`
      : '';
    const keywords = input.matchedKeywords
      .map((keyword) => this.compactPlainText(keyword.value))
      .join(', ');

    return [
      'Найдено совпадение в Telegram-канале.',
      `Канал: @${username}${title}`,
      `Ключевые слова: ${keywords}`,
      `Ссылка: https://t.me/${username}/${input.messageId}`,
    ].join('\n');
  }

  private compactPlainText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }
}
