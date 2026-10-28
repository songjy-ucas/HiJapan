import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const path = resolve('source/data/travel_priority_content.json');
const data = JSON.parse(await readFile(path, 'utf8'));
const errors = [];
const expected = {
  vocabulary: 438,
  phrases: 231,
  grammar: 30,
  dialogues: 72,
  lessons: 20,
};

for (const [key, count] of Object.entries(expected)) {
  if (!Array.isArray(data[key])) errors.push(`${key} 不是数组`);
  else if (data[key].length !== count)
    errors.push(`${key} 计数应为 ${count}，实际 ${data[key].length}`);
}

const collections = [
  'vocabulary',
  'phrases',
  'grammar',
  'dialogues',
  'lessons',
];
const ids = new Set();
for (const collection of collections) {
  for (const item of data[collection] ?? []) {
    if (!item.id) errors.push(`${collection} 存在缺少 id 的条目`);
    if (ids.has(item.id)) errors.push(`重复 id：${item.id}`);
    ids.add(item.id);
  }
}

const contentIds = new Set([
  ...data.vocabulary.map((item) => item.id),
  ...data.phrases.map((item) => item.id),
]);
for (const lesson of data.lessons) {
  const references = `${lesson.vocab_ids},${lesson.phrase_ids}`
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  for (const id of references) {
    if (!contentIds.has(id))
      errors.push(`课程 ${lesson.lesson_id} 引用了不存在的内容 ${id}`);
  }
}

const dialogueKeys = new Set();
for (const line of data.dialogues) {
  const key = `${line.dialogue_id}:${line.line_no}`;
  if (dialogueKeys.has(key)) errors.push(`对话行号重复：${key}`);
  dialogueKeys.add(key);
}

if (process.argv.includes('--release')) {
  const drafts = collections.flatMap((collection) =>
    (data[collection] ?? []).filter((item) =>
      String(item.review_status).includes('draft'),
    ),
  );
  if (drafts.length > 0)
    errors.push(`正式发布被阻止：仍有 ${drafts.length} 条草稿内容`);
}

if (errors.length > 0) {
  console.error(errors.map((message) => `- ${message}`).join('\n'));
  process.exit(1);
}

console.log(
  `内容校验通过：${expected.vocabulary} 词汇、${expected.phrases} 语句、${expected.grammar} 语法、${expected.dialogues} 对话行、${expected.lessons} 课程。`,
);
