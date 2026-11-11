export type Scene = 'hotel' | 'restaurant' | 'shopping' | 'sightseeing';
export type ContentScene = Scene | 'common';
export type PrimaryMode = 'travel' | 'jlpt' | 'conversation';
export type ContentKind = 'vocabulary' | 'phrase' | 'grammar' | 'dialogue';

export type VocabularyItem = {
  id: string;
  scene: Scene;
  category: string;
  japanese: string;
  kana: string;
  meaning_zh: string;
  usage_note: string;
  level: string;
  priority: string;
  review_status: string;
};

export type PhraseItem = {
  id: string;
  scene: Scene;
  situation: string;
  japanese: string;
  kana: string;
  meaning_zh: string;
  slot_hint: string;
  level: string;
  priority: string;
  review_status: string;
};

export type GrammarItem = {
  id: string;
  target_scene: ContentScene;
  grammar_id: string;
  pattern: string;
  function_zh: string;
  example_jp: string;
  example_zh: string;
  level: string;
  priority: string;
  review_status: string;
};

export type DialogueLine = {
  id: string;
  dialogue_id: string;
  target_scene: Scene;
  title: string;
  line_no: string;
  role: 'user' | 'staff';
  japanese: string;
  kana: string;
  meaning_zh: string;
  review_status: string;
};

export type LessonSummary = {
  lessonId: string;
  scene: Scene;
  title: string;
  objectives: string;
  minutes: number;
  level: string;
  itemCount: number;
  status: 'not_started' | 'in_progress' | 'completed';
  reviewStatus: string;
};

export type LessonDetail = LessonSummary & {
  vocabulary: VocabularyItem[];
  phrases: PhraseItem[];
  grammar: GrammarItem[];
};

export type KanaProgress = {
  completedLessonIds: string[];
  gameCompletedLessonIds: string[];
};

export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export type JlptVocabularyItem = {
  id: string;
  level: JlptLevel;
  japanese: string;
  reading: string;
  romaji: string;
  meaningZh: string;
  meaningStatus: string;
  partOfSpeech: string[];
  reviewStatus: string;
};

export type JlptSentenceToken = {
  surface: string;
  reading: string | null;
  meaningZh: string;
};

export type JlptGrammarExample = {
  id: string;
  japanese: string;
  reading: string;
  meaningZh: string;
  tokens: JlptSentenceToken[];
};

export type JlptGrammarItem = {
  id: string;
  level: JlptLevel;
  pattern: string;
  reading: string | null;
  formationZh: string;
  meaningZh: string;
  explanationZh: string;
  exampleJapanese: string;
  exampleReading: string;
  exampleMeaningZh: string;
  tokens: JlptSentenceToken[];
  examples: JlptGrammarExample[];
  reviewStatus: string;
  translationStatus: string;
};

export type JlptLessonSummary = {
  id: string;
  level: JlptLevel;
  lessonNumber: number;
  title: string;
  description: string;
  minutes: number;
  vocabularyCount: number;
  grammarCount: number;
  status: 'not_started' | 'completed';
  lessonScore: number | null;
};

export type JlptLessonDetail = JlptLessonSummary & {
  vocabulary: JlptVocabularyItem[];
  grammar: JlptGrammarItem[];
};

export type JlptProgress = {
  completedLessonIds: string[];
  scores: Record<string, number>;
  gameCompletedLessonIds: string[];
};

export type JlptLessonCompletion = {
  lessonId: string;
  score: number;
  difficultItemIds: string[];
  gameCompleted?: boolean;
};

export type ProfileInput = {
  displayName: string;
  primaryMode: PrimaryMode;
  dailyMinutes: 5 | 10 | 20 | 30;
  level: 'starter' | 'N5' | 'N4_or_above';
  focusScenes: Scene[];
};

export type AppSnapshot = {
  appVersion: string;
  isOnboarded: boolean;
  profile: ProfileInput | null;
  stats: {
    completedLessons: number;
    totalLessons: number;
    dueReviews: number;
    learnedItems: number;
  };
  content: {
    version: string;
    reviewStatus: string;
    counts: Record<string, number>;
  };
};

