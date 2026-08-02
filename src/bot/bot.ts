import { Telegraf } from 'telegraf';

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { registerMenuHandlers } from './handlers/menu.handler.js';
import type { BotHandlerDeps } from './handlers/types.js';

export function createBot(deps: BotHandlerDeps): Telegraf {
  const bot = new Telegraf(env.BOT_TOKEN);

  registerMenuHandlers(bot, deps);
  bot.catch((error) => {
    const errorName = error instanceof Error ? error.name : 'unknown';
    logger.error(`Unhandled Telegram update error: ${errorName}`);
  });

  return bot;
}
