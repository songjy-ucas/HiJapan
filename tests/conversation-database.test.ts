import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HiJapanDatabase } from '../src/main/database';

vi.mock('electron', () => ({
  app: {
    getPath: () => tmpdir(),
    getVersion: () => 'test',
  },
}));

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('conversation database history', () => {
  it('keeps recent local conversations and prunes records older than seven days', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'hijapan-history-'));
    temporaryDirectories.push(directory);
    const database = new HiJapanDatabase(path.join(directory, 'test.sqlite'));
    expect(database.getSnapshot().appVersion).toBe('test');
    const now = Date.now();
    const recent = new Date(now - 24 * 60 * 60 * 1_000).toISOString();
    const expired = new Date(now - 8 * 24 * 60 * 60 * 1_000).toISOString();

    database.importData({
      backup_schema_version: 1,
      data: {
        conversation_sessions: [
          {
            id: 'recent-session',
            scene: 'restaurant',
            difficulty: 'starter',
            correction_style: 'standard',
            status: 'active',
            created_at: recent,
            ended_at: null,
          },
          {
            id: 'expired-session',
            scene: 'hotel',
            difficulty: 'N5',
            correction_style: 'gentle',
            status: 'completed',
            created_at: expired,
            ended_at: expired,
          },
        ],
        conversation_messages: [
          {
            id: 'recent-message',
            session_id: 'recent-session',
            role: 'assistant',
            content: 'どうぞ。（请。）',
            created_at: recent,
          },
          {
            id: 'expired-message',
            session_id: 'expired-session',
            role: 'assistant',
            content: '古い会話',
            created_at: expired,
          },
        ],
      },
    });

    expect(database.listConversationHistory()).toEqual([
      expect.objectContaining({
        id: 'recent-session',
        messageCount: 1,
        preview: 'どうぞ。（请。）',
      }),
    ]);
    expect(database.getConversation('recent-session').messages).toEqual([
      expect.objectContaining({ id: 'recent-message', role: 'assistant' }),
    ]);

    database.close();
  });

  it('deletes one history item without affecting the remaining item', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'hijapan-history-'));
    temporaryDirectories.push(directory);
    const database = new HiJapanDatabase(path.join(directory, 'test.sqlite'));
    const first = database.createConversation(
      'restaurant',
      'starter',
      'standard',
    );
    const second = database.createConversation('hotel', 'N5', 'gentle');
    database.addMessage(first, 'user', 'こんにちは');
    database.addMessage(second, 'user', '予約があります');

    expect(database.deleteConversation(first).map((item) => item.id)).toEqual([
      second,
    ]);

    database.close();
  });
});
