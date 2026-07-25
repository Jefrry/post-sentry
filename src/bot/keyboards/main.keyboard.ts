import { Markup } from 'telegraf';

export const mainKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('Добавить отслеживание', 'tracking:add')],
  [Markup.button.callback('Мои отслеживания', 'tracking:list')],
]);
