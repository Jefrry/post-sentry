import { createBot } from './bot/bot.js';
import { env } from './config/env.js';
import { prisma } from './db/prisma.js';
import { ChannelReaderService } from './modules/channels/channelReader.service.js';
import { DeliveryRepository } from './modules/monitoring/delivery.repository.js';
import { MonitoringService } from './modules/monitoring/monitoring.service.js';
import { NotificationService } from './modules/monitoring/notification.service.js';
import { SchedulerService } from './modules/monitoring/scheduler.service.js';
import {
  TelegramClientService,
  TelegramStartupError,
} from './modules/telegram/telegramClient.service.js';
import { TrackingService } from './modules/tracking/tracking.service.js';
import { logger } from './utils/logger.js';

const telegramClientService = new TelegramClientService();
const channelReaderService = new ChannelReaderService(
  telegramClientService.getClient(),
);
const trackingService = new TrackingService();
const deliveryRepository = new DeliveryRepository();
const bot = createBot(channelReaderService, trackingService);
const notificationService = new NotificationService(bot.telegram);
const monitoringService = new MonitoringService(
  trackingService,
  deliveryRepository,
  channelReaderService,
  notificationService,
  env.CHECK_RETRY_MS,
);
const schedulerService = new SchedulerService(
  trackingService,
  monitoringService,
  env.SCHEDULER_POLL_MS,
  logger,
);

let botStarted = false;
let botRunPromise: Promise<void> | undefined;
let shutdownPromise: Promise<void> | undefined;

async function startBot(): Promise<void> {
  await telegramClientService.connect();
  await telegramClientService.checkAuthorization();
  logger.info('Telegram MTProto client connected');

  const botReady = new Promise<void>((resolve, reject) => {
    botRunPromise = bot.launch(() => {
      botStarted = true;
      resolve();
    });
    void botRunPromise.catch(reject);
  });

  await botReady;
  logger.info('Bot started');
  schedulerService.start();

  await botRunPromise;
}

function stopBot(reason: string): Promise<void> {
  if (!shutdownPromise) {
    shutdownPromise = performShutdown(reason);
  }

  return shutdownPromise;
}

async function performShutdown(reason: string): Promise<void> {
  logger.info(`Stopping bot: ${reason}`);

  await runShutdownStep('scheduler', () => schedulerService.stop());

  if (botStarted) {
    await runShutdownStep('bot', () => {
      bot.stop(reason);
      botStarted = false;
    });
  }

  await runShutdownStep('GramJS client', () =>
    telegramClientService.disconnect(),
  );
  await runShutdownStep('Prisma client', () => prisma.$disconnect());
}

async function runShutdownStep(
  component: string,
  action: () => void | Promise<void>,
): Promise<void> {
  try {
    await action();
  } catch {
    logger.error(`Failed to stop ${component}`);
  }
}

startBot().catch(async (error: unknown) => {
  if (error instanceof TelegramStartupError) {
    logger.error(error.message);
  } else {
    logger.error('Failed to start bot');
  }

  await stopBot('startup failure');
  process.exitCode = 1;
});

process.once('SIGINT', () => {
  void stopBot('SIGINT');
});

process.once('SIGTERM', () => {
  void stopBot('SIGTERM');
});
