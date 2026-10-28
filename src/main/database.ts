import { app } from 'electron';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import rawContentPack from '../../source/data/travel_priority_content.json';
import { contentPackSchema, type ContentPack } from '../domain/content-schema';
import { buildTodayPlan } from '../domain/planning';
import { scheduleReview, type ReviewState } from '../domain/review';
import type {
  AppSnapshot,
  DialogueGroup,
  LessonDetail,
  LessonSummary,
  ProfileInput,
  ReviewCard,
  ReviewGrade,
  Scene,
  TodayTask,
} from '../shared/contracts';

type SqlRow = Record<string, unknown>;
type SqlValue = string | number | bigint | Uint8Array | null;

const toSqlValue = (value: unknown): SqlValue => {
  if (value === null || value === undefined) return null;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint'
  ) {
    return value;
  }
  if (value instanceof Uint8Array) return value;
  throw new Error('BACKUP_INVALID_VALUE');
};

const splitIds = (value: string) =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

export class HiJapanDatabase {
  private readonly db: DatabaseSync;
  private readonly content: ContentPack;

  constructor(
    databasePath = path.join(app.getPath('userData'), 'hijapan.sqlite'),
  ) {
    this.content = contentPackSchema.parse(rawContentPack);
    this.db = new DatabaseSync(databasePath, { timeout: 5_000 });
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.migrate();
    this.importContent();
  }

