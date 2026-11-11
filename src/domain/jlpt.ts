import rawJlptCourse from '../../source/data/jlpt_runtime.json';
import type {
  JlptGrammarItem,
  JlptLessonDetail,
  JlptLessonSummary,
  JlptLevel,
  JlptVocabularyItem,
} from '../shared/contracts';

type RawLesson = {
  id: string;
  level: JlptLevel;
  lessonNumber: number;
  title: string;
  description: string;
  minutes: number;
  vocabularyIds: string[];
  grammarIds: string[];
};

type JlptCourse = {
  version: string;
  reviewStatus: string;
  translationStatus: string;
  levels: JlptLevel[];
  vocabulary: JlptVocabularyItem[];
  grammar: JlptGrammarItem[];
  lessons: RawLesson[];
};

export type JlptMemoryCard = {
  id: string;
  matchId: string;
  value: string;
  primaryText: string;
  secondaryText: string;
  side: 'reading' | 'word';
  back: 'torii' | 'sakura';
};

export type JlptSentenceChunks = {
  chunks: string[];
  punctuation: string;
  punctuationSlots: string[];
};

export type JlptSentenceOrderPuzzle = JlptSentenceChunks & {
  kind: 'order';
  answer: string[];
  options: string[];
};

export type JlptSentenceCompletionPuzzle = JlptSentenceChunks & {
  kind: 'completion';
  blankIndexes: number[];
  answer: string[];
  options: string[];
};

export type JlptSentencePuzzle =
  | JlptSentenceOrderPuzzle
  | JlptSentenceCompletionPuzzle;

export function splitJlptMeaning(meaning: string) {
  const parts = meaning
    .split(/[；;、/]/u)
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    primaryText: parts[0] ?? meaning,
    secondaryText: parts.slice(1).join(' / '),
  };
}

export function normalizeJlptMeaning(meaning: string) {
  return splitJlptMeaning(meaning)
    .primaryText.replace(/[（）()\s]/gu, '')
    .toLocaleLowerCase('zh-CN');
}

export function toHiragana(reading: string) {
  return reading.replace(/[ァ-ヶ]/gu, (character) =>
    String.fromCodePoint((character.codePointAt(0) as number) - 0x60),
  );
}

export const jlptCourse = rawJlptCourse as JlptCourse;
const vocabularyById = new Map(
  jlptCourse.vocabulary.map((item) => [item.id, item]),
);
const grammarById = new Map(jlptCourse.grammar.map((item) => [item.id, item]));

function shuffle<T>(items: T[], random: () => number = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [
      result[swapIndex] as T,
      result[index] as T,
    ];
  }
  return result;
}

export function getJlptLesson(
  lessonId: string,
  completedLessonIds: string[] = [],
  scores: Record<string, number> = {},
): JlptLessonDetail | null {
  const lesson = jlptCourse.lessons.find((item) => item.id === lessonId);
  if (!lesson) return null;
  return {
    id: lesson.id,
    level: lesson.level,
    lessonNumber: lesson.lessonNumber,
    title: lesson.title,
    description: lesson.description,
    minutes: lesson.minutes,
    vocabularyCount: lesson.vocabularyIds.length,
    grammarCount: lesson.grammarIds.length,
    status: completedLessonIds.includes(lesson.id)
      ? 'completed'
      : 'not_started',
    lessonScore: scores[lesson.id] ?? null,
    vocabulary: lesson.vocabularyIds
      .map((id) => vocabularyById.get(id))
      .filter((item): item is JlptVocabularyItem => Boolean(item)),
    grammar: lesson.grammarIds
      .map((id) => grammarById.get(id))
      .filter((item): item is JlptGrammarItem => Boolean(item)),
  };
}

export function listJlptLessons(
  level: JlptLevel,
  completedLessonIds: string[] = [],
  scores: Record<string, number> = {},
): JlptLessonSummary[] {
  return jlptCourse.lessons
    .filter((lesson) => lesson.level === level)
    .map((lesson) => getJlptLesson(lesson.id, completedLessonIds, scores))
    .filter((lesson): lesson is JlptLessonDetail => Boolean(lesson))
    .map(
      ({ vocabulary: _vocabulary, grammar: _grammar, ...summary }) => summary,
    );
}

export function getJlptCumulativeLesson(
  level: JlptLevel,
  completedLessonIds: string[],
  random: () => number = Math.random,
): JlptLessonDetail | null {
  const completed = jlptCourse.lessons.filter(
    (lesson) =>
      lesson.level === level && completedLessonIds.includes(lesson.id),
  );
  if (completed.length === 0) return null;
  const vocabularyIds = shuffle(
    completed.flatMap((lesson) => lesson.vocabularyIds),
    random,
  ).slice(0, 10);
  const grammarIds = shuffle(
    completed.flatMap((lesson) => lesson.grammarIds),
    random,
  ).slice(0, 2);
  return {
    id: `jlpt-${level.toLowerCase()}-cumulative`,
    level,
    lessonNumber: 0,
    title: `${level} 综合复习`,
    description: '仅从你已经完成的课程中随机抽题。',
    minutes: 8,
    vocabularyCount: vocabularyIds.length,
    grammarCount: grammarIds.length,
    status: 'not_started',
    lessonScore: null,
    vocabulary: vocabularyIds
      .map((id) => vocabularyById.get(id))
      .filter((item): item is JlptVocabularyItem => Boolean(item)),
    grammar: grammarIds
      .map((id) => grammarById.get(id))
      .filter((item): item is JlptGrammarItem => Boolean(item)),
  };
}

