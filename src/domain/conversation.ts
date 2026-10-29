export const CONVERSATION_RETENTION_DAYS = 7;

export function conversationRetentionCutoff(
  now = new Date(),
  retentionDays = CONVERSATION_RETENTION_DAYS,
) {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    throw new Error('CONVERSATION_RETENTION_DAYS_INVALID');
  }
  return new Date(
    now.getTime() - retentionDays * 24 * 60 * 60 * 1_000,
  ).toISOString();
}

export function extractJapaneseSpeech(text: string) {
  return text
    .replace(/^\s*(?:中文|汉语|翻译|中国語)\s*[:：].*$/gim, ' ')
    .replace(/^\s*(?:日语|日本語)\s*[:：]\s*/gim, '')
    .replace(/（[^（）]*）/g, ' ')
    .replace(/\([^()]*\)/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}
