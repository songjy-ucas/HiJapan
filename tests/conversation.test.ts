import { describe, expect, it } from 'vitest';
import {
  conversationRetentionCutoff,
  extractJapaneseSpeech,
} from '../src/domain/conversation';

describe('conversation history retention', () => {
  it('calculates a seven-day UTC cutoff', () => {
    expect(
      conversationRetentionCutoff(new Date('2026-10-29T08:30:00.000Z')),
    ).toBe('2026-10-22T08:30:00.000Z');
  });

  it('rejects invalid retention windows', () => {
    expect(() => conversationRetentionCutoff(new Date(), 0)).toThrowError(
      'CONVERSATION_RETENTION_DAYS_INVALID',
    );
  });
});

describe('Japanese speech extraction', () => {
  it('removes full-width Chinese translations from bilingual replies', () => {
    expect(
      extractJapaneseSpeech(
        'いらっしゃいませ。（欢迎光临。）何名様ですか。（请问几位？）',
      ),
    ).toBe('いらっしゃいませ。 何名様ですか。');
  });

  it('removes ASCII parenthetical translations and separate translation lines', () => {
    expect(
      extractJapaneseSpeech(
        '日本語：こちらへどうぞ。(请到这边。)\n中文：请到这边。',
      ),
    ).toBe('こちらへどうぞ。');
  });

  it('keeps ordinary Japanese-only replies unchanged', () => {
    expect(extractJapaneseSpeech('お会計は二千円です。')).toBe(
      'お会計は二千円です。',
    );
  });
});
