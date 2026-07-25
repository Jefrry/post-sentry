import { DomainError } from '../modules/common/domainError.js';
import type { ParsedKeyword } from '../modules/tracking/tracking.types.js';

const maxKeywordCount = 20;
const maxKeywordLength = 64;

export function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').toLowerCase();
}

export function parseKeywords(input: string): ParsedKeyword[] {
  const uniqueKeywords = new Map<string, string>();

  for (const rawKeyword of input.split(',')) {
    const value = rawKeyword.trim();

    if (!value) {
      continue;
    }

    if (Array.from(value).length > maxKeywordLength) {
      throw new DomainError(
        `Ключевое слово не должно быть длиннее ${maxKeywordLength} символов.`,
      );
    }

    const normalizedValue = normalizeSearchText(value);

    if (!uniqueKeywords.has(normalizedValue)) {
      uniqueKeywords.set(normalizedValue, value);
    }
  }

  if (uniqueKeywords.size === 0) {
    throw new DomainError('Добавь хотя бы одно ключевое слово.');
  }

  if (uniqueKeywords.size > maxKeywordCount) {
    throw new DomainError(
      `Можно добавить не больше ${maxKeywordCount} ключевых слов.`,
    );
  }

  return Array.from(uniqueKeywords.entries()).map(
    ([normalizedValue, value]) => ({
      value,
      normalizedValue,
    }),
  );
}

export function findMatchingKeywords(
  text: string | null | undefined,
  keywords: readonly ParsedKeyword[],
): ParsedKeyword[] {
  if (!text) {
    return [];
  }

  const normalizedText = normalizeSearchText(text);

  return keywords.filter((keyword) =>
    normalizedText.includes(keyword.normalizedValue),
  );
}
