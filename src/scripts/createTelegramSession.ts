import 'dotenv/config';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { sessions, TelegramClient } from 'telegram';

// TODO: Waiting for creating tg app
const { StringSession } = sessions;

function readRequiredString(name: 'TELEGRAM_API_HASH'): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readRequiredPositiveInteger(name: 'TELEGRAM_API_ID'): number {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `Invalid environment variable ${name}: expected a positive integer.`,
    );
  }

  return value;
}

async function main(): Promise<void> {
  const apiId = readRequiredPositiveInteger('TELEGRAM_API_ID');
  const apiHash = readRequiredString('TELEGRAM_API_HASH');
  const stringSession = new StringSession('');
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });
  const rl = readline.createInterface({ input, output });

  try {
    await client.start({
      phoneNumber: async () => rl.question('Telegram phone number: '),
      phoneCode: async () => rl.question('Telegram login code: '),
      password: async (hint?: string) =>
        rl.question(`Telegram 2FA password${hint ? ` (${hint})` : ''}: `),
      onError: (error: Error) => {
        console.error(`Telegram authorization error: ${error.message}`);
      },
    });

    console.log('');
    console.log('Telegram authorization succeeded.');
    console.log(
      'Save this StringSession into TELEGRAM_SESSION and never share it with anyone:',
    );
    console.log(stringSession.save());
  } finally {
    await client.disconnect();
    rl.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Failed to create Telegram session: ${message}`);
  process.exitCode = 1;
});
