import { Telegraf } from 'telegraf';

import { env } from '../config/env.js';
import type { ChannelReaderService } from '../modules/channels/channelReader.service.js';
import type { TrackingService } from '../modules/tracking/tracking.service.js';
import { registerMenuHandlers } from './handlers/menu.handler.js';

export function createBot(
  channelReaderService: ChannelReaderService,
  trackingService: TrackingService,
): Telegraf {
  const bot = new Telegraf(env.BOT_TOKEN);

  registerMenuHandlers(bot, channelReaderService, trackingService);

  return bot;
}
