import { Telegraf } from 'telegraf';

import { mainKeyboard } from '../keyboards/main.keyboard.js';
import { StateMessageHandler } from './stateMessage.handler.js';
import { TrackingHandler } from './tracking.handler.js';
import { TrackingListHandler } from './trackingList.handler.js';
import type { BotHandlerDeps } from './types.js';

class MenuHandlerRegistry {
  constructor(
    private readonly bot: Telegraf,
    private readonly deps: BotHandlerDeps,
  ) {}

  register(): void {
    this.bot.start(async (ctx) => {
      if (ctx.chat.type !== 'private') {
        await ctx.reply('Используй этого бота в личном чате.');
        return;
      }

      if (!ctx.from) {
        await ctx.reply('Не удалось получить данные пользователя.');
        return;
      }

      await this.deps.userService.registerTelegramUser(ctx.from);
      this.deps.userStateManager.clear(ctx.from.id);
      await ctx.reply(
        'Привет! Я помогу следить за публичными Telegram-каналами.',
        mainKeyboard,
      );
    });

    new TrackingHandler(this.bot, this.deps).register();
    new TrackingListHandler(this.bot, this.deps).register();
    new StateMessageHandler(this.bot, this.deps).register();

    this.bot.on('callback_query', async (ctx) => {
      await ctx.answerCbQuery('Эта кнопка устарела.');

      if (ctx.chat?.type === 'private') {
        await ctx.reply(
          'Открой актуальное меню командой /start.',
          mainKeyboard,
        );
      }
    });
  }
}

export function registerMenuHandlers(
  bot: Telegraf,
  deps: BotHandlerDeps,
): void {
  new MenuHandlerRegistry(bot, deps).register();
}
