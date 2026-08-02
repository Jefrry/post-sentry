import { Markup } from 'telegraf';

export type TrackingListKeyboardItem = {
  id: string;
  displayNumber: number;
};

export function trackingListKeyboard(
  items: readonly TrackingListKeyboardItem[],
  page: number,
  totalPages: number,
) {
  const rows = items.map((item) => [
    Markup.button.callback(
      `🗑 Удалить ${item.displayNumber}`,
      `tl:q:${item.id}:${page}`,
    ),
  ]);
  const paginationRow = [];

  if (page > 0) {
    paginationRow.push(Markup.button.callback(`← ${page}`, `tl:p:${page - 1}`));
  }

  if (page + 1 < totalPages) {
    paginationRow.push(
      Markup.button.callback(`${page + 2} →`, `tl:p:${page + 1}`),
    );
  }

  if (paginationRow.length > 0) {
    rows.push(paginationRow);
  }

  rows.push([Markup.button.callback('Добавить отслеживание', 'tracking:add')]);

  return Markup.inlineKeyboard(rows);
}

export function emptyTrackingListKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Добавить отслеживание', 'tracking:add')],
  ]);
}

export function trackingDeleteConfirmationKeyboard(
  trackingId: string,
  page: number,
) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Удалить', `tl:x:${trackingId}:${page}`)],
    [Markup.button.callback('Отмена', `tl:c:${page}`)],
  ]);
}