  close() {
    this.db.close();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS content_items (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        scene TEXT NOT NULL,
        level TEXT NOT NULL,
        review_status TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lessons (
        lesson_id TEXT PRIMARY KEY,
        scene TEXT NOT NULL,
        title TEXT NOT NULL,
        objectives TEXT NOT NULL,
        minutes INTEGER NOT NULL,
        level TEXT NOT NULL,
        review_status TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lesson_items (
        lesson_id TEXT NOT NULL,
        content_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (lesson_id, content_id),
        FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id),
        FOREIGN KEY (content_id) REFERENCES content_items(id)
      );

      CREATE TABLE IF NOT EXISTS lesson_progress (
        lesson_id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        score REAL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS learning_events (
        id TEXT PRIMARY KEY,
        content_id TEXT NOT NULL,
        lesson_id TEXT,
        event_type TEXT NOT NULL,
        grade TEXT,
        occurred_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS review_states (
        content_id TEXT PRIMARY KEY,
        mastery_score REAL NOT NULL,
        interval_days REAL NOT NULL,
        ease_factor REAL NOT NULL,
        lapse_count INTEGER NOT NULL,
        last_review_at TEXT,
        next_review_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ai_provider_settings (
        id TEXT PRIMARY KEY,
        base_url TEXT NOT NULL,
        model TEXT NOT NULL,
        key_hint TEXT NOT NULL,
        last_tested_at TEXT,
        enabled INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS conversation_sessions (
        id TEXT PRIMARY KEY,
        scene TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        correction_style TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        ended_at TEXT
      );

      CREATE TABLE IF NOT EXISTS conversation_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES conversation_sessions(id) ON DELETE CASCADE
      );
    `);
  }

  private importContent() {
    const insertItem = this.db.prepare(`
      INSERT INTO content_items (id, type, scene, level, review_status, payload_json)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        scene = excluded.scene,
        level = excluded.level,
        review_status = excluded.review_status,
        payload_json = excluded.payload_json
    `);

    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const item of this.content.vocabulary) {
        insertItem.run(
          item.id,
          'vocabulary',
          item.scene,
          item.level,
          item.review_status,
          JSON.stringify(item),
        );
      }
      for (const item of this.content.phrases) {
        insertItem.run(
          item.id,
          'phrase',
          item.scene,
          item.level,
          item.review_status,
          JSON.stringify(item),
        );
      }
      for (const item of this.content.grammar) {
        insertItem.run(
          item.id,
          'grammar',
          item.target_scene,
          item.level,
          item.review_status,
          JSON.stringify(item),
        );
      }
      for (const item of this.content.dialogues) {
        insertItem.run(
          item.id,
          'dialogue',
          item.target_scene,
          'starter',
          item.review_status,
          JSON.stringify(item),
        );
      }

      const insertLesson = this.db.prepare(`
        INSERT INTO lessons (lesson_id, scene, title, objectives, minutes, level, review_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(lesson_id) DO UPDATE SET
          scene = excluded.scene,
          title = excluded.title,
          objectives = excluded.objectives,
          minutes = excluded.minutes,
          level = excluded.level,
          review_status = excluded.review_status
      `);
      const deleteLessonItems = this.db.prepare(
        'DELETE FROM lesson_items WHERE lesson_id = ?',
      );
      const insertLessonItem = this.db.prepare(
        'INSERT INTO lesson_items (lesson_id, content_id, position) VALUES (?, ?, ?)',
      );

      for (const lesson of this.content.lessons) {
        insertLesson.run(
          lesson.lesson_id,
          lesson.target_scene,
          lesson.title,
          lesson.objectives,
          Number(lesson.minutes),
          lesson.level,
          lesson.review_status,
        );
        deleteLessonItems.run(lesson.lesson_id);
        const ids = [
          ...splitIds(lesson.vocab_ids),
          ...splitIds(lesson.phrase_ids),
        ];
        ids.forEach((id, index) =>
          insertLessonItem.run(lesson.lesson_id, id, index),
        );
      }

      this.setMeta('content_version', this.content.version);
      this.setMeta('content_status', this.content.status);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  private setMeta(key: string, value: string) {
    this.db
      .prepare(
        'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .run(key, value);
  }

  private getMeta(key: string) {
    const row = this.db
      .prepare('SELECT value FROM app_meta WHERE key = ?')
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  getProfile(): ProfileInput | null {
    const row = this.db
      .prepare("SELECT payload_json FROM profiles WHERE id = 'local'")
      .get() as { payload_json: string } | undefined;
    return row ? (JSON.parse(row.payload_json) as ProfileInput) : null;
  }

  saveProfile(profile: ProfileInput) {
    const now = new Date().toISOString();
    this.db
      .prepare(`
        INSERT INTO profiles (id, payload_json, created_at, updated_at)
        VALUES ('local', ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at
      `)
      .run(JSON.stringify(profile), now, now);
    return this.getSnapshot();
  }

  getSnapshot(): AppSnapshot {
    const profile = this.getProfile();
    const completedLessons = Number(
      (
        this.db
          .prepare(
            "SELECT COUNT(*) AS count FROM lesson_progress WHERE status = 'completed'",
          )
          .get() as { count: number }
      ).count,
    );
    const totalLessons = Number(
      (
        this.db.prepare('SELECT COUNT(*) AS count FROM lessons').get() as {
          count: number;
        }
      ).count,
    );
    const dueReviews = Number(
      (
        this.db
          .prepare(
            'SELECT COUNT(*) AS count FROM review_states WHERE next_review_at <= ?',
          )
          .get(new Date().toISOString()) as { count: number }
      ).count,
    );
    const learnedItems = Number(
      (
        this.db
          .prepare(
            'SELECT COUNT(DISTINCT content_id) AS count FROM learning_events',
          )
          .get() as { count: number }
      ).count,
    );

    return {
      isOnboarded: profile !== null,
      profile,
      stats: { completedLessons, totalLessons, dueReviews, learnedItems },
      content: {
        version: this.getMeta('content_version') ?? this.content.version,
        reviewStatus: this.getMeta('content_status') ?? this.content.status,
        counts: {
          vocabulary: this.content.vocabulary.length,
          phrases: this.content.phrases.length,
          grammar: this.content.grammar.length,
          dialogues: this.content.dialogues.length,
          lessons: this.content.lessons.length,
        },
      },
    };
  }

  listLessons(scene?: Scene): LessonSummary[] {
    const rows = (
      scene
        ? this.db
            .prepare(`
            SELECT l.*, COALESCE(p.status, 'not_started') AS progress_status,
                   (SELECT COUNT(*) FROM lesson_items li WHERE li.lesson_id = l.lesson_id) AS item_count
            FROM lessons l LEFT JOIN lesson_progress p ON p.lesson_id = l.lesson_id
            WHERE l.scene = ? ORDER BY l.lesson_id
          `)
            .all(scene)
        : this.db
            .prepare(`
            SELECT l.*, COALESCE(p.status, 'not_started') AS progress_status,
                   (SELECT COUNT(*) FROM lesson_items li WHERE li.lesson_id = l.lesson_id) AS item_count
            FROM lessons l LEFT JOIN lesson_progress p ON p.lesson_id = l.lesson_id
            ORDER BY CASE l.scene WHEN 'hotel' THEN 1 WHEN 'restaurant' THEN 2 WHEN 'shopping' THEN 3 ELSE 4 END,
                     l.lesson_id
          `)
            .all()
    ) as SqlRow[];

    return rows.map((row) => ({
      lessonId: String(row.lesson_id),
      scene: String(row.scene) as Scene,
      title: String(row.title),
      objectives: String(row.objectives),
      minutes: Number(row.minutes),
      level: String(row.level),
      itemCount: Number(row.item_count),
      status: String(row.progress_status) as LessonSummary['status'],
      reviewStatus: String(row.review_status),
    }));
  }

  getLesson(lessonId: string): LessonDetail {
    const summary = this.listLessons().find(
      (lesson) => lesson.lessonId === lessonId,
    );
    if (!summary) throw new Error('CONTENT_NOT_FOUND');
    const rows = this.db
      .prepare(`
        SELECT ci.type, ci.payload_json
        FROM lesson_items li JOIN content_items ci ON ci.id = li.content_id
        WHERE li.lesson_id = ? ORDER BY li.position
      `)
      .all(lessonId) as Array<{ type: string; payload_json: string }>;
    const grammarRows = this.db
      .prepare(
        "SELECT payload_json FROM content_items WHERE type = 'grammar' AND (scene = ? OR scene = 'common') ORDER BY CASE WHEN scene = ? THEN 0 ELSE 1 END, id LIMIT 2",
      )
      .all(summary.scene, summary.scene) as Array<{ payload_json: string }>;

    return {
      ...summary,
      vocabulary: rows
        .filter((row) => row.type === 'vocabulary')
        .map((row) => JSON.parse(row.payload_json)),
      phrases: rows
        .filter((row) => row.type === 'phrase')
        .map((row) => JSON.parse(row.payload_json)),
      grammar: grammarRows.map((row) => JSON.parse(row.payload_json)),
    } as LessonDetail;
  }

  completeLesson(lessonId: string, difficultItemIds: string[]) {
    const lesson = this.getLesson(lessonId);
    const allIds = [
      ...lesson.vocabulary.map((item) => item.id),
      ...lesson.phrases.map((item) => item.id),
    ];
    const now = new Date();
    const getReview = this.db.prepare(
      'SELECT * FROM review_states WHERE content_id = ?',
    );
    const saveReview = this.db.prepare(`
      INSERT INTO review_states
        (content_id, mastery_score, interval_days, ease_factor, lapse_count, last_review_at, next_review_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(content_id) DO UPDATE SET
        mastery_score = excluded.mastery_score,
        interval_days = excluded.interval_days,
        ease_factor = excluded.ease_factor,
        lapse_count = excluded.lapse_count,
        last_review_at = excluded.last_review_at,
        next_review_at = excluded.next_review_at
    `);
    const addEvent = this.db.prepare(`
      INSERT INTO learning_events (id, content_id, lesson_id, event_type, grade, occurred_at)
      VALUES (?, ?, ?, 'lesson_completed', ?, ?)
    `);

    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const contentId of allIds) {
        const row = getReview.get(contentId) as SqlRow | undefined;
        const previous = row
          ? ({
              masteryScore: Number(row.mastery_score),
              intervalDays: Number(row.interval_days),
              easeFactor: Number(row.ease_factor),
              lapseCount: Number(row.lapse_count),
              lastReviewAt: row.last_review_at
                ? String(row.last_review_at)
                : null,
              nextReviewAt: String(row.next_review_at),
            } satisfies ReviewState)
          : null;
        const grade: ReviewGrade = difficultItemIds.includes(contentId)
          ? 'again'
          : 'good';
        const next = scheduleReview(previous, grade, now);
        saveReview.run(
          contentId,
          next.masteryScore,
          next.intervalDays,
          next.easeFactor,
          next.lapseCount,
          next.lastReviewAt,
          next.nextReviewAt,
        );
        addEvent.run(
          randomUUID(),
          contentId,
          lessonId,
          grade,
          now.toISOString(),
        );
      }
      this.db
        .prepare(`
          INSERT INTO lesson_progress (lesson_id, status, score, updated_at)
          VALUES (?, 'completed', ?, ?)
          ON CONFLICT(lesson_id) DO UPDATE SET status = 'completed', score = excluded.score, updated_at = excluded.updated_at
        `)
        .run(
          lessonId,
          allIds.length === 0
            ? 100
            : ((allIds.length - difficultItemIds.length) / allIds.length) * 100,
          now.toISOString(),
        );
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return this.getSnapshot();
  }

  getDueReviews(limit = 30): ReviewCard[] {
    const rows = this.db
      .prepare(`
        SELECT rs.*, ci.type, ci.payload_json
        FROM review_states rs JOIN content_items ci ON ci.id = rs.content_id
        WHERE rs.next_review_at <= ?
        ORDER BY rs.next_review_at LIMIT ?
      `)
      .all(new Date().toISOString(), limit) as SqlRow[];
    return rows.map((row) => this.toReviewCard(row));
  }

  gradeReview(contentId: string, grade: ReviewGrade) {
    const row = this.db
      .prepare('SELECT * FROM review_states WHERE content_id = ?')
      .get(contentId) as SqlRow | undefined;
    if (!row) throw new Error('CONTENT_NOT_FOUND');
    const previous: ReviewState = {
      masteryScore: Number(row.mastery_score),
      intervalDays: Number(row.interval_days),
      easeFactor: Number(row.ease_factor),
      lapseCount: Number(row.lapse_count),
      lastReviewAt: row.last_review_at ? String(row.last_review_at) : null,
      nextReviewAt: String(row.next_review_at),
    };
    const next = scheduleReview(previous, grade, new Date());
    this.db
      .prepare(`
        UPDATE review_states SET mastery_score = ?, interval_days = ?, ease_factor = ?, lapse_count = ?,
          last_review_at = ?, next_review_at = ? WHERE content_id = ?
      `)
      .run(
        next.masteryScore,
        next.intervalDays,
        next.easeFactor,
        next.lapseCount,
        next.lastReviewAt,
        next.nextReviewAt,
        contentId,
      );
    this.db
      .prepare(`
        INSERT INTO learning_events (id, content_id, lesson_id, event_type, grade, occurred_at)
        VALUES (?, ?, NULL, 'review', ?, ?)
      `)
      .run(randomUUID(), contentId, grade, next.lastReviewAt);
    return this.getDueReviews();
  }

  private toReviewCard(row: SqlRow): ReviewCard {
    const payload = JSON.parse(String(row.payload_json)) as Record<
      string,
      unknown
    >;
    return {
      contentId: String(row.content_id),
      kind: String(row.type) as ReviewCard['kind'],
      japanese: String(payload.japanese ?? payload.pattern ?? ''),
      kana: String(payload.kana ?? ''),
      meaningZh: String(payload.meaning_zh ?? payload.function_zh ?? ''),
      masteryScore: Number(row.mastery_score),
      dueAt: String(row.next_review_at),
    };
  }

  getTodayPlan(): TodayTask[] {
    const profile = this.getProfile();
    const lessons = this.listLessons();
    return buildTodayPlan({
      dailyMinutes: profile?.dailyMinutes ?? 10,
      dueReviewCount: this.getSnapshot().stats.dueReviews,
      lessons,
    });
  }

  listDialogues(scene?: Scene): DialogueGroup[] {
    const lines = this.content.dialogues.filter(
      (line) => !scene || line.target_scene === scene,
    );
    const groups = new Map<string, DialogueGroup>();
    for (const line of lines) {
      const current = groups.get(line.dialogue_id) ?? {
        dialogueId: line.dialogue_id,
        scene: line.target_scene,
        title: line.title,
        lines: [],
      };
      current.lines.push(line);
      groups.set(line.dialogue_id, current);
    }
    return [...groups.values()].map((group) => ({
      ...group,
      lines: group.lines.sort((a, b) => Number(a.line_no) - Number(b.line_no)),
    }));
  }

  getAiSettingsRow() {
    return this.db
      .prepare("SELECT * FROM ai_provider_settings WHERE id = 'default'")
      .get() as
      | {
          base_url: string;
          model: string;
          key_hint: string;
          last_tested_at: string | null;
          enabled: number;
        }
      | undefined;
  }

  saveAiSettings(baseUrl: string, model: string, keyHint: string) {
    const testedAt = new Date().toISOString();
    this.db
      .prepare(`
        INSERT INTO ai_provider_settings (id, base_url, model, key_hint, last_tested_at, enabled)
        VALUES ('default', ?, ?, ?, ?, 1)
        ON CONFLICT(id) DO UPDATE SET base_url = excluded.base_url, model = excluded.model,
          key_hint = excluded.key_hint, last_tested_at = excluded.last_tested_at, enabled = 1
      `)
      .run(baseUrl, model, keyHint, testedAt);
  }

  deleteAiSettings() {
    this.db
      .prepare("DELETE FROM ai_provider_settings WHERE id = 'default'")
      .run();
  }

  createConversation(
    scene: Scene,
    difficulty: string,
    correctionStyle: string,
  ) {
    const id = randomUUID();
    this.db
      .prepare(`
        INSERT INTO conversation_sessions (id, scene, difficulty, correction_style, status, created_at)
        VALUES (?, ?, ?, ?, 'active', ?)
      `)
      .run(id, scene, difficulty, correctionStyle, new Date().toISOString());
    return id;
  }

  addMessage(sessionId: string, role: 'user' | 'assistant', content: string) {
    const message = {
      id: randomUUID(),
      role,
      content,
      createdAt: new Date().toISOString(),
    } as const;
    this.db
      .prepare(`
        INSERT INTO conversation_messages (id, session_id, role, content, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(message.id, sessionId, role, content, message.createdAt);
    return message;
  }

  getConversation(sessionId: string) {
    const session = this.db
      .prepare('SELECT * FROM conversation_sessions WHERE id = ?')
      .get(sessionId) as SqlRow | undefined;
    if (!session) throw new Error('CONVERSATION_NOT_FOUND');
    const messages = this.db
      .prepare(
        'SELECT role, content FROM conversation_messages WHERE session_id = ? ORDER BY created_at',
      )
      .all(sessionId) as Array<{ role: 'user' | 'assistant'; content: string }>;
    return { session, messages };
  }

  endConversation(sessionId: string) {
    this.db
      .prepare(
        "UPDATE conversation_sessions SET status = 'completed', ended_at = ? WHERE id = ?",
      )
      .run(new Date().toISOString(), sessionId);
  }

  exportData() {
    const tableNames = [
      'profiles',
      'lesson_progress',
      'learning_events',
      'review_states',
      'ai_provider_settings',
      'conversation_sessions',
      'conversation_messages',
    ];
    const data: Record<string, unknown[]> = {};
    for (const table of tableNames) {
      data[table] = this.db
        .prepare(`SELECT * FROM ${table}`)
        .all() as unknown[];
    }
    if (data.ai_provider_settings) {
      data.ai_provider_settings = data.ai_provider_settings.map((row) => ({
        ...(row as Record<string, unknown>),
        key_hint: '',
        enabled: 0,
      }));
    }
    return {
      backup_schema_version: 1,
      app_version: app.getVersion(),
      exported_at: new Date().toISOString(),
      content_version: this.content.version,
      data,
    };
  }

  importData(input: unknown) {
    if (!input || typeof input !== 'object') throw new Error('BACKUP_INVALID');
    const backup = input as {
      backup_schema_version?: number;
      data?: Record<string, unknown[]>;
    };
    if (backup.backup_schema_version !== 1 || !backup.data) {
      throw new Error('BACKUP_VERSION_UNSUPPORTED');
    }

    const tableColumns: Record<string, string[]> = {
      profiles: ['id', 'payload_json', 'created_at', 'updated_at'],
      lesson_progress: ['lesson_id', 'status', 'score', 'updated_at'],
      learning_events: [
        'id',
        'content_id',
        'lesson_id',
        'event_type',
        'grade',
        'occurred_at',
      ],
      review_states: [
        'content_id',
        'mastery_score',
        'interval_days',
        'ease_factor',
        'lapse_count',
        'last_review_at',
        'next_review_at',
      ],
      conversation_sessions: [
        'id',
        'scene',
        'difficulty',
        'correction_style',
        'status',
        'created_at',
        'ended_at',
      ],
      conversation_messages: [
        'id',
        'session_id',
        'role',
        'content',
        'created_at',
      ],
    };

    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const table of Object.keys(tableColumns).reverse()) {
        this.db.exec(`DELETE FROM ${table}`);
      }
      for (const [table, columns] of Object.entries(tableColumns)) {
        const rows = backup.data[table] ?? [];
        const placeholders = columns.map(() => '?').join(', ');
        const statement = this.db.prepare(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
        );
        for (const rawRow of rows) {
          if (!rawRow || typeof rawRow !== 'object')
            throw new Error('BACKUP_INVALID_ROW');
          const row = rawRow as Record<string, unknown>;
          statement.run(...columns.map((column) => toSqlValue(row[column])));
        }
      }
      this.db.exec('DELETE FROM ai_provider_settings');
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  resetAllData() {
    this.db.exec(`
      BEGIN IMMEDIATE;
      DELETE FROM conversation_messages;
      DELETE FROM conversation_sessions;
      DELETE FROM ai_provider_settings;
      DELETE FROM review_states;
      DELETE FROM learning_events;
      DELETE FROM lesson_progress;
      DELETE FROM profiles;
      COMMIT;
    `);
  }
}
