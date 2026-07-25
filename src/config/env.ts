import 'dotenv/config';

type RequiredStringVariable =
  'BOT_TOKEN' | 'DATABASE_URL' | 'TELEGRAM_API_HASH' | 'TELEGRAM_SESSION';
type RequiredNumberVariable =
  'SCHEDULER_POLL_MS' | 'CHECK_RETRY_MS' | 'TELEGRAM_API_ID';

type Environment = Record<RequiredStringVariable, string> &
  Record<RequiredNumberVariable, number>;

function readRequiredString(name: RequiredStringVariable): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readRequiredPositiveInteger(name: RequiredNumberVariable): number {
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

function loadEnvironment(): Environment {
  return {
    BOT_TOKEN: readRequiredString('BOT_TOKEN'),
    DATABASE_URL: readRequiredString('DATABASE_URL'),
    TELEGRAM_API_HASH: readRequiredString('TELEGRAM_API_HASH'),
    TELEGRAM_SESSION: readRequiredString('TELEGRAM_SESSION'),
    TELEGRAM_API_ID: readRequiredPositiveInteger('TELEGRAM_API_ID'),
    SCHEDULER_POLL_MS: readRequiredPositiveInteger('SCHEDULER_POLL_MS'),
    CHECK_RETRY_MS: readRequiredPositiveInteger('CHECK_RETRY_MS'),
  };
}

export const env = loadEnvironment();
