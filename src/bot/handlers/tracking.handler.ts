import { Telegraf, type Context } from 'telegraf';

import { AWAITING_INTERVAL } from '../../constants.js';
import { DomainError } from '../../modules/common/domainError.js';
import { TrackingAlreadyExistsError } from '../../modules/tracking/tracking.errors.js';
import type { TrackingDto } from '../../modules/tracking/tracking.types.js';
import { mainKeyboard } from '../keyboards/main.keyboard.js';
import {
  trackingCancelKeyboard,
  trackingIntervalKeyboard,
} from '../keyboards/tracking.keyboard.js';
import type { BotHandlerDeps } from './types.js';

export class TrackingHandler {
  constructor(
    private readonly bot: Telegraf,
    private readonly deps: BotHandlerDeps,
  ) {}

  register(): void {
    this.bot.action('tracking:add', async (ctx) => {
      await ctx.answerCbQuery();

      const telegramUser = await this.getPrivateUser(ctx);

      if (!telegramUser) {
        return;
      }

      try {
        await this.deps.userService.registerTelegramUser(telegramUser);
        this.deps.userStateManager.setAwaitingChannelLink(telegramUser.id);

        await ctx.editMessageText(
          'Отправь публичную ссылку на Telegram-канал или его @username.',
          trackingCancelKeyboard,
        );
      } catch (error) {
        await ctx.reply(
          this.getErrorMessage(
            error,
            'Не удалось начать добавление отслеживания. Попробуй ещё раз.',
          ),
        );
      }
    });

    this.bot.action('tracking:cancel', async (ctx) => {
      await ctx.answerCbQuery();

      const telegramUser = await this.getPrivateUser(ctx);

      if (!telegramUser) {
        return;
      }

      this.deps.userStateManager.clear(telegramUser.id);

      const text = 'Добавление отслеживания отменено.';

      try {
        await ctx.editMessageText(text, mainKeyboard);
      } catch {
        await ctx.reply(text, mainKeyboard);
      }
    });

    this.bot.action(/^tracking:interval:([^:]+)$/, async (ctx) => {
      await ctx.answerCbQuery();

      const telegramUser = await this.getPrivateUser(ctx);

      if (!telegramUser) {
        return;
      }

      const state = this.deps.userStateManager.get(telegramUser.id);

      if (state?.type !== AWAITING_INTERVAL) {
        await ctx.reply(
          'Данные для создания отслеживания не найдены. Начни добавление заново.',
          mainKeyboard,
        );
        return;
      }

      let intervalHours: number;

      try {
        const rawInterval = ctx.match[1] ?? '';

        if (!/^\d+$/.test(rawInterval)) {
          throw new Error('Некорректный интервал проверки.');
        }

        intervalHours = this.deps.trackingService.parseIntervalHours(
          Number(rawInterval),
        );
      } catch (error) {
        await ctx.reply(
          this.getErrorMessage(error, 'Выбери допустимый интервал.'),
          trackingIntervalKeyboard,
        );
        return;
      }

      let tracking: TrackingDto;

      try {
        const user =
          await this.deps.userService.registerTelegramUser(telegramUser);
        tracking = await this.deps.trackingService.create({
          userId: user.id,
          channelId: state.channel.channelId,
          channelUsername: state.channel.channelUsername,
          channelTitle: state.channel.title,
          intervalHours,
          lastSeenMessageId: state.channel.currentLastMessageId,
          keywords: state.keywords,
        });
      } catch (error) {
        if (error instanceof TrackingAlreadyExistsError) {
          this.deps.userStateManager.clear(telegramUser.id);
          await ctx.editMessageText(error.message, mainKeyboard);
          return;
        }

        await ctx.reply(
          this.getErrorMessage(
            error,
            'Не удалось создать отслеживание. Попробуй ещё раз.',
          ),
          trackingIntervalKeyboard,
        );
        return;
      }

      this.deps.userStateManager.clear(telegramUser.id);
      const text = this.formatCreatedTracking(tracking);

      try {
        await ctx.editMessageText(text, mainKeyboard);
      } catch {
        await ctx.reply(text, mainKeyboard);
      }
    });
  }

  private async getPrivateUser(
    ctx: Context,
  ): Promise<NonNullable<Context['from']> | undefined> {
    if (ctx.chat?.type !== 'private') {
      await ctx.reply(
        'Добавлять отслеживания можно только в личном чате с ботом.',
      );
      return undefined;
    }

    if (!ctx.from) {
      await ctx.reply('Не удалось получить данные пользователя.');
      return undefined;
    }

    return ctx.from;
  }

  private formatCreatedTracking(tracking: TrackingDto): string {
    const channel = tracking.channelUsername
      ? `@${tracking.channelUsername}`
      : (tracking.channelTitle ?? tracking.channelId);
    const keywords = tracking.keywords
      .map((keyword) => keyword.value)
      .join(', ');

    return [
      'Отслеживание создано.',
      `Канал: ${channel}`,
      `Ключевые слова: ${keywords}`,
      `Интервал: ${tracking.intervalHours} ч`,
      `Первая проверка: ${tracking.nextCheckAt.toISOString()}`,
    ].join('\n');
  }

  private getErrorMessage(error: unknown, fallbackText: string): string {
    if (error instanceof DomainError) {
      return error.message;
    }

    return fallbackText;
  }
}
