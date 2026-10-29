import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import type { Scene } from '../shared/contracts';
import {
  createConversationFeedback,
  createConversationReply,
  testAiConnection,
  validateBaseUrl,
} from './ai-provider';
import { exportBackup, importBackup } from './backup';
import { deleteApiKey, loadApiKey, saveApiKey } from './credentials';
import type { HiJapanDatabase } from './database';

const sceneSchema = z.enum(['hotel', 'restaurant', 'shopping', 'sightseeing']);
const profileSchema = z.object({
  displayName: z.string().trim().max(40),
  primaryMode: z.enum(['travel', 'jlpt', 'conversation']),
  dailyMinutes: z.union([
    z.literal(5),
    z.literal(10),
    z.literal(20),
    z.literal(30),
  ]),
  level: z.enum(['starter', 'N5', 'N4_or_above']),
  focusScenes: z.array(sceneSchema).min(1),
});
const aiSettingsSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(8).max(500),
  model: z.string().trim().min(1).max(120),
});
const turnSchema = z.object({
  sessionId: z.string().uuid().nullable(),
  scene: sceneSchema,
  difficulty: z.enum(['starter', 'N5', 'N4']),
  correctionStyle: z.enum(['gentle', 'standard', 'strict']),
  message: z.string().trim().min(1).max(2_000),
});

