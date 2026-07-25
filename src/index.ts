import { bot } from './bot/bot.js';
import { prisma } from './db/prisma.js';
import { logger } from './utils/logger.js';

let isShuttingDown = false;

async function startBot(): Promise<void> {
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
  await prisma.$disconnect();
}

startBot().catch((error: unknown) => {
  logger.error('Failed to start bot', error);
  process.exitCode = 1;
});

process.once('SIGINT', () => {
  void stopBot('SIGINT');
});

process.once('SIGTERM', () => {
  void stopBot('SIGTERM');
});
