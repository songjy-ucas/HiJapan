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
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('JLPT progress persistence', () => {
  it('stores scores and limits cumulative review to learned lessons', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'hijapan-jlpt-'));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, 'test.sqlite');
    const database = new HiJapanDatabase(databasePath);
    const lesson = database.listJlptLessons('N5')[0];
    expect(lesson).toBeDefined();
    expect(database.getJlptCumulativeLesson('N5')).toBeNull();

    database.completeJlptLesson({
      lessonId: lesson!.id,
      score: 90,
      difficultItemIds: [],
      gameCompleted: true,
    });
    database.close();

    const reopened = new HiJapanDatabase(databasePath);
    expect(reopened.getJlptProgress()).toEqual({
      completedLessonIds: [lesson!.id],
      scores: { [lesson!.id]: 90 },
      gameCompletedLessonIds: [lesson!.id],
    });
    const cumulative = reopened.getJlptCumulativeLesson('N5');
    expect(cumulative).not.toBeNull();
    expect(cumulative!.vocabulary.length).toBeGreaterThan(0);
    reopened.close();
  });
});
