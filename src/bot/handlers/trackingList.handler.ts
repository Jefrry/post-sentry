import { Telegraf, type Context } from 'telegraf';

import { DomainError } from '../../modules/common/domainError.js';
import type { TrackingDto } from '../../modules/tracking/tracking.types.js';
import {
  emptyTrackingListKeyboard,
  trackingDeleteConfirmationKeyboard,
  trackingListKeyboard,
} from '../keyboards/trackingList.keyboard.js';
import { isMessageNotModifiedError } from '../telegramError.js';
import type { BotHandlerDeps } from './types.js';

const pageSize = 5;
const maxKeywordsTextLength = 420;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class TrackingListHandler {
  constructor(
    private readonly bot: Telegraf,
    private readonly deps: BotHandlerDeps,
  ) {}

  register(): void {
    this.bot.action('tracking:list', async (ctx) => {
      await ctx.answerCbQuery();
      await this.showCurrentUserList(ctx, 0);
    });

    this.bot.action(/^tl:p:([^:]+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const page = this.parsePage(ctx.match[1]);

      await this.showCurrentUserList(
        ctx,
        page ?? 0,
        page === undefined ? 'Некорректный номер страницы.' : undefined,
      );
    });

    this.bot.action(/^tl:q:([^:]+):([^:]+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const trackingId = ctx.match[1] ?? '';
      const page = this.parsePage(ctx.match[2]);

      if (!uuidPattern.test(trackingId) || page === undefined) {
        await this.showCurrentUserList(
          ctx,
          0,
          'Отслеживание не найдено или уже удалено.',
        );
        return;
      }

      try {
        const userId = await this.getCurrentUserId(ctx);

        if (!userId) {
          return;
        }

        const tracking = await this.deps.trackingService.getOwnedTracking(
          userId,
          trackingId,
        );

        await ctx.editMessageText(
          [
            'Удалить отслеживание?',
            `Канал: ${this.formatChannel(tracking)}`,
          ].join('\n'),
          trackingDeleteConfirmationKeyboard(tracking.id, page),
        );
      } catch (error) {
        if (error instanceof DomainError) {
          await this.showCurrentUserList(
            ctx,
            page,
            'Отслеживание не найдено или уже удалено.',
          );
          return;
        }

        await this.replyWithError(
          ctx,
          error,
          'Не удалось открыть подтверждение удаления.',
        );
      }
    });

    this.bot.action(/^tl:x:([^:]+):([^:]+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const trackingId = ctx.match[1] ?? '';
      const page = this.parsePage(ctx.match[2]);

      if (!uuidPattern.test(trackingId) || page === undefined) {
        await this.showCurrentUserList(
          ctx,
          0,
          'Отслеживание не найдено или уже удалено.',
        );
        return;
      }

      try {
        const userId = await this.getCurrentUserId(ctx);

        if (!userId) {
          return;
        }

        const deleted = await this.deps.trackingService.deleteOwned(
          trackingId,
          userId,
        );

        await this.showList(
          ctx,
          userId,
          page,
          deleted
            ? 'Отслеживание удалено.'
            : 'Отслеживание уже удалено или недоступно.',
        );
      } catch (error) {
        await this.replyWithError(
          ctx,
          error,
          'Не удалось удалить отслеживание.',
        );
      }
    });

    this.bot.action(/^tl:c:([^:]+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const page = this.parsePage(ctx.match[1]);

      await this.showCurrentUserList(
        ctx,
        page ?? 0,
        page === undefined ? 'Некорректный номер страницы.' : undefined,
      );
    });
  }

  private async showCurrentUserList(
    ctx: Context,
    page: number,
    notice?: string,
  ): Promise<void> {
    try {
      const userId = await this.getCurrentUserId(ctx);

      if (!userId) {
        return;
      }

      await this.showList(ctx, userId, page, notice);
    } catch (error) {
      await this.replyWithError(
        ctx,
        error,
        'Не удалось получить список отслеживаний.',
      );
    }
  }

  private async showList(
    ctx: Context,
    userId: string,
    requestedPage: number,
    notice?: string,
  ): Promise<void> {
    const trackings = await this.deps.trackingService.listUserTrackings(userId);
    const totalPages = Math.max(1, Math.ceil(trackings.length / pageSize));
    const page = Math.min(requestedPage, totalPages - 1);
    const effectiveNotice =
      notice ??
      (requestedPage !== page
        ? 'Эта страница уже недоступна. Показана последняя актуальная страница.'
        : undefined);
    const pageItems = trackings.slice(
      page * pageSize,
      page * pageSize + pageSize,
    );
    const text = this.formatList(pageItems, page, totalPages, effectiveNotice);
    const keyboard =
      trackings.length === 0
        ? emptyTrackingListKeyboard()
        : trackingListKeyboard(
            pageItems.map((tracking, index) => ({
              id: tracking.id,
              displayNumber: page * pageSize + index + 1,
            })),
            page,
            totalPages,
          );

    try {
      await ctx.editMessageText(text, keyboard);
    } catch (error) {
      if (!isMessageNotModifiedError(error)) {
        throw error;
      }
    }
  }

  private async getCurrentUserId(ctx: Context): Promise<string | undefined> {
    if (ctx.chat?.type !== 'private') {
      await ctx.reply('Просматривать отслеживания можно только в личном чате.');
      return undefined;
    }

    if (!ctx.from) {
      await ctx.reply('Не удалось получить данные пользователя.');
      return undefined;
    }

    const user = await this.deps.userService.registerTelegramUser(ctx.from);

    return user.id;
  }

  private parsePage(rawPage: string | undefined): number | undefined {
    if (!rawPage || !/^(0|[1-9]\d{0,8})$/.test(rawPage)) {
      return undefined;
    }

    const page = Number(rawPage);

    return Number.isSafeInteger(page) ? page : undefined;
  }

  private formatList(
    trackings: readonly TrackingDto[],
    page: number,
    totalPages: number,
    notice?: string,
  ): string {
    const parts = notice ? [notice, ''] : [];

    if (trackings.length === 0) {
      parts.push(
        'У тебя пока нет отслеживаний.',
        'Добавь публичный канал, чтобы начать мониторинг.',
      );
      return parts.join('\n');
    }

    parts.push(`Мои отслеживания — страница ${page + 1}/${totalPages}`, '');

    for (const [index, tracking] of trackings.entries()) {
      const keywords = this.truncate(
        tracking.keywords
          .map((keyword) => this.compactPlainText(keyword.value))
          .join(', '),
        maxKeywordsTextLength,
      );
      const status =
        tracking.isActive && !tracking.lastError ? '✅ active' : '❌ error';

      parts.push(
        `${page * pageSize + index + 1}. ${this.formatChannel(tracking)}`,
        `Ключевые слова: ${keywords}`,
        `Интервал: ${tracking.intervalHours} ч`,
        `Статус: ${status}`,
        `Следующая проверка: ${tracking.nextCheckAt.toISOString()}`,
        '',
      );
    }

    return parts.join('\n').trimEnd();
  }

  private formatChannel(tracking: TrackingDto): string {
    const username = tracking.channelUsername
      ? `@${this.compactPlainText(tracking.channelUsername)}`
      : 'без username';
    const title = tracking.channelTitle
      ? this.compactPlainText(tracking.channelTitle)
      : 'без названия';

    return `${username} — ${title}`;
  }

  private compactPlainText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  private truncate(value: string, maxLength: number): string {
    if (Array.from(value).length <= maxLength) {
      return value;
    }

    return `${Array.from(value)
      .slice(0, maxLength - 1)
      .join('')}…`;
  }

  private async replyWithError(
    ctx: Context,
    error: unknown,
    fallbackText: string,
  ): Promise<void> {
    await ctx.reply(
      error instanceof DomainError ? error.message : fallbackText,
    );
  }
}
