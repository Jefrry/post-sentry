import { Markup } from 'telegraf';

import { allowedIntervalHours } from '../../modules/tracking/tracking.types.js';

export const trackingCancelKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('Отмена', 'tracking:cancel')],
]);

export const trackingIntervalKeyboard = Markup.inlineKeyboard([
  allowedIntervalHours.map((hours) =>
    Markup.button.callback(`${hours} ч`, `tracking:interval:${hours}`),
  ),
  [Markup.button.callback('Отмена', 'tracking:cancel')],
]);
