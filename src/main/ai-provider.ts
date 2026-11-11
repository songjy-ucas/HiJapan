import { z } from 'zod';
import type {
  ConversationFeedback,
  ConversationStart,
} from '../shared/contracts';

type ProviderConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

type ProviderMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const feedbackSchema = z.object({
  taskCompleted: z.boolean(),
  summaryZh: z.string(),
  strengths: z.array(z.string()).max(3),
  corrections: z
    .array(
      z.object({
        original: z.string(),
        suggested: z.string(),
        explanationZh: z.string(),
      }),
    )
    .max(3),
  reviewCandidates: z
    .array(z.object({ japanese: z.string(), meaningZh: z.string() }))
    .max(5),
});

const sceneLabels = {
  hotel: '酒店住宿',
  restaurant: '餐厅点餐',
  shopping: '购物付款',
  sightseeing: '景点预约',
} as const;

const conversationPromptVersion = 'conversation-v2-bilingual';

function chatEndpoint(baseUrl: string) {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (normalized.endsWith('/chat/completions')) return normalized;
  return `${normalized}/chat/completions`;
}

export function validateBaseUrl(value: string) {
  const url = new URL(value);
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) {
    throw new Error('AI_BASE_URL_MUST_USE_HTTPS');
  }
  if (url.username || url.password)
    throw new Error('AI_BASE_URL_HAS_CREDENTIALS');
  return value.trim().replace(/\/+$/, '');
}

export async function requestChat(
  config: ProviderConfig,
  messages: ProviderMessage[],
  maxTokens = 600,
) {
  const response = await fetch(chatEndpoint(config.baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.4,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(35_000),
  });

  if (!response.ok) {
    const category =
      response.status === 401 || response.status === 403
        ? 'AI_AUTH_FAILED'
        : 'AI_REQUEST_FAILED';
    throw new Error(`${category}:${response.status}`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('AI_EMPTY_RESPONSE');
  return text;
}

export async function testAiConnection(config: ProviderConfig) {
  const reply = await requestChat(config, [
    {
      role: 'system',
      content: 'You are a connection test. Reply with exactly OK.',
    },
    { role: 'user', content: 'test' },
  ]);
  return reply.length > 0;
}

export async function createConversationReply(
  config: ProviderConfig,
  conversation: ConversationStart,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
) {
  const style =
    conversation.correctionStyle === 'gentle'
      ? '对话中不要主动纠错，只在无法理解时给最小提示。'
      : conversation.correctionStyle === 'strict'
        ? '保持角色，但遇到会造成误解的错误时简短纠正。'
        : '保持角色，严重影响理解时才简短纠正。';
  const system = `你正在进行日语学习角色扮演。场景：${sceneLabels[conversation.scene]}。学习者等级：${conversation.difficulty}。
你扮演场景中的日本工作人员，使用自然、简短、符合等级的日语，每次最多两句日语。
每一句日语后都必须紧跟全角括号中的简体中文翻译，不得省略中文。严格使用“日语句子（中文翻译）”格式，不要添加“日语：”“中文：”标签、罗马音、Markdown 或格式说明。
示例：いらっしゃいませ。（欢迎光临。）何名様ですか。（请问几位？）
不要替学习者完成任务，不要声称分析了没有提供的发音。${style}
Prompt 版本：${conversationPromptVersion}`;
  return requestChat(config, [{ role: 'system', content: system }, ...history]);
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced?.[1]?.trim() ?? text.trim();
}

export async function createConversationFeedback(
  config: ProviderConfig,
  conversation: ConversationStart,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<ConversationFeedback> {
  const prompt = `请复盘下面的日语学习对话。场景：${sceneLabels[conversation.scene]}，等级：${conversation.difficulty}。
只返回 JSON，不要 Markdown。结构必须是：
{"taskCompleted":boolean,"summaryZh":string,"strengths":string[],"corrections":[{"original":string,"suggested":string,"explanationZh":string}],"reviewCandidates":[{"japanese":string,"meaningZh":string}]}
最多 3 个优点、3 个纠错、5 个复习表达。没有证据时不要评价发音。`;
  const text = await requestChat(config, [
    { role: 'system', content: prompt },
    ...history,
    { role: 'user', content: '现在结束角色扮演，请输出复盘 JSON。' },
  ]);
  return feedbackSchema.parse(JSON.parse(extractJson(text)));
}
