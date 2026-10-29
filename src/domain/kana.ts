import rawKanaCourse from '../../source/data/kana_course.json';

export type KanaEntry = {
  hiragana: string;
  katakana: string;
  romaji: string;
  example_word_id: string;
};

export type KanaWord = {
  id: string;
  japanese: string;
  reading: string;
  meaning_zh: string;
};

export type KanaLesson = {
  id: string;
  title: string;
  rows: Array<{ name: string; entries: KanaEntry[] }>;
  words: KanaWord[];
};

export type KanaCourse = {
  version: string;
  review_status: string;
  lessons: KanaLesson[];
};

export type KanaForm = 'hiragana' | 'katakana' | 'romaji';

export type MemoryCard = {
  id: string;
  matchId: string;
  form: KanaForm;
  value: string;
  back: 'torii' | 'sakura';
};

export const kanaCourse = rawKanaCourse as KanaCourse;

export function getKanaLesson(lessonId: string) {
  return kanaCourse.lessons.find((lesson) => lesson.id === lessonId) ?? null;
}

export function getLessonEntries(lessonIndex: number, cumulative = false) {
  const lessons = cumulative
    ? kanaCourse.lessons.slice(0, lessonIndex + 1)
    : kanaCourse.lessons.slice(lessonIndex, lessonIndex + 1);
  return lessons.flatMap((lesson) => lesson.rows.flatMap((row) => row.entries));
}

export function hasPriorKanaLessons(lessonIndex: number) {
  return lessonIndex > 0 && lessonIndex < kanaCourse.lessons.length;
}

export function getExampleWord(entry: KanaEntry) {
  return (
    kanaCourse.lessons
      .flatMap((lesson) => lesson.words)
      .find((word) => word.id === entry.example_word_id) ?? null
  );
}

export function kanaSelectionMatches(entries: KanaEntry[]) {
  if (entries.length !== 3) return false;
  const [first, ...rest] = entries;
  return Boolean(
    first &&
    rest.every(
      (entry) =>
        entry.hiragana === first.hiragana &&
        entry.katakana === first.katakana &&
        entry.romaji === first.romaji,
    ),
  );
}

function shuffle<T>(items: T[], random: () => number) {
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

export function shuffledKanaEntries(
  entries: KanaEntry[],
  random: () => number = Math.random,
) {
  return shuffle(entries, random);
}

export function createMemoryDeck(
  entries: KanaEntry[],
  pairLimit = 8,
  random: () => number = Math.random,
): MemoryCard[] {
  const forms: KanaForm[] = ['hiragana', 'katakana', 'romaji'];
  const selected = shuffle(entries, random).slice(
    0,
    Math.min(pairLimit, entries.length),
  );
  const cards = selected.flatMap((entry, index) => {
    const pairForms = shuffle(forms, random).slice(0, 2);
    return pairForms.map((form, formIndex) => ({
      id: `${entry.romaji}-${index}-${form}`,
      matchId: entry.romaji,
      form,
      value: entry[form],
      back: (index + formIndex) % 2 === 0 ? 'torii' : 'sakura',
    })) satisfies MemoryCard[];
  });
  return shuffle(cards, random);
}

export function validateKanaCourse(course: KanaCourse = kanaCourse) {
  const errors: string[] = [];
  const learned = new Set<string>();
  const wordIds = new Set<string>();

  course.lessons.forEach((lesson, lessonIndex) => {
    if (lesson.rows.length !== 2)
      errors.push(`${lesson.id}: 每节必须包含两行假名`);
    for (const row of lesson.rows) {
      for (const entry of row.entries) learned.add(entry.hiragana);
    }
    for (const word of lesson.words) {
      if (wordIds.has(word.id)) errors.push(`${word.id}: 单词 ID 重复`);
      wordIds.add(word.id);
      for (const character of word.reading) {
        if (!learned.has(character)) {
          errors.push(
            `${lesson.id}/${word.id}: “${character}”尚未在第 ${lessonIndex + 1} 节前学过`,
          );
        }
      }
    }
  });

  const allWords = new Set(
    course.lessons.flatMap((lesson) => lesson.words.map((word) => word.id)),
  );
  for (const lesson of course.lessons) {
    for (const row of lesson.rows) {
      for (const entry of row.entries) {
        if (!allWords.has(entry.example_word_id))
          errors.push(`${entry.romaji}: 示例单词不存在`);
      }
    }
  }
  return errors;
}
