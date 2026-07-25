import { bot } from './bot/bot.js';
import { prisma } from './db/prisma.js';
import {
  TelegramClientService,
  TelegramStartupError,
} from './modules/telegram/telegramClient.service.js';
import { logger } from './utils/logger.js';

let isShuttingDown = false;
const telegramClientService = new TelegramClientService();

async function startBot(): Promise<void> {
  await telegramClientService.connect();
  await telegramClientService.checkAuthorization();
  logger.info('Telegram MTProto client connected');

  await bot.launch();
  logger.info('Bot started');
}

async function stopBot(signal: 'SIGINT' | 'SIGTERM'): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info(`Stopping bot: ${signal}`);

  bot.stop(signal);
  await telegramClientService.disconnect();
  await prisma.$disconnect();
}

startBot().catch((error: unknown) => {
  if (error instanceof TelegramStartupError) {
    logger.error(error.message);
  } else {
    logger.error('Failed to start bot', error);
  }

  Promise.allSettled([
    telegramClientService.disconnect(),
    prisma.$disconnect(),
  ]).finally(() => {
    process.exitCode = 1;
  });
});

process.once('SIGINT', () => {
  void stopBot('SIGINT');
});

process.once('SIGTERM', () => {
  void stopBot('SIGTERM');
});