export type TodayTask = {
  id: string;
  type: 'review' | 'lesson' | 'dialogue';
  title: string;
  detail: string;
  minutes: number;
  lessonId?: string;
};

export type ReviewCard = {
  contentId: string;
  kind: ContentKind;
  japanese: string;
  kana: string;
  meaningZh: string;
  masteryScore: number;
  dueAt: string;
};

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export type AiProviderInput = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type AiSettingsStatus = {
  configured: boolean;
  baseUrl: string;
  model: string;
  keyHint: string;
  lastTestedAt: string | null;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type ConversationStart = {
  scene: Scene;
  difficulty: 'starter' | 'N5' | 'N4';
  correctionStyle: 'gentle' | 'standard' | 'strict';
};

export type ConversationTurnInput = ConversationStart & {
  sessionId: string | null;
  message: string;
};

export type ConversationTurnOutput = {
  sessionId: string;
  reply: ChatMessage;
};

export type ConversationHistoryItem = ConversationStart & {
  id: string;
  status: 'active' | 'completed';
  createdAt: string;
  endedAt: string | null;
  lastActivityAt: string;
  messageCount: number;
  preview: string;
};

export type ConversationHistoryDetail = {
  session: ConversationHistoryItem;
  messages: ChatMessage[];
};

export type ConversationFeedback = {
  taskCompleted: boolean;
  summaryZh: string;
  strengths: string[];
  corrections: Array<{
    original: string;
    suggested: string;
    explanationZh: string;
  }>;
  reviewCandidates: Array<{
    japanese: string;
    meaningZh: string;
  }>;
};

export type DialogueGroup = {
  dialogueId: string;
  scene: Scene;
  title: string;
  lines: DialogueLine[];
};

export type BackupResult = { ok: boolean; path?: string; message: string };

export interface HiJapanApi {
  companion: import('./pet-contracts').MainCompanionApi;
  app: {
    getSnapshot(): Promise<AppSnapshot>;
    saveProfile(input: ProfileInput): Promise<AppSnapshot>;
    resetAllData(): Promise<void>;
  };
  learning: {
    getTodayPlan(): Promise<TodayTask[]>;
    listLessons(scene?: Scene): Promise<LessonSummary[]>;
    getLesson(lessonId: string): Promise<LessonDetail>;
    completeLesson(
      lessonId: string,
      difficultItemIds: string[],
    ): Promise<AppSnapshot>;
    listDialogues(scene?: Scene): Promise<DialogueGroup[]>;
    getKanaProgress(): Promise<KanaProgress>;
    completeKanaLesson(
      lessonId: string,
      gameCompleted?: boolean,
    ): Promise<KanaProgress>;
    listJlptLessons(level: JlptLevel): Promise<JlptLessonSummary[]>;
    getJlptLesson(lessonId: string): Promise<JlptLessonDetail>;
    getJlptProgress(): Promise<JlptProgress>;
    completeJlptLesson(input: JlptLessonCompletion): Promise<JlptProgress>;
    getJlptCumulativeLesson(level: JlptLevel): Promise<JlptLessonDetail | null>;
  };
  review: {
    getDue(limit?: number): Promise<ReviewCard[]>;
    grade(contentId: string, grade: ReviewGrade): Promise<ReviewCard[]>;
  };
  ai: {
    getSettings(): Promise<AiSettingsStatus>;
    saveAndTest(input: AiProviderInput): Promise<AiSettingsStatus>;
    deleteSettings(): Promise<void>;
    sendTurn(input: ConversationTurnInput): Promise<ConversationTurnOutput>;
    finishConversation(sessionId: string): Promise<ConversationFeedback>;
    listHistory(): Promise<ConversationHistoryItem[]>;
    getHistory(sessionId: string): Promise<ConversationHistoryDetail>;
    deleteHistory(sessionId: string): Promise<ConversationHistoryItem[]>;
    deleteAllHistory(): Promise<void>;
  };
  backup: {
    exportData(): Promise<BackupResult>;
    importData(): Promise<BackupResult>;
  };
}

declare global {
  interface Window {
    hiJapan: HiJapanApi;
  }
}
