import { TelegramError } from 'telegraf';

export function isMessageNotModifiedError(error: unknown): boolean {
  return (
    error instanceof TelegramError &&
    error.code === 400 &&
    error.description.includes('message is not modified')
  );
}
