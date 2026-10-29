import { describe, expect, it } from 'vitest';
import {
  createMemoryDeck,
  getLessonEntries,
  hasPriorKanaLessons,
  kanaCourse,
  kanaSelectionMatches,
  validateKanaCourse,
} from '../src/domain/kana';

describe('kana course', () => {
  it('contains five lessons with two rows and valid staged vocabulary', () => {
    expect(kanaCourse.lessons).toHaveLength(5);
    expect(validateKanaCourse()).toEqual([]);
  });

  it('builds current and cumulative test pools', () => {
    expect(getLessonEntries(0)).toHaveLength(10);
    expect(getLessonEntries(3)).toHaveLength(8);
    expect(getLessonEntries(3, true)).toHaveLength(38);
    expect(getLessonEntries(4, true)).toHaveLength(46);
  });

  it('does not offer cumulative review in the first lesson', () => {
    expect(hasPriorKanaLessons(0)).toBe(false);
    expect(hasPriorKanaLessons(1)).toBe(true);
  });

  it('only accepts three forms belonging to the same kana', () => {
    const [a, i] = getLessonEntries(0);
    expect(a).toBeDefined();
    expect(i).toBeDefined();
    expect(kanaSelectionMatches([a!, a!, a!])).toBe(true);
    expect(kanaSelectionMatches([a!, a!, i!])).toBe(false);
  });

  it('creates two different forms for each memory-game pair', () => {
    const deck = createMemoryDeck(getLessonEntries(0), 4, () => 0.42);
    expect(deck).toHaveLength(8);
    const groups = Map.groupBy(deck, (card) => card.matchId);
    expect(groups.size).toBe(4);
    for (const cards of groups.values()) {
      expect(cards).toHaveLength(2);
      expect(new Set(cards.map((card) => card.form)).size).toBe(2);
    }
  });
});
