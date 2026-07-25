import { DomainError } from '../modules/common/domainError.js';

const allowedDomains = new Set(['t.me', 'telegram.me']);
const usernamePattern = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

export type ParsedChannelLink = {
  username: string;
};

export function parseChannelLink(input: string): ParsedChannelLink {
  const value = input.trim();

  if (!value) {
    throw new DomainError('Ссылка на канал не должна быть пустой.');
  }

  if (value.startsWith('@')) {
    return {
      username: parseUsername(value.slice(1)),
    };
  }

  const url = parseUrl(value);

  if (!allowedDomains.has(url.hostname)) {
    throw new DomainError('Допустимы только ссылки t.me или telegram.me.');
  }

  if (url.search || url.hash) {
    throw new DomainError(
      'Ссылка на канал не должна содержать query или hash.',
    );
  }

  const parts = url.pathname.split('/').filter(Boolean);

  if (parts.length !== 1) {
    throw new DomainError('Нужна ссылка на канал, а не на раздел или пост.');
  }

  const [username] = parts;

  if (!username || username === 'c' || username.startsWith('+')) {
    throw new DomainError('Invite links и приватные ссылки не поддерживаются.');
  }

  if (username === 'joinchat') {
    throw new DomainError('Invite links не поддерживаются.');
  }

  return {
    username: parseUsername(username),
  };
}

function parseUrl(value: string): URL {
  try {
    const normalizedValue = /^https?:\/\//i.test(value)
      ? value
      : `https://${value}`;

    return new URL(normalizedValue);
  } catch {
    throw new DomainError('Некорректная ссылка на канал.');
  }
}

function parseUsername(username: string): string {
  const normalizedUsername = username.trim();

  if (!usernamePattern.test(normalizedUsername)) {
    throw new DomainError(
      'Username канала должен содержать 5-32 латинских символа, цифры или _.',
    );
  }

  return normalizedUsername;
}
