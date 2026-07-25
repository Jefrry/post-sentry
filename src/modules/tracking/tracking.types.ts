export const allowedIntervalHours = [1, 3, 6, 12, 24] as const;

export type TrackingIntervalHours = (typeof allowedIntervalHours)[number];

export type ParsedKeyword = {
  value: string;
  normalizedValue: string;
};

export type TrackingKeywordDto = ParsedKeyword & {
  id: string;
};

export type TrackingDto = {
  id: string;
  userId: string;
  channelId: string;
  channelUsername: string | null;
  channelTitle: string | null;
  intervalHours: number;
  lastSeenMessageId: number;
  lastCheckedAt: Date | null;
  nextCheckAt: Date;
  isActive: boolean;
  failureCount: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  keywords: TrackingKeywordDto[];
};

export type DueTrackingDto = TrackingDto & {
  user: {
    id: string;
    telegramId: bigint;
  };
};
