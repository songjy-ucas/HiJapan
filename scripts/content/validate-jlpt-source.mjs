import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(process.argv[2] ?? '.');
const root = path.join(projectRoot, 'source', 'jlpt');
const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
const expected = {
  N5: { vocabulary: 674, kanji: 84, grammar: 81, lessons: 57 },
  N4: { vocabulary: 630, kanji: 169, grammar: 98, lessons: 53 },
  N3: { vocabulary: 1659, kanji: 387, grammar: 101, lessons: 139 },
  N2: { vocabulary: 1778, kanji: 398, grammar: 123, lessons: 149 },
  N1: { vocabulary: 3070, kanji: 1345, grammar: 123, lessons: 269 },
};
const errors = [];
const allIds = new Set();

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readJsonl(file) {
  return fs
    .readFileSync(file, 'utf8')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${file}:${index + 1}: ${error.message}`);
      }
    });
}

function checkRows(rows, kind, level) {
  if (rows.length !== expected[level][kind])
    errors.push(
      `${level} ${kind}: expected ${expected[level][kind]}, got ${rows.length}`,
    );
  for (const row of rows) {
    if (!row.id) errors.push(`${level} ${kind}: missing id`);
    if (allIds.has(row.id)) errors.push(`duplicate id: ${row.id}`);
    allIds.add(row.id);
    if (row.level !== level)
      errors.push(`${row.id}: level ${row.level} != ${level}`);
    if (row.review_status !== 'draft_needs_native_review')
      errors.push(`${row.id}: invalid review status`);
    if (row.provenance?.license !== 'CC-BY-SA-4.0')
      errors.push(`${row.id}: missing CC-BY-SA provenance`);
  }
}

const manifest = readJson(path.join(root, 'manifest.json'));
for (const level of levels) {
  const vocabulary = readJsonl(
    path.join(root, 'data', `vocabulary-${level}.jsonl`),
  );
  const kanji = readJsonl(path.join(root, 'data', `kanji-${level}.jsonl`));
  const grammar = readJsonl(path.join(root, 'data', `grammar-${level}.jsonl`));
  const sentences = readJsonl(
    path.join(root, 'data', `sentences-${level}.jsonl`),
  );
  const lessons = readJson(path.join(root, 'data', `lessons-${level}.json`));
  checkRows(vocabulary, 'vocabulary', level);
  checkRows(kanji, 'kanji', level);
  checkRows(grammar, 'grammar', level);
  for (const row of sentences) {
    if (allIds.has(row.id)) errors.push(`duplicate id: ${row.id}`);
    allIds.add(row.id);
    if (row.review_status !== 'draft_needs_native_review')
      errors.push(`${row.id}: invalid review status`);
  }
  if (lessons.length !== expected[level].lessons)
    errors.push(
      `${level}: expected ${expected[level].lessons} lessons, got ${lessons.length}`,
    );
  const available = new Set(
    [...vocabulary, ...kanji, ...grammar, ...sentences].map((item) => item.id),
  );
  const referenced = [];
  for (const lesson of lessons) {
    if (lesson.review_status !== 'draft_needs_native_review')
      errors.push(`${lesson.id}: invalid review status`);
    for (const ids of Object.values(lesson.content_ids))
      referenced.push(...ids);
    if (lesson.content_ids.vocabulary.length > 12)
      errors.push(`${lesson.id}: more than 12 vocabulary items`);
    if (lesson.content_ids.kanji.length > 5)
      errors.push(`${lesson.id}: more than 5 kanji items`);
    if (lesson.content_ids.grammar.length > 2)
      errors.push(`${lesson.id}: more than 2 grammar items`);
    if (lesson.content_ids.target_sentences.length > 6)
      errors.push(`${lesson.id}: more than 6 target sentences`);
  }
  for (const id of referenced)
    if (!available.has(id))
      errors.push(`${level}: missing referenced content ${id}`);
  if (new Set(referenced).size !== available.size)
    errors.push(
      `${level}: course allocation does not cover every content item exactly once`,
    );
  const counts = manifest.levels[level]?.counts;
  if (
    !counts ||
    counts.vocabulary !== vocabulary.length ||
    counts.kanji !== kanji.length ||
    counts.grammar !== grammar.length ||
    counts.sentences !== sentences.length ||
    counts.lessons !== lessons.length
  )
    errors.push(`${level}: manifest counts are stale`);
}

if (
  manifest.totals.vocabulary !== 7811 ||
  manifest.totals.kanji !== 2383 ||
  manifest.totals.grammar !== 526 ||
  manifest.totals.lessons !== 667
)
  errors.push(`unexpected totals: ${JSON.stringify(manifest.totals)}`);
const requiredDocs = [
  'README.md',
  'SOURCES_AND_LICENSES.md',
  'exam_blueprint.json',
  'curriculum_plan.json',
  'quality_report.json',
  'third_party/OpenJLPT-LICENSE-CC-BY-SA-4.0.txt',
  'third_party/OpenJLPT-NOTICE.md',
];
for (const file of requiredDocs)
  if (!fs.existsSync(path.join(root, file)))
    errors.push(`missing required file: ${file}`);

if (errors.length) {
  console.error(
    `JLPT source validation failed (${errors.length}):\n${errors
      .slice(0, 50)
      .map((item) => `- ${item}`)
      .join('\n')}`,
  );
  process.exit(1);
}
console.log(
  `JLPT source validation passed: ${allIds.size} content records, 667 lessons, all entries remain draft.`,
);
