import type { Telegram } from 'telegraf';

export const trackingListCommand = 'list';
export const trackingAddCommand = 'add';

export async function configureCommandMenu(telegram: Telegram): Promise<void> {
  await telegram.setMyCommands(
    [
      { command: trackingListCommand, description: 'Мои отслеживания' },
      { command: trackingAddCommand, description: 'Добавить отслеживание' },
    ],
    { scope: { type: 'all_private_chats' } },
  );
  await telegram.setChatMenuButton({ menuButton: { type: 'commands' } });
}
