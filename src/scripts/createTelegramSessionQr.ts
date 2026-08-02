import 'dotenv/config';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import qrcode from 'qrcode-terminal';
import { sessions, TelegramClient } from 'telegram';

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
    await client.connect();

    console.log(
      'Open Telegram on your phone: Settings -> Devices -> Link Desktop Device.',
    );
    console.log('Scan the QR code below and confirm the login.');
    console.log('');

    await client.signInUserWithQrCode(
      {
        apiId,
        apiHash,
      },
      {
        qrCode: async (code) => {
          const loginUrl = `tg://login?token=${code.token.toString('base64url')}`;

          console.log(
            `QR login link expires at ${new Date(code.expires * 1000).toISOString()}`,
          );
          qrcode.generate(loginUrl, { small: true });
          console.log(loginUrl);
          console.log('');
        },
        password: async (hint?: string) =>
          rl.question(`Telegram 2FA password${hint ? ` (${hint})` : ''}: `),
        onError: (error: Error) => {
          console.error(`Telegram QR authorization error: ${error.message}`);
        },
      },
    );

    console.log('');
    console.log('Telegram QR authorization succeeded.');
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
  console.error(`Failed to create Telegram QR session: ${message}`);
  process.exitCode = 1;
});
