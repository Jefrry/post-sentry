import { Telegraf } from 'telegraf';

import type { ChannelReaderService } from '../../modules/channels/channelReader.service.js';
import { TrackingService } from '../../modules/tracking/tracking.service.js';
import { UserService } from '../../modules/users/user.service.js';
import { UserStateManager } from '../../modules/users/userStateManager.js';
import { mainKeyboard } from '../keyboards/main.keyboard.js';
import { StateMessageHandler } from './stateMessage.handler.js';
import { TrackingHandler } from './tracking.handler.js';
import { TrackingListHandler } from './trackingList.handler.js';
import type { BotHandlerDeps } from './types.js';

class MenuHandlerRegistry {
  private readonly deps: BotHandlerDeps;

  constructor(
    private readonly bot: Telegraf,
    channelReaderService: ChannelReaderService,
  ) {
    this.deps = {
      userService: new UserService(),
      trackingService: new TrackingService(),
      channelReaderService,
      userStateManager: new UserStateManager(),
    };
  }

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
  }
}

export function registerMenuHandlers(
  bot: Telegraf,
  channelReaderService: ChannelReaderService,
): void {
  new MenuHandlerRegistry(bot, channelReaderService).register();
}
