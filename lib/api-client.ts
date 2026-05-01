/**
 * 统一 API 客户端
 * 
 * 模型分层策略：
 * - MiniMax M2.7 → 快速轻量任务（拆分、合并、简单提取）
 * - DeepSeek v4-pro → 深度推理任务（风格分析、内容规划、Prompt 构建）
 * - GPT-Image-2 → 所有图像生成
 * 
 * Fallback 策略（按优先级）：
 * 1. DeepSeek retry（最多 3 次）
 * 2. MiniMax fallback（当 DeepSeek 失败时）
 * 3. AI_MOCK=true 时直接返回 mock 数据
 */

// ====== 环境变量 ======

const MINIMAX_KEY = process.env.NEXT_PUBLIC_MINIMAX_API_KEY || process.env.MINIMAX_API_KEY || '';
const MINIMAX_BASE_URL = process.env.MINIMAX_BASE_URL || 'https://api.minimax.chat/v1';
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';

const DEEPSEEK_KEY = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro';

const OPENAI_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://main-new.codesuc.top/v1';

const AI_MOCK = process.env.NEXT_PUBLIC_AI_MOCK === 'true' || process.env.AI_MOCK === 'true';

// ====== 共享工具函数 ======

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface AIErrorDetail {
  provider: string;
  stage: string;
  rawOutputPreview?: string;
  schemaError?: string;
  fallbackUsed: string | null;
  message: string;
}

export class AIError extends Error {
  public detail: AIErrorDetail;
  constructor(detail: AIErrorDetail) {
    super(detail.message);
    this.name = 'AIError';
    this.detail = detail;
  }
}

function isAIError(err: unknown): err is AIError {
  return err instanceof AIError || (typeof err === 'object' && err !== null && 'detail' in err);
}

/**
 * 带退避重试的异步调用
 * 失败后不会直接崩溃，抛出 AIError 让上层决定是否 fallback
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  operation = 'API call'
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      const err = error as { status?: number; message?: string };
      const status = err?.status ?? 0;
      const retryable = status === 429 || status >= 500 || !status;
      console.error(`[API] ${operation} failed (${i + 1}/${maxRetries}):`, err?.message);
      if (i < maxRetries - 1 && retryable) {
        await sleep(Math.min(1000 * Math.pow(2, i), 10000));
      }
    }
  }
  // 所有重试失败后抛出 AIError
  const msg = lastError instanceof Error ? lastError.message : 'Unknown error';
  throw new AIError({
    provider: 'unknown',
    stage: operation,
    message: msg,
    fallbackUsed: null,
  });
}

/**
 * 检查是否是 mock 模式
 */
export function isMockMode(): boolean {
  return AI_MOCK;
}

/**
 * 检查 API key 是否存在（mock 模式下不检查）
 */
function checkKey(key: string, name: string): boolean {
  if (AI_MOCK) return true;
  return !!key;
}

function requireKey(key: string, name: string): void {
  if (AI_MOCK) return;
  if (!key) throw new AIError({
    provider: name,
    stage: 'config',
    message: `${name}_API_KEY 未配置，设置 AI_MOCK=true 可使用 mock 模式`,
    fallbackUsed: null,
  });
}

// ====== MiniMax 调用 ======

export async function minimaxChat(
  messages: ChatMessage[],
  options?: { maxTokens?: number; model?: string }
): Promise<string> {
  requireKey(MINIMAX_KEY, 'MINIMAX');
  if (AI_MOCK) return '###MOCK: minimax response';

  const res = await fetch(`${MINIMAX_BASE_URL}/text/chatcompletion_v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MINIMAX_KEY}` },
    body: JSON.stringify({
      model: options?.model || MINIMAX_MODEL,
      max_tokens: options?.maxTokens || 4096,
      messages,
    }),
  });
  if (!res.ok) throw new AIError({
    provider: 'minimax',
    stage: 'chat',
    message: `MiniMax error ${res.status}: ${await res.text()}`,
    fallbackUsed: null,
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function chatCompletion(prompt: string): Promise<string> {
  return minimaxChat([{ role: 'user', content: prompt }]);
}

export async function visionCompletion(prompt: string, imageBase64: string): Promise<string> {
  requireKey(MINIMAX_KEY, 'MINIMAX');
  if (AI_MOCK) return '###MOCK: vision analysis result';
  return minimaxChat([{
    role: 'user',
    content: [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: imageBase64 } },
    ],
  }]);
}

// ====== DeepSeek 调用 ======

export async function deepseekChat(
  messages: ChatMessage[],
  options?: { maxTokens?: number; model?: string; reasoning?: boolean }
): Promise<{ content: string; reasoning?: string }> {
  requireKey(DEEPSEEK_KEY, 'DEEPSEEK');
  if (AI_MOCK) return { content: '###MOCK: deepseek response', reasoning: undefined };

  const model = options?.model || DEEPSEEK_MODEL;
  const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_KEY}` },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options?.maxTokens || 4096,
      ...(options?.reasoning !== false ? { reasoning_effort: 'high' } : {}),
    }),
  });
  if (!res.ok) throw new AIError({
    provider: 'deepseek',
    stage: 'chat',
    message: `DeepSeek error ${res.status}: ${await res.text()}`,
    fallbackUsed: null,
  });
  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  return {
    content: msg?.content || '',
    reasoning: msg?.reasoning_content || undefined,
  };
}

/**
 * DeepSeek + 自动 fallback 到 MiniMax
 * 在 lib/claude.ts 中使用
 */
export async function deepseekWithFallback(
  messages: ChatMessage[],
  options?: { maxTokens?: number; model?: string; reasoning?: boolean }
): Promise<{ content: string; reasoning?: string; fallbackUsed?: string }> {
  try {
    const result = await deepseekChat(messages, options);
    return { ...result, fallbackUsed: undefined };
  } catch (err) {
    console.error('[DeepSeek] call failed, falling back to MiniMax:', err);
    // Mock 模式下直接返回 mock
    if (AI_MOCK) return { content: '###MOCK: deepseek-fallback', reasoning: undefined, fallbackUsed: 'mock' };
    // Fallback 到 MiniMax
    try {
      const text = await chatCompletion('[Fallback from DeepSeek]\n' + (messages[0]?.content?.toString() || ''));
      return { content: text, reasoning: undefined, fallbackUsed: 'minimax' };
    } catch (fallbackErr) {
      throw new AIError({
        provider: 'deepseek+minimax',
        stage: 'chat',
        message: `Both DeepSeek and MiniMax failed: ${err} / ${fallbackErr}`,
        fallbackUsed: 'none',
      });
    }
  }
}

// ====== 模型路由 ======

export type TaskDifficulty = 'light' | 'deep';

export async function routeChat(
  messages: ChatMessage[],
  difficulty: TaskDifficulty = 'light',
  options?: { maxTokens?: number }
): Promise<string> {
  if (difficulty === 'deep') {
    const result = await deepseekWithFallback(messages, options);
    return result.content;
  }
  return minimaxChat(messages, options);
}
