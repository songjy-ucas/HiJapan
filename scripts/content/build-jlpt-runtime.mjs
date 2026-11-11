import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..', '..');
const sourceRoot = path.join(projectRoot, 'source', 'jlpt', 'data');
const translationPath = path.join(
  projectRoot,
  'source',
  'data',
  'jlpt_machine_zh.json',
);
const outputPath = path.join(
  projectRoot,
  'source',
  'data',
  'jlpt_runtime.json',
);
const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];

const readJsonLines = (file) =>
  fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

const translations = JSON.parse(fs.readFileSync(translationPath, 'utf8'));
const lessons = [];
const vocabulary = [];
const grammar = [];

const particleMeanings = new Map([
  ['は', '主题助词：提示谈话主题'],
  ['が', '主格助词：标记主语或强调对象'],
  ['を', '宾格助词：标记动作直接作用的对象'],
  ['に', '助词：可表示时间、目的地、存在地点或动作对象'],
  ['へ', '助词：表示移动方向'],
  ['で', '助词：可表示动作场所、手段、工具或原因'],
  ['と', '助词：可表示并列、共同动作或引用'],
  ['も', '助词：表示“也／同样”'],
  ['の', '助词：表示所属、修饰或名词化'],
  ['から', '助词：表示起点或原因'],
  ['まで', '助词：表示终点或范围'],
  ['より', '助词：表示比较基准'],
  ['です', '礼貌判断表达，相当于“是／为”'],
  ['ます', '动词的礼貌表达形式'],
]);

const cleanChinese = (value, fallback) => {
  const cleaned = String(value ?? '')
    .replace(/\+{4,}/gu, '')
    .replace(/\s{2,}/gu, ' ')
    .trim();
  return cleaned.length >= 2 ? cleaned : fallback;
};

const parseFurigana = (furigana, meaningByWord) => {
  const tokens = [];
  const pattern = /\{([^|}]+)\|([^}]+)\}|([^{}]+)/gu;
  for (const match of furigana.matchAll(pattern)) {
    const surface = match[1] ?? match[3] ?? '';
    if (!surface) continue;
    const reading = match[2] ?? null;
    const pieces = reading
      ? [surface]
      : surface
          .split(
            /(です|ます|から|まで|より|[、。！？「」『』（）\s]|は|が|を|に|で|と|も|へ|の)/u,
          )
          .filter((item) => item && !/^\s+$/u.test(item));
    for (const piece of pieces) {
      const meaning = meaningByWord.get(piece) ?? particleMeanings.get(piece);
      tokens.push({
        surface: piece,
        reading: reading && pieces.length === 1 ? reading : null,
        meaningZh:
          meaning ??
          (/^[、。！？「」『』（）]$/u.test(piece)
            ? '标点符号'
            : '句中的助词、活用或语法成分'),
      });
    }
  }
  return tokens;
};

for (const level of levels) {
  const levelVocabulary = readJsonLines(
    path.join(sourceRoot, `vocabulary-${level}.jsonl`),
  );
  const levelGrammar = readJsonLines(
    path.join(sourceRoot, `grammar-${level}.jsonl`),
  );
  const levelSentences = readJsonLines(
    path.join(sourceRoot, `sentences-${level}.jsonl`),
  );
  const sentencesById = new Map(levelSentences.map((item) => [item.id, item]));
  const meaningByWord = new Map();
  for (const item of levelVocabulary) {
    meaningByWord.set(item.word, item.meanings_zh.join('；'));
    vocabulary.push({
      id: item.id,
      level,
      japanese: item.word,
      reading: item.reading,
      romaji: item.romaji,
      meaningZh:
        item.meanings_zh.join('；') || item.meanings_en_reference.join('; '),
      meaningStatus: item.meaning_zh_status,
      partOfSpeech: item.part_of_speech_labels_en,
      reviewStatus: item.review_status,
    });
  }

  const levelLessons = [];
  for (let offset = 0; offset < levelVocabulary.length; offset += 10) {
    const lessonNumber = levelLessons.length + 1;
    const lessonVocabulary = levelVocabulary.slice(offset, offset + 10);
    levelLessons.push({
      id: `jlpt-${level.toLowerCase()}-${String(lessonNumber).padStart(3, '0')}`,
      level,
      lessonNumber,
      title: `${level} 第 ${lessonNumber} 节`,
      description: `学习 ${lessonVocabulary.length} 个新词，并结合例句掌握语法。`,
      minutes: lessonVocabulary.length < 6 ? 5 : 8,
      vocabularyIds: lessonVocabulary.map((item) => item.id),
      grammarIds: [],
    });
  }

  levelGrammar.forEach((item, index) => {
    const translated = translations.items[item.id] ?? {};
    const translatedExamples = new Map(
      (translated.examples ?? []).map((example) => [
        example.id,
        example.translation_zh,
      ]),
    );
    const examples = item.example_ids
      .map((id) => sentencesById.get(id))
      .filter(Boolean)
      .map((example) => ({
        id: example.id,
        japanese: example.japanese,
        reading: example.furigana ?? example.japanese,
        meaningZh: cleanChinese(
          example.translation_zh ?? translatedExamples.get(example.id),
          example.translation_en_reference ?? '中文释义待校对',
        ),
        tokens: parseFurigana(
          example.furigana ?? example.japanese,
          meaningByWord,
        ),
      }));
    const example = examples[0] ?? null;
    const grammarItem = {
      id: item.id,
      level,
      pattern: item.pattern,
      reading: item.reading,
      formationZh: cleanChinese(
        translated.formation_zh,
        item.formation_reference_en,
      ),
      meaningZh: cleanChinese(translated.meaning_zh, item.meaning_reference_en),
      explanationZh: cleanChinese(
        translated.explanation_zh,
        '请结合例句理解该语法的功能和接续方式。',
      ),
      exampleJapanese: example?.japanese ?? item.pattern,
      exampleReading: example?.reading ?? example?.japanese ?? item.pattern,
      exampleMeaningZh: example?.meaningZh ?? '',
      tokens: example?.tokens ?? parseFurigana(item.pattern, meaningByWord),
      examples,
      reviewStatus: 'draft_needs_native_review',
      translationStatus: translations.status,
    };
    grammar.push(grammarItem);
    let lessonIndex = Math.min(Math.floor(index / 2), levelLessons.length - 1);
    while (
      lessonIndex < levelLessons.length - 1 &&
      levelLessons[lessonIndex].grammarIds.length >= 2
    ) {
      lessonIndex += 1;
    }
    levelLessons[lessonIndex].grammarIds.push(item.id);
  });
  lessons.push(...levelLessons);
}

const output = {
  version: '0.1.6',
  reviewStatus: 'draft_needs_native_review',
  translationStatus: translations.status,
  levels,
  vocabulary,
  grammar,
  lessons,
};
fs.writeFileSync(outputPath, `${JSON.stringify(output)}\n`, 'utf8');
console.log(
  `JLPT runtime: ${vocabulary.length} vocabulary, ${grammar.length} grammar, ${lessons.length} lessons`,
);
