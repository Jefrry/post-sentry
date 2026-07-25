import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Api } from 'telegram';

import { ChannelReaderError } from './channelReader.errors.js';
import {
  ChannelReaderService,
  type GramJsClientAdapter,
} from './channelReader.service.js';

describe('ChannelReaderService.resolvePublicChannel', () => {
  it('maps a public broadcast channel to DTO', async () => {
    const channel = createChannel({
      id: '1001234567890',
      username: 'public_channel',
      title: 'Public Channel',
    });
    const client = new FakeGramJsClient({
      entity: channel,
      messages: [createMessage({ id: 42, message: 'latest' })],
    });
    const service = new ChannelReaderService(client);

    const result = await service.resolvePublicChannel('@public_channel');

    assert.deepEqual(result, {
      channelId: '1001234567890',
      channelUsername: 'public_channel',
      title: 'Public Channel',
      currentLastMessageId: 42,
    });
  });

  it('rejects non-broadcast entities', async () => {
    const client = new FakeGramJsClient({
      entity: new Api.User({
        id: createLongId('123'),
        isSelf: false,
        contact: false,
        mutualContact: false,
        deleted: false,
        bot: false,
        botChatHistory: false,
        botNochats: false,
        verified: false,
        restricted: false,
        min: false,
        botInlineGeo: false,
        support: false,
        scam: false,
        applyMinPhoto: false,
        fake: false,
        botAttachMenu: false,
      }),
      messages: [],
    });
    const service = new ChannelReaderService(client);

    await assert.rejects(
      () => service.resolvePublicChannel('public_channel'),
      (error) =>
        error instanceof ChannelReaderError &&
        error.code === 'CHANNEL_NOT_FOUND',
    );
  });
});

describe('ChannelReaderService.getMessagesAfter', () => {
  it('requests messages after cursor and maps non-empty posts from old to new', async () => {
    const messages = [
      createMessage({ id: 11, date: 1_700_000_000, message: ' first post ' }),
      createMessage({ id: 12, date: 1_700_000_060, message: '' }),
      createServiceMessage({ id: 13, date: 1_700_000_120 }),
      createMessage({ id: 14, date: 1_700_000_180, message: 'second post' }),
    ];
    const client = new FakeGramJsClient({
      entity: createChannel({
        id: '1001234567890',
        username: 'public_channel',
        title: 'Public Channel',
      }),
      messages,
    });
    const service = new ChannelReaderService(client);

    const result = await service.getMessagesAfter('public_channel', 10);

    assert.deepEqual(client.lastGetMessagesParams, {
      minId: 10,
      reverse: true,
    });
    assert.deepEqual(
      result.map((message) => ({
        messageId: message.messageId,
        date: message.date.toISOString(),
        text: message.text,
        postUrl: message.postUrl,
        isService: message.isService,
      })),
      [
        {
          messageId: 11,
          date: '2023-11-14T22:13:20.000Z',
          text: 'first post',
          postUrl: 'https://t.me/public_channel/11',
          isService: false,
        },
        {
          messageId: 14,
          date: '2023-11-14T22:16:20.000Z',
          text: 'second post',
          postUrl: 'https://t.me/public_channel/14',
          isService: false,
        },
      ],
    );
  });
});

class FakeGramJsClient implements GramJsClientAdapter {
  lastGetMessagesParams: Parameters<GramJsClientAdapter['getMessages']>[1];

  constructor(
    private readonly data: {
      entity: Api.TypeUser | Api.TypeChat;
      messages: readonly (Api.Message | Api.MessageService)[];
    },
  ) {}

  async getEntity(entity: EntityLike): Promise<Api.TypeUser | Api.TypeChat> {
    void entity;

    return this.data.entity;
  }

  async getMessages(
    entity: string | undefined,
    params?: Parameters<GramJsClientAdapter['getMessages']>[1],
  ): Promise<readonly (Api.Message | Api.MessageService)[]> {
    void entity;

    this.lastGetMessagesParams = params;

    return this.data.messages;
  }
}

type EntityLike = string;

function createChannel(input: {
  id: string;
  username: string;
  title: string;
}): Api.Channel {
  return new Api.Channel({
    id: createLongId(input.id),
    broadcast: true,
    title: input.title,
    username: input.username,
    photo: new Api.ChatPhotoEmpty(),
    date: 1_700_000_000,
  });
}

function createMessage(input: {
  id: number;
  message: string;
  date?: number;
}): Api.Message {
  return new Api.Message({
    id: input.id,
    date: input.date ?? 1_700_000_000,
    message: input.message,
  });
}

function createServiceMessage(input: {
  id: number;
  date?: number;
}): Api.MessageService {
  return new Api.MessageService({
    id: input.id,
    date: input.date ?? 1_700_000_000,
  });
}

function createLongId(value: string): Api.Channel['id'] {
  return {
    toString: () => value,
  } as Api.Channel['id'];
}
