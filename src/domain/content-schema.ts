import { z } from 'zod';

const sceneSchema = z.enum(['hotel', 'restaurant', 'shopping', 'sightseeing']);
const contentSceneSchema = z.enum([
  'hotel',
  'restaurant',
  'shopping',
  'sightseeing',
  'common',
]);

export const vocabularySchema = z.object({
  id: z.string().min(1),
  scene: sceneSchema,
  category: z.string(),
  japanese: z.string().min(1),
  kana: z.string().min(1),
  meaning_zh: z.string().min(1),
  usage_note: z.string(),
  level: z.string().min(1),
  priority: z.string().min(1),
  review_status: z.string().min(1),
});

export const phraseSchema = z.object({
  id: z.string().min(1),
  scene: sceneSchema,
  situation: z.string(),
  japanese: z.string().min(1),
  kana: z.string().min(1),
  meaning_zh: z.string().min(1),
  slot_hint: z.string(),
  level: z.string().min(1),
  priority: z.string().min(1),
  review_status: z.string().min(1),
});

export const grammarSchema = z.object({
  id: z.string().min(1),
  target_scene: contentSceneSchema,
  grammar_id: z.string().min(1),
  pattern: z.string().min(1),
  function_zh: z.string().min(1),
  example_jp: z.string().min(1),
  example_zh: z.string().min(1),
  level: z.string().min(1),
  priority: z.string().min(1),
  review_status: z.string().min(1),
});

export const dialogueSchema = z.object({
  id: z.string().min(1),
  dialogue_id: z.string().min(1),
  target_scene: sceneSchema,
  title: z.string().min(1),
  line_no: z.string().min(1),
  role: z.enum(['user', 'staff']),
  japanese: z.string().min(1),
  kana: z.string().min(1),
  meaning_zh: z.string().min(1),
  review_status: z.string().min(1),
});

export const lessonSchema = z.object({
  id: z.string().min(1),
  target_scene: sceneSchema,
  lesson_id: z.string().min(1),
  title: z.string().min(1),
  objectives: z.string().min(1),
  vocab_ids: z.string(),
  phrase_ids: z.string(),
  minutes: z.string().regex(/^\d+$/),
  level: z.string().min(1),
  priority: z.string().min(1),
  review_status: z.string().min(1),
});

export const contentPackSchema = z.object({
  version: z.string().min(1),
  status: z.string().min(1),
  generated_at: z.string().min(1),
  vocabulary: z.array(vocabularySchema),
  phrases: z.array(phraseSchema),
  grammar: z.array(grammarSchema),
  dialogues: z.array(dialogueSchema),
  lessons: z.array(lessonSchema),
});

export type ContentPack = z.infer<typeof contentPackSchema>;
