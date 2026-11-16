const utcDateTime = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'UTC',
  year: '2-digit',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatUtcDateTime(date: Date): string {
  return utcDateTime.format(date);
}
