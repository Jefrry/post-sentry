import { Telegraf } from 'telegraf';

import { env } from '../config/env.js';
import { mainKeyboard } from './keyboards/main.keyboard.js';

export const bot = new Telegraf(env.BOT_TOKEN);

bot.start(async (ctx) => {
  await ctx.reply(
    'Привет! Я помогу следить за публичными Telegram-каналами.',
    mainKeyboard,
  );
});