export function createJlptMemoryDeck(
  vocabulary: JlptVocabularyItem[],
  pairLimit = 6,
  random: () => number = Math.random,
): JlptMemoryCard[] {
  const uniqueReadings = new Set<string>();
  const selected = shuffle(vocabulary, random).filter((item) => {
    const key = toHiragana(item.reading.trim());
    if (!key || uniqueReadings.has(key)) return false;
    uniqueReadings.add(key);
    return true;
  });
  return selected
    .slice(0, pairLimit)
    .flatMap((item, index) => [
      {
        id: `${item.id}-reading`,
        matchId: item.id,
        value: toHiragana(item.reading),
        primaryText: toHiragana(item.reading),
        secondaryText: '',
        side: 'reading' as const,
        back: index % 2 === 0 ? ('torii' as const) : ('sakura' as const),
      },
      {
        id: `${item.id}-word`,
        matchId: item.id,
        value: item.japanese,
        primaryText: item.japanese,
        secondaryText: [
          splitJlptMeaning(item.meaningZh).primaryText,
          splitJlptMeaning(item.meaningZh).secondaryText,
        ]
          .filter(Boolean)
          .join(' / '),
        side: 'word' as const,
        back: index % 2 === 0 ? ('sakura' as const) : ('torii' as const),
      },
    ])
    .sort(() => random() - 0.5);
}

export function createJlptReadingMatchItems(
  vocabulary: JlptVocabularyItem[],
  random: () => number = Math.random,
) {
  const readings = new Set<string>();
  return shuffle(vocabulary, random).filter((item) => {
    const reading = toHiragana(item.reading.trim());
    if (!reading || readings.has(reading)) return false;
    readings.add(reading);
    return true;
  });
}

const punctuationPattern = /^[、。！？「」『』（）,.!?]$/u;
const supportMeaningPattern =
  /助词|语法成分|礼貌判断表达|动词的礼貌表达|标点符号/u;
const counterPattern = /^[年月日時分秒人本枚冊台個回階歳円点番度匹杯着台週]+$/u;

export function createSentenceChunks(
  grammar: JlptGrammarItem,
): JlptSentenceChunks {
  const chunks: string[] = [];
  const punctuationSlots: string[] = [];
  let current = '';
  let punctuation = '';
  const commit = () => {
    if (current) chunks.push(current);
    current = '';
  };
  for (const token of grammar.tokens) {
    const surface = token.surface.trim();
    if (!surface) continue;
    if (punctuationPattern.test(surface)) {
      commit();
      punctuation += surface;
      punctuationSlots[chunks.length] =
        `${punctuationSlots[chunks.length] ?? ''}${surface}`;
      continue;
    }
    const startsLexicalChunk =
      token.reading !== null ||
      /^\d+$/u.test(surface) ||
      !supportMeaningPattern.test(token.meaningZh);
    const appendCounter =
      /^\d+$/u.test(current) && counterPattern.test(surface);
    if (startsLexicalChunk && current && !appendCounter) commit();
    current += surface;
  }
  commit();
  return {
    chunks,
    punctuation,
    punctuationSlots: Array.from(
      { length: chunks.length + 1 },
      (_, index) => punctuationSlots[index] ?? '',
    ),
  };
}

export function createSentenceOrderPuzzle(
  grammar: JlptGrammarItem,
  random: () => number = Math.random,
): JlptSentenceOrderPuzzle {
  const { chunks, punctuation, punctuationSlots } =
    createSentenceChunks(grammar);
  return {
    kind: 'order',
    chunks,
    punctuation,
    punctuationSlots,
    answer: chunks,
    options: shuffle(chunks, random),
  };
}

export function createSentenceCompletionPuzzle(
  grammar: JlptGrammarItem,
  distractorPool: string[] = [],
  random: () => number = Math.random,
): JlptSentenceCompletionPuzzle {
  const { chunks, punctuation, punctuationSlots } =
    createSentenceChunks(grammar);
  const blankCount = chunks.length >= 4 ? 2 : 1;
  const blankIndexes = shuffle(
    chunks.map((_, index) => index),
    random,
  )
    .slice(0, Math.min(blankCount, chunks.length))
    .sort((left, right) => left - right);
  const answer = blankIndexes.map((index) => chunks[index] as string);
  const fallbackDistractors = [
    'です',
    'ます',
    'でした',
    'ません',
    'を',
    'に',
    'で',
    'と',
  ];
  const distractors = shuffle(
    [...distractorPool, ...fallbackDistractors].filter(
      (item, index, items) =>
        item && !answer.includes(item) && items.indexOf(item) === index,
    ),
    random,
  ).slice(0, 3);
  return {
    kind: 'completion',
    chunks,
    punctuation,
    punctuationSlots,
    blankIndexes,
    answer,
    options: shuffle([...answer, ...distractors], random),
  };
}

export function validateJlptCourse(course: JlptCourse = jlptCourse) {
  const errors: string[] = [];
  const lessonIds = new Set<string>();
  for (const lesson of course.lessons) {
    if (lessonIds.has(lesson.id)) errors.push(`${lesson.id}: 课程 ID 重复`);
    lessonIds.add(lesson.id);
    if (lesson.minutes < 5 || lesson.minutes > 10)
      errors.push(`${lesson.id}: 学习时长必须为 5–10 分钟`);
    if (lesson.vocabularyIds.length > 10)
      errors.push(`${lesson.id}: 新单词不能超过 10 个`);
    if (lesson.grammarIds.length > 2)
      errors.push(`${lesson.id}: 语法点不能超过 2 个`);
    for (const id of lesson.vocabularyIds)
      if (!vocabularyById.has(id))
        errors.push(`${lesson.id}: 不存在单词 ${id}`);
    for (const id of lesson.grammarIds)
      if (!grammarById.has(id)) errors.push(`${lesson.id}: 不存在语法 ${id}`);
  }
  return errors;
}
