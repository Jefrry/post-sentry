import { UserRepository } from './user.repository.js';

type TelegramUser = {
  id: number;
  is_bot: boolean;
  first_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
};

export type UserDto = {
  id: string;
  telegramId: bigint;
  isBot: boolean;
  firstName: string | null;
  username: string | null;
  languageCode: string | null;
  isPremium: boolean;
};

export class UserService {
  constructor(private readonly userRepository = new UserRepository()) {}

  async registerTelegramUser(telegramUser: TelegramUser): Promise<UserDto> {
    const user = await this.userRepository.upsertByTelegramId({
      telegramId: BigInt(telegramUser.id),
      isBot: telegramUser.is_bot,
      firstName: telegramUser.first_name ?? null,
      username: telegramUser.username ?? null,
      languageCode: telegramUser.language_code ?? null,
      isPremium: telegramUser.is_premium ?? false,
    });

    return {
      id: user.id,
      telegramId: user.telegramId,
      isBot: user.isBot,
      firstName: user.firstName,
      username: user.username,
      languageCode: user.languageCode,
      isPremium: user.isPremium,
    };
  }
}
