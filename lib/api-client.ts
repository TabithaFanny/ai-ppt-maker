/**
 * 统一 API 客户端
 * 
 * 模型分层策略：
 * - MiniMax M2.7 → 快速轻量任务（拆分、合并、简单提取）
 * - DeepSeek v4-pro → 深度推理任务（风格分析、内容规划、Prompt 构建）
 * - GPT-Image-2 → 所有图像生成
 */

// ====== MiniMax ======

const MINIMAX_KEY = process.env.MINIMAX_API_KEY || '';
const MINIMAX_BASE_URL = process.env.MINIMAX_BASE_URL || 'https://api.minimax.chat/v1';
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';

// ====== DeepSeek ======

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro';

// ====== 共享工具函数 ======

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  operation = 'API call'
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      const isLast = i === maxRetries - 1;
      const status = err?.status ?? 0;
      const retryable = status === 429 || status >= 500;
      console.error(`[API] ${operation} failed (${i + 1}/${maxRetries}):`, err?.message);
      if (isLast || !retryable) {
        throw new Error(`${operation} failed: ${err?.message || 'Unknown'}`);
      }
      await sleep(Math.min(1000 * Math.pow(2, i), 10000));
    }
  }
  throw new Error(`${operation} failed`);
}

// ====== MiniMax 调用（快速轻量） ======

function assertMinimaxKey() {
  if (!MINIMAX_KEY) throw new Error('MINIMAX_API_KEY 未配置');
}

export async function minimaxChat(
  messages: ChatMessage[],
  options?: { maxTokens?: number; model?: string }
): Promise<string> {
  assertMinimaxKey();
  const res = await fetch(`${MINIMAX_BASE_URL}/text/chatcompletion_v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MINIMAX_KEY}` },
    body: JSON.stringify({
      model: options?.model || MINIMAX_MODEL,
      max_tokens: options?.maxTokens || 4096,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`MiniMax error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function chatCompletion(prompt: string): Promise<string> {
  return minimaxChat([{ role: 'user', content: prompt }]);
}

export async function visionCompletion(prompt: string, imageBase64: string): Promise<string> {
  return minimaxChat([{
    role: 'user',
    content: [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: imageBase64 } },
    ],
  }]);
}

// ====== DeepSeek 调用（深度推理） ======

function assertDeepSeekKey() {
  if (!DEEPSEEK_KEY) throw new Error('DEEPSEEK_API_KEY 未配置');
}

export async function deepseekChat(
  messages: ChatMessage[],
  options?: { maxTokens?: number; model?: string; reasoning?: boolean }
): Promise<{ content: string; reasoning?: string }> {
  assertDeepSeekKey();
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
  if (!res.ok) throw new Error(`DeepSeek error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  return {
    content: msg?.content || '',
    reasoning: msg?.reasoning_content || undefined,
  };
}

// ====== 模型路由 ======

export type TaskDifficulty = 'light' | 'deep';

/**
 * 智能路由：轻量任务 → MiniMax，深度任务 → DeepSeek
 */
export async function routeChat(
  messages: ChatMessage[],
  difficulty: TaskDifficulty = 'light',
  options?: { maxTokens?: number }
): Promise<string> {
  if (difficulty === 'deep') {
    const result = await deepseekChat(messages, options);
    return result.content;
  }
  return minimaxChat(messages, options);
}