export function registerIpcHandlers(
  database: HiJapanDatabase,
  mainWindow: BrowserWindow,
) {
  const trusted = (event: IpcMainInvokeEvent) => {
    if (event.sender !== mainWindow.webContents)
      throw new Error('UNTRUSTED_IPC_SENDER');
  };
  const handle = <TArgs extends unknown[], TResult>(
    channel: string,
    callback: (
      event: IpcMainInvokeEvent,
      ...args: TArgs
    ) => Promise<TResult> | TResult,
  ) => {
    ipcMain.handle(channel, async (event, ...args: TArgs) => {
      trusted(event);
      return callback(event, ...args);
    });
  };

  handle('app:getSnapshot', () => database.getSnapshot());
  handle('app:saveProfile', (_event, input: unknown) =>
    database.saveProfile(profileSchema.parse(input)),
  );
  handle('app:resetAllData', async () => {
    database.resetAllData();
    await deleteApiKey();
  });

  handle('learning:getTodayPlan', () => database.getTodayPlan());
  handle('learning:listLessons', (_event, scene?: Scene) => {
    const parsed = scene ? sceneSchema.parse(scene) : undefined;
    return database.listLessons(parsed);
  });
  handle('learning:getLesson', (_event, lessonId: string) =>
    database.getLesson(z.string().min(1).parse(lessonId)),
  );
  handle(
    'learning:completeLesson',
    (_event, lessonId: string, difficultIds: string[]) =>
      database.completeLesson(
        z.string().min(1).parse(lessonId),
        z.array(z.string().min(1)).parse(difficultIds),
      ),
  );
  handle('learning:listDialogues', (_event, scene?: Scene) => {
    const parsed = scene ? sceneSchema.parse(scene) : undefined;
    return database.listDialogues(parsed);
  });
  handle('learning:getKanaProgress', () => database.getKanaProgress());
  handle(
    'learning:completeKanaLesson',
    (_event, lessonId: string, gameCompleted?: boolean) =>
      database.completeKanaLesson(
        z.string().min(1).max(80).parse(lessonId),
        z.boolean().optional().parse(gameCompleted) ?? false,
      ),
  );

  handle('review:getDue', (_event, limit?: number) =>
    database.getDueReviews(
      z.number().int().min(1).max(100).optional().parse(limit),
    ),
  );
  handle('review:grade', (_event, contentId: string, grade: string) =>
    database.gradeReview(
      z.string().min(1).parse(contentId),
      z.enum(['again', 'hard', 'good', 'easy']).parse(grade),
    ),
  );

  handle('ai:getSettings', () => {
    const row = database.getAiSettingsRow();
    return {
      configured: Boolean(row?.enabled),
      baseUrl: row?.base_url ?? 'https://api.openai.com/v1',
      model: row?.model ?? '',
      keyHint: row?.key_hint ?? '',
      lastTestedAt: row?.last_tested_at ?? null,
    };
  });
  handle('ai:saveAndTest', async (_event, raw: unknown) => {
    const input = aiSettingsSchema.parse(raw);
    const baseUrl = validateBaseUrl(input.baseUrl);
    await testAiConnection({ ...input, baseUrl });
    await saveApiKey(input.apiKey);
    database.saveAiSettings(baseUrl, input.model, input.apiKey.slice(-4));
    const row = database.getAiSettingsRow();
    return {
      configured: true,
      baseUrl: row?.base_url ?? baseUrl,
      model: row?.model ?? input.model,
      keyHint: row?.key_hint ?? input.apiKey.slice(-4),
      lastTestedAt: row?.last_tested_at ?? new Date().toISOString(),
    };
  });
  handle('ai:deleteSettings', async () => {
    await deleteApiKey();
    database.deleteAiSettings();
  });
  handle('ai:listHistory', () => database.listConversationHistory());
  handle('ai:getHistory', (_event, sessionIdRaw: string) =>
    database.getConversation(z.string().uuid().parse(sessionIdRaw)),
  );
  handle('ai:deleteHistory', (_event, sessionIdRaw: string) =>
    database.deleteConversation(z.string().uuid().parse(sessionIdRaw)),
  );
  handle('ai:deleteAllHistory', () => database.deleteAllConversations());
  handle('ai:sendTurn', async (_event, raw: unknown) => {
    const input = turnSchema.parse(raw);
    const settings = database.getAiSettingsRow();
    const apiKey = await loadApiKey();
    if (!settings?.enabled || !apiKey) throw new Error('AI_NOT_CONFIGURED');

    const history = input.sessionId
      ? database.getConversation(input.sessionId).messages
      : [];
    const nextHistory = [
      ...history,
      { role: 'user' as const, content: input.message },
    ];
    const replyText = await createConversationReply(
      { baseUrl: settings.base_url, apiKey, model: settings.model },
      input,
      nextHistory,
    );
    const sessionId =
      input.sessionId ??
      database.createConversation(
        input.scene,
        input.difficulty,
        input.correctionStyle,
      );
    database.addMessage(sessionId, 'user', input.message);
    const reply = database.addMessage(sessionId, 'assistant', replyText);
    return { sessionId, reply };
  });
  handle('ai:finishConversation', async (_event, sessionIdRaw: string) => {
    const sessionId = z.string().uuid().parse(sessionIdRaw);
    const settings = database.getAiSettingsRow();
    const apiKey = await loadApiKey();
    if (!settings?.enabled || !apiKey) throw new Error('AI_NOT_CONFIGURED');
    const conversation = database.getConversation(sessionId);
    const session = conversation.session;
    const feedback = await createConversationFeedback(
      { baseUrl: settings.base_url, apiKey, model: settings.model },
      {
        scene: session.scene,
        difficulty: session.difficulty,
        correctionStyle: session.correctionStyle,
      },
      conversation.messages,
    );
    database.endConversation(sessionId);
    return feedback;
  });

  handle('backup:exportData', () => exportBackup(database));
  handle('backup:importData', async () => {
    const result = await importBackup(database);
    if (result.ok) await deleteApiKey();
    return result;
  });

  return () => {
    for (const channel of [
      'app:getSnapshot',
      'app:saveProfile',
      'app:resetAllData',
      'learning:getTodayPlan',
      'learning:listLessons',
      'learning:getLesson',
      'learning:completeLesson',
      'learning:listDialogues',
      'learning:getKanaProgress',
      'learning:completeKanaLesson',
      'review:getDue',
      'review:grade',
      'ai:getSettings',
      'ai:saveAndTest',
      'ai:deleteSettings',
      'ai:listHistory',
      'ai:getHistory',
      'ai:deleteHistory',
      'ai:deleteAllHistory',
      'ai:sendTurn',
      'ai:finishConversation',
      'backup:exportData',
      'backup:importData',
    ]) {
      ipcMain.removeHandler(channel);
    }
  };
}
