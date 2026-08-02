import { Api, errors, type TelegramClient } from 'telegram';

import { ChannelReaderError } from './channelReader.errors.js';
import type { ChannelDto, ChannelPostDto } from './channel.types.js';

const usernamePattern = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

export type GramJsClientAdapter = {
  getEntity(entity: string): Promise<Api.TypeUser | Api.TypeChat>;
  getMessages(
    entity: string | undefined,
    params?: Parameters<TelegramClient['getMessages']>[1],
  ): Promise<readonly GramJsMessage[]>;
};

type GramJsMessage = Api.Message | Api.MessageService;

export class ChannelReaderService {
  constructor(private readonly client: GramJsClientAdapter) {}

  async resolvePublicChannel(username: string): Promise<ChannelDto> {
    const normalizedUsername = this.normalizeUsername(username);

    try {
      const entity = await this.client.getEntity(`@${normalizedUsername}`);
      const channel = this.toPublicBroadcastChannel(entity);
      const channelUsername = this.getPublicUsername(
        channel,
        normalizedUsername,
      );

      if (!channelUsername) {
        throw new ChannelReaderError(
          'CHANNEL_PRIVATE',
          'Нужен доступный публичный broadcast-канал с username.',
        );
      }

      const currentLastMessageId =
        await this.getCurrentLastMessageId(normalizedUsername);

      return {
        channelId: this.toStableChannelId(channel.id),
        channelUsername,
        title: channel.title,
        currentLastMessageId,
      };
    } catch (error) {
      throw this.toDomainError(error);
    }
  }

  async getMessagesAfter(
    channelUsername: string,
    lastSeenMessageId: number,
  ): Promise<ChannelPostDto[]> {
    const normalizedUsername = this.normalizeUsername(channelUsername);

    if (!Number.isInteger(lastSeenMessageId) || lastSeenMessageId < 0) {
      throw new ChannelReaderError(
        'USERNAME_INVALID',
        'Некорректный курсор сообщения.',
      );
    }

    try {
      const messages = await this.client.getMessages(`@${normalizedUsername}`, {
        limit: undefined,
        minId: lastSeenMessageId,
        reverse: true,
      });

      return messages.map((message) =>
        this.toChannelPostDto(normalizedUsername, message),
      );
    } catch (error) {
      throw this.toDomainError(error);
    }
  }

  toPublicBroadcastChannel(entity: Api.TypeUser | Api.TypeChat): Api.Channel {
    if (entity instanceof Api.ChannelForbidden) {
      throw new ChannelReaderError(
        'CHANNEL_PRIVATE',
        'Канал недоступен или является приватным.',
      );
    }

    if (!(entity instanceof Api.Channel)) {
      throw new ChannelReaderError(
        'CHANNEL_NOT_FOUND',
        'Публичный канал не найден.',
      );
    }

    if (!entity.broadcast || !this.getPublicUsername(entity)) {
      throw new ChannelReaderError(
        'CHANNEL_PRIVATE',
        'Нужен доступный публичный broadcast-канал с username.',
      );
    }

    return entity;
  }

  toChannelPostDto(
    channelUsername: string,
    message: GramJsMessage,
  ): ChannelPostDto {
    return {
      messageId: message.id,
      date: new Date(message.date * 1000),
      text:
        message instanceof Api.MessageService
          ? ''
          : (message.message?.trim() ?? ''),
      postUrl: `https://t.me/${channelUsername}/${message.id}`,
      isService: message instanceof Api.MessageService,
    };
  }

  private async getCurrentLastMessageId(username: string): Promise<number> {
    const messages = await this.client.getMessages(`@${username}`, {
      limit: 1,
    });
    const [lastMessage] = messages;

    return lastMessage?.id ?? 0;
  }

  private normalizeUsername(username: string): string {
    const normalizedUsername = username.trim().replace(/^@/, '');

    if (!usernamePattern.test(normalizedUsername)) {
      throw new ChannelReaderError(
        'USERNAME_INVALID',
        'Username канала должен содержать 5-32 латинских символа, цифры или _.',
      );
    }

    return normalizedUsername;
  }

  private getPublicUsername(
    channel: Api.Channel,
    fallbackUsername?: string,
  ): string | null {
    if (channel.username) {
      return channel.username;
    }

    const activeUsername = channel.usernames?.find(
      (username) => username.active,
    )?.username;

    return activeUsername ?? fallbackUsername ?? null;
  }

  private toStableChannelId(channelId: Api.Channel['id']): string {
    return channelId.toString();
  }

  private toDomainError(error: unknown): ChannelReaderError {
    if (error instanceof ChannelReaderError) {
      return error;
    }

    if (error instanceof errors.FloodWaitError) {
      return new ChannelReaderError(
        'FLOOD_WAIT',
        `Telegram просит повторить запрос через ${error.seconds} секунд.`,
        error.seconds,
      );
    }

    const message = error instanceof Error ? error.message : '';

    if (message.includes('USERNAME_INVALID')) {
      return new ChannelReaderError(
        'USERNAME_INVALID',
        'Некорректный username канала.',
      );
    }

    if (
      message.includes('USERNAME_NOT_OCCUPIED') ||
      message.includes('CHANNEL_INVALID') ||
      message.includes('PEER_ID_INVALID')
    ) {
      return new ChannelReaderError(
        'CHANNEL_NOT_FOUND',
        'Публичный канал не найден.',
      );
    }

    if (
      message.includes('CHANNEL_PRIVATE') ||
      message.includes('CHAT_PRIVATE')
    ) {
      return new ChannelReaderError(
        'CHANNEL_PRIVATE',
        'Канал недоступен или является приватным.',
      );
    }

    return new ChannelReaderError(
      'CHANNEL_NOT_FOUND',
      'Не удалось прочитать публичный канал.',
    );
  }
}
