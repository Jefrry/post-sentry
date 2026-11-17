import { formatUtcDateTime } from './formatUtcDateTime.js';

export function formatTelegramDateTime(date: Date): string {
  const unixTime = Math.floor(date.getTime() / 1_000);
  return `<tg-time unix="${unixTime}" format="dt">${formatUtcDateTime(date)} UTC</tg-time>`;
}
