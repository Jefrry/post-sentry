import type { ChannelReaderService } from '../../modules/channels/channelReader.service.js';
import type { TrackingService } from '../../modules/tracking/tracking.service.js';
import type { UserService } from '../../modules/users/user.service.js';
import type { UserStateManager } from '../../modules/users/userStateManager.js';

export type BotHandlerDeps = {
  userService: UserService;
  trackingService: TrackingService;
  channelReaderService: ChannelReaderService;
  userStateManager: UserStateManager;
};
