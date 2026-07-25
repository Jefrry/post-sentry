import { sessions, TelegramClient } from 'telegram';

import { env } from '../../config/env.js';

const connectionRetries = 5;
const { StringSession } = sessions;

export class TelegramStartupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TelegramStartupError';
  }
}

export class TelegramClientService {
  private readonly client: TelegramClient;

  constructor(
    private readonly session = env.TELEGRAM_SESSION,
    private readonly apiId = env.TELEGRAM_API_ID,
    private readonly apiHash = env.TELEGRAM_API_HASH,
  ) {
    this.client = new TelegramClient(
      new StringSession(session),
      apiId,
      apiHash,
      {
        connectionRetries,
      },
    );
  }

  getClient(): TelegramClient {
    return this.client;
  }

  async connect(): Promise<void> {
    if (!this.session.trim()) {
      throw new TelegramStartupError(
        'TELEGRAM_SESSION is empty. Run pnpm telegram:auth and save the generated StringSession in TELEGRAM_SESSION.',
      );
    }

    try {
      await this.client.connect();
    } catch {
      throw new TelegramStartupError(
        'Failed to connect Telegram MTProto client. Check TELEGRAM_API_ID, TELEGRAM_API_HASH and network access.',
      );
    }
  }

  async checkAuthorization(): Promise<void> {
    let isAuthorized: boolean;

    try {
      isAuthorized = await this.client.checkAuthorization();
    } catch {
      throw new TelegramStartupError(
        'Failed to verify Telegram MTProto authorization. Recreate TELEGRAM_SESSION with pnpm telegram:auth.',
      );
    }

    if (!isAuthorized) {
      throw new TelegramStartupError(
        'Telegram MTProto session is not authorized or has expired. Recreate TELEGRAM_SESSION with pnpm telegram:auth.',
      );
    }
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
}
