import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';

import {
  AWAITING_CHANNEL_LINK,
  AWAITING_INTERVAL,
  AWAITING_KEYWORDS,
} from '../../constants.js';
import { parseChannelLink } from '../../utils/channelLinkParser.js';
import { parseKeywords } from '../../utils/keywordMatcher.js';
import {
  trackingCancelKeyboard,
  trackingIntervalKeyboard,
} from '../keyboards/tracking.keyboard.js';
import type { BotHandlerDeps } from './types.js';

export class StateMessageHandler {
  constructor(
    private readonly bot: Telegraf,
    private readonly deps: BotHandlerDeps,
  ) {}

  register(): void {
    this.bot.on(message('text'), async (ctx, next) => {
      const state = this.deps.userStateManager.get(ctx.from.id);

      if (!state) {
        await next();
        return;
      }

      if (ctx.chat.type !== 'private') {
        await ctx.reply(
          'Продолжи добавление отслеживания в личном чате с ботом.',
        );
        return;
      }

      if (state.type === AWAITING_CHANNEL_LINK) {
        try {
          const parsedLink = parseChannelLink(ctx.message.text);
          const channel =
            await this.deps.channelReaderService.resolvePublicChannel(
              parsedLink.username,
            );

          this.deps.userStateManager.setAwaitingKeywords(ctx.from.id, channel);
          await ctx.reply(
            `Канал «${channel.title}» найден. Отправь ключевые слова через запятую.`,
            trackingCancelKeyboard,
          );
        } catch (error) {
          await ctx.reply(
            this.getErrorMessage(
              error,
              'Не удалось проверить канал. Отправь другую публичную ссылку.',
            ),
            trackingCancelKeyboard,
          );
        }

        return;
      }

      if (state.type === AWAITING_KEYWORDS) {
        try {
          const keywords = parseKeywords(ctx.message.text);

          this.deps.userStateManager.setAwaitingInterval(
            ctx.from.id,
            state.channel,
            keywords,
          );
          await ctx.reply(
            'Выбери интервал проверки канала:',
            trackingIntervalKeyboard,
          );
        } catch (error) {
          await ctx.reply(
            this.getErrorMessage(
              error,
              'Не удалось разобрать ключевые слова. Попробуй ещё раз.',
            ),
            trackingCancelKeyboard,
          );
        }

        return;
      }

      if (state.type === AWAITING_INTERVAL) {
        await ctx.reply(
          'Выбери интервал кнопкой ниже или нажми «Отмена».',
          trackingIntervalKeyboard,
        );
      }
    });
  }

  private getErrorMessage(error: unknown, fallbackText: string): string {
    return error instanceof Error ? error.message : fallbackText;
  }
}
