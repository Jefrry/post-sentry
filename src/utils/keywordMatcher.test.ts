import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DomainError } from '../modules/common/domainError.js';
import {
  findMatchingKeywords,
  normalizeSearchText,
  parseKeywords,
} from './keywordMatcher.js';

describe('parseKeywords', () => {
  const validCases = [
    {
      input: 'alpha, beta, ALPHA, Ａ',
      expected: [
        { value: 'alpha', normalizedValue: 'alpha' },
        { value: 'beta', normalizedValue: 'beta' },
        { value: 'Ａ', normalizedValue: 'a' },
      ],
    },
    {
      input: '  Привет  , пост ',
      expected: [
        { value: 'Привет', normalizedValue: 'привет' },
        { value: 'пост', normalizedValue: 'пост' },
      ],
    },
  ] as const;

  for (const testCase of validCases) {
    it(`parses ${testCase.input}`, () => {
      assert.deepEqual(parseKeywords(testCase.input), testCase.expected);
    });
  }

  const invalidCases = [
    '',
    ' , , ',
    'a'.repeat(65),
    Array.from({ length: 21 }, (_, index) => `kw${index}`).join(','),
  ] as const;

  for (const input of invalidCases) {
    it('rejects invalid keyword input', () => {
      assert.throws(() => parseKeywords(input), DomainError);
    });
  }
});

describe('findMatchingKeywords', () => {
  const cases = [
    {
      text: 'Новый POST про TypeScript',
      keywords: parseKeywords('post, prisma'),
      expected: ['post'],
    },
    {
      text: 'Полная Ａ-версия',
      keywords: parseKeywords('a'),
      expected: ['a'],
    },
    {
      text: null,
      keywords: parseKeywords('post'),
      expected: [],
    },
  ] as const;

  for (const testCase of cases) {
    it(`matches ${String(testCase.text)}`, () => {
      assert.deepEqual(
        findMatchingKeywords(testCase.text, testCase.keywords).map(
          (keyword) => keyword.normalizedValue,
        ),
        testCase.expected,
      );
    });
  }
});

describe('normalizeSearchText', () => {
  it('uses NFKC and lower case', () => {
    assert.equal(normalizeSearchText('ＡБВ'), 'aбв');
  });
});
