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

describe('kana progress persistence', () => {
  it('saves required and optional game completion independently', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'hijapan-kana-'));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, 'test.sqlite');
    const database = new HiJapanDatabase(databasePath);

    expect(database.getKanaProgress()).toEqual({
      completedLessonIds: [],
      gameCompletedLessonIds: [],
    });
    database.completeKanaLesson('kana-01-a-ka');
    expect(database.getKanaProgress()).toEqual({
      completedLessonIds: ['kana-01-a-ka'],
      gameCompletedLessonIds: [],
    });
    database.completeKanaLesson('kana-01-a-ka', true);
    database.close();

    const reopened = new HiJapanDatabase(databasePath);
    expect(reopened.getKanaProgress()).toEqual({
      completedLessonIds: ['kana-01-a-ka'],
      gameCompletedLessonIds: ['kana-01-a-ka'],
    });
    reopened.close();
  });
});
