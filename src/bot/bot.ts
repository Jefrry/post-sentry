import { Telegraf } from 'telegraf';

import { env } from '../config/env.js';
import type { ChannelReaderService } from '../modules/channels/channelReader.service.js';
import { registerMenuHandlers } from './handlers/menu.handler.js';

export function createBot(
  channelReaderService: ChannelReaderService,
): Telegraf {
  const bot = new Telegraf(env.BOT_TOKEN);

  registerMenuHandlers(bot, channelReaderService);

  return bot;
}
