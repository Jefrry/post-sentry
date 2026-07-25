export type ChannelDto = {
  channelId: string;
  channelUsername: string;
  title: string;
  currentLastMessageId: number;
};

export type ChannelPostDto = {
  messageId: number;
  date: Date;
  text: string;
  postUrl: string;
  isService: boolean;
};

export type ChannelReaderErrorCode =
  'CHANNEL_NOT_FOUND' | 'CHANNEL_PRIVATE' | 'USERNAME_INVALID' | 'FLOOD_WAIT';
