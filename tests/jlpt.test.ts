import { describe, expect, it } from 'vitest';
import {
  createJlptMemoryDeck,
  createJlptReadingMatchItems,
  createSentenceChunks,
  createSentenceCompletionPuzzle,
  createSentenceOrderPuzzle,
  getJlptCumulativeLesson,
  getJlptLesson,
  jlptCourse,
  listJlptLessons,
  normalizeJlptMeaning,
  splitJlptMeaning,
  toHiragana,
  validateJlptCourse,
} from '../src/domain/jlpt';

describe('JLPT course', () => {
  it('contains all levels and valid short lessons', () => {
    expect(jlptCourse.levels).toEqual(['N5', 'N4', 'N3', 'N2', 'N1']);
    expect(validateJlptCourse()).toEqual([]);
    for (const level of jlptCourse.levels) {
      const lessons = listJlptLessons(level);
      expect(lessons.length).toBeGreaterThan(0);
      expect(
        lessons.every((lesson) => lesson.minutes >= 5 && lesson.minutes <= 10),
      ).toBe(true);
      expect(lessons.every((lesson) => lesson.vocabularyCount <= 10)).toBe(
        true,
      );
    }
  });

  it('builds tests from completed lessons only', () => {
    const first = listJlptLessons('N5')[0];
    expect(first).toBeDefined();
    const cumulative = getJlptCumulativeLesson('N5', [first!.id], () => 0.4);
    expect(cumulative).not.toBeNull();
    const detail = getJlptLesson(first!.id);
    expect(
      cumulative!.vocabulary.every((item) =>
        detail!.vocabulary.some((known) => known.id === item.id),
      ),
    ).toBe(true);
    expect(getJlptCumulativeLesson('N4', [first!.id])).toBeNull();
  });

  it('creates vocabulary pairs and sentence puzzles', () => {
    const detail = getJlptLesson(listJlptLessons('N5')[0]!.id)!;
    const deck = createJlptMemoryDeck(detail.vocabulary, 4, () => 0.3);
    expect(deck).toHaveLength(8);
    expect(new Set(deck.map((card) => card.matchId)).size).toBe(4);
    expect(deck.filter((card) => card.side === 'reading')).toHaveLength(4);
    expect(deck.filter((card) => card.side === 'word')).toHaveLength(4);
    const grammar = detail.grammar[0];
    if (grammar) {
      const puzzle = createSentenceOrderPuzzle(grammar, () => 0.3);
      expect(puzzle.options).toHaveLength(puzzle.answer.length);
      expect(`${puzzle.answer.join('')}${puzzle.punctuation}`).toBe(
        grammar.tokens.map((token) => token.surface).join(''),
      );
      expect(puzzle.options).not.toContain('。');
    }
  });

  it('pairs readings with words and removes ambiguous duplicate readings', () => {
    const template = getJlptLesson(listJlptLessons('N5')[0]!.id)!
      .vocabulary[0]!;
    const vocabulary = [
      {
        ...template,
        id: 'verb-a',
        japanese: '上げる',
        reading: 'あげる',
        meaningZh: '提高；举起；给',
      },
      {
        ...template,
        id: 'verb-b',
        japanese: '高める',
        reading: 'たかめる',
        meaningZh: '提高；增强',
      },
      {
        ...template,
        id: 'verb-c',
        japanese: '下げる',
        reading: 'あげる',
        meaningZh: '降低；放下',
      },
    ];
    const deck = createJlptMemoryDeck(vocabulary, 6, () => 0.3);
    expect(new Set(deck.map((card) => card.matchId)).size).toBe(2);
    expect(deck).toHaveLength(4);
    expect(
      deck
        .filter((card) => card.side === 'reading')
        .every((card) => /^[\u3040-\u309fー]+$/u.test(card.primaryText)),
    ).toBe(true);
    expect(
      deck
        .filter((card) => card.side === 'word')
        .every((card) => card.secondaryText.length > 0),
    ).toBe(true);
    expect(createJlptReadingMatchItems(vocabulary, () => 0.3)).toHaveLength(2);
    expect(toHiragana('コーヒー')).toBe('こーひー');
    expect(normalizeJlptMeaning('提高；举起；给')).toBe('提高');
    expect(splitJlptMeaning('提高；举起；给')).toEqual({
      primaryText: '提高',
      secondaryText: '举起 / 给',
    });
  });

  it('merges inflections, fixes punctuation and creates both sentence tests', () => {
    const baseGrammar = getJlptLesson(listJlptLessons('N5')[0]!.id)!
      .grammar[0]!;
    const grammar = {
      ...baseGrammar,
      exampleJapanese: '毎朝7時に食べます。',
      exampleMeaningZh: '我每天早上七点吃饭。',
      tokens: [
        { surface: '毎朝', reading: 'まいあさ', meaningZh: '每天早上' },
        {
          surface: '7',
          reading: null,
          meaningZh: '句中的助词、活用或语法成分',
        },
        { surface: '時', reading: 'じ', meaningZh: '点；时' },
        { surface: 'に', reading: null, meaningZh: '助词：表示时间' },
        { surface: '食', reading: 'た', meaningZh: '吃' },
        {
          surface: 'べ',
          reading: null,
          meaningZh: '句中的助词、活用或语法成分',
        },
        { surface: 'ます', reading: null, meaningZh: '动词的礼貌表达形式' },
        { surface: '。', reading: null, meaningZh: '标点符号' },
      ],
    };
    const chunks = createSentenceChunks(grammar);
    expect(chunks.chunks).toEqual(['毎朝', '7時に', '食べます']);
    expect(chunks.punctuationSlots).toEqual(['', '', '', '。']);

    const completion = createSentenceCompletionPuzzle(
      grammar,
      ['飲みます', '起きます', '学校へ'],
      () => 0.3,
    );
    expect(completion.answer).toHaveLength(1);
    expect(completion.options.length).toBeGreaterThan(completion.answer.length);
    expect(completion.options).not.toContain('。');

    const order = createSentenceOrderPuzzle(grammar, () => 0.3);
    expect(order.answer).toContain('食べます');
    expect(order.answer).not.toContain('食');
    expect(order.answer).not.toContain('べ');
    expect(order.answer).not.toContain('ます');
    expect(order.options).not.toContain('。');
  });

  it('contains expandable examples without translation corruption', () => {
    const grammar = jlptCourse.grammar;
    expect(grammar.every((item) => item.examples.length >= 1)).toBe(true);
    expect(
      grammar.every(
        (item) =>
          !/\+{4,}|\uFFFD/u.test(
            `${item.formationZh}${item.meaningZh}${item.explanationZh}`,
          ),
      ),
    ).toBe(true);
  });
});
