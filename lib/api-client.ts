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
 *
 * API Key 安全：
 * - 客户端 localStorage 使用 AES-256-GCM 加密存储
 * - 服务端仅使用私有环境变量（禁止 NEXT_PUBLIC_* 用于实际密钥值）
 */

import {
  getEncryptedApiKeys,
  setEncryptedApiKeys,
  migratePlaintextKeys,
  isEncrypted,
} from './crypto-keys';

// ====== 环境变量 ======

// Server-side API keys — NEVER use NEXT_PUBLIC_* for actual key values (they're inlined in client bundles)
const MINIMAX_KEY = process.env.MINIMAX_API_KEY || '';
const MINIMAX_BASE_URL = process.env.MINIMAX_BASE_URL || 'https://api.minimax.chat/v1';
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';
const MINIMAX_VL_MODEL = process.env.MINIMAX_VL_MODEL || 'MiniMax-VL-01';
const MINIMAX_VL_URL = `${MINIMAX_BASE_URL}/vl/chat/completions`;

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro';

const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const BLT_KEY = process.env.BLT_API_KEY || '';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const BLT_BASE_URL = process.env.BLT_API_BASE_URL || process.env.BLT_BASE_URL || 'https://api.bltcy.ai/v1';
const OPENAI_COMPAT_FALLBACK_BASE_URL = 'https://main-new.codesuc.top/v1';
const OPENAI_VISION_MODEL = 'gpt-4o';
const DEFAULT_VISION_REQUEST_TIMEOUT_MS = 180_000;

const AI_MOCK = process.env.AI_MOCK === 'true';

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
 * 优先级: localStorage 运行时设置 > 环境变量 AI_MOCK
 */
export function isMockMode(): boolean {
  // Client-side: 检查 localStorage 中的运行时模式
  if (typeof window !== 'undefined') {
    try {
      const mode = localStorage.getItem('ai-ppt-mode');
      if (mode === 'mock') return true;
      if (mode === 'real') return false;
      if (mode === 'auto') {
        const keys = getStoredApiKeys();
        const hasAnyKey = !!(keys.minimax || keys.deepseek || keys.openai);
        return !hasAnyKey; // auto: 无 key 时 mock，有 key 时 real
      }
    } catch {}
  }
  // Server-side 或 fallback: 使用环境变量
  return AI_MOCK;
}

/**
 * 获取当前 AI 模式
 */
export function getAiMode(): 'mock' | 'real' | 'auto' {
  if (typeof window !== 'undefined') {
    try {
      const mode = localStorage.getItem('ai-ppt-mode') as 'mock' | 'real' | 'auto' | null;
      if (mode && ['mock', 'real', 'auto'].includes(mode)) return mode;
    } catch {}
  }
  return AI_MOCK ? 'mock' : 'real';
}

/**
 * 保存 AI 模式到 localStorage
 */
export function setAiMode(mode: 'mock' | 'real' | 'auto'): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('ai-ppt-mode', mode);
}

// In-memory cache of decrypted keys (populated on init)
let keyCache: { minimax: string; deepseek: string; openai: string } | null = null;

/**
 * 初始化加密 key 存储：迁移明文 → 加密，解密到内存缓存
 * 应在应用启动时尽早调用（如 settings page 加载时或 layout 中）
 */
export async function initEncryptedKeys(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('ai-ppt-keys');
    if (raw && !isEncrypted(raw)) {
      await migratePlaintextKeys();
    }
    keyCache = await getEncryptedApiKeys();
  } catch {
    // fall back to plaintext on error
    try {
      const raw = localStorage.getItem('ai-ppt-keys');
      if (raw && !isEncrypted(raw)) {
        keyCache = JSON.parse(raw);
      }
    } catch {
      keyCache = { minimax: '', deepseek: '', openai: '' };
    }
  }
}

/**
 * 获取 API Keys（同步，从内存缓存读取；缓存未初始化时回退到明文）
 */
export function getStoredApiKeys(): { minimax: string; deepseek: string; openai: string } {
  if (typeof window === 'undefined') return { minimax: '', deepseek: '', openai: '' };
  if (keyCache) return keyCache;
  // 回退：尝试解密（同步不可能），改为尝试读明文
  try {
    const raw = localStorage.getItem('ai-ppt-keys');
    if (!raw) return { minimax: '', deepseek: '', openai: '' };
    if (isEncrypted(raw)) {
      // 加密但尚未初始化 — 返回空，下次 init 后会填充缓存
      return { minimax: '', deepseek: '', openai: '' };
    }
    return JSON.parse(raw);
  } catch {
    return { minimax: '', deepseek: '', openai: '' };
  }
}

/**
 * 保存 API Keys 到 localStorage（异步加密存储，同步更新内存缓存）
 */
export function setStoredApiKeys(keys: { minimax?: string; deepseek?: string; openai?: string }): void {
  if (typeof window === 'undefined') return;
  const current = getStoredApiKeys();
  const merged = { ...current, ...keys };
  // 同步更新内存缓存
  keyCache = merged;
  // 异步加密写入 localStorage
  setEncryptedApiKeys(merged).catch(console.error);
}

// ====== 错误消息中文映射 ======

export function getErrorMessage(provider: string, status: number, raw?: string): string {
  const messages: Record<string, Record<number, string>> = {
    minimax: {
      400: '请求格式错误，请检查输入内容',
      401: 'MiniMax API Key 无效或已过期',
      403: 'MiniMax API 访问被拒绝',
      429: 'MiniMax 请求频率超限，请稍后重试',
      500: 'MiniMax 服务器内部错误',
      503: 'MiniMax 服务暂不可用',
    },
    deepseek: {
      400: '请求格式错误，请检查输入内容',
      401: 'DeepSeek API Key 无效或已过期',
      403: 'DeepSeek API 访问被拒绝',
      429: 'DeepSeek 请求频率超限，请稍后重试',
      500: 'DeepSeek 服务器内部错误',
      503: 'DeepSeek 服务暂不可用',
    },
    openai: {
      400: '请求格式错误，请检查输入内容',
      401: 'OpenAI/BLT API Key 无效或已过期',
      403: 'OpenAI/BLT API 访问被拒绝',
      429: '请求频率超限，请稍后重试',
      500: 'OpenAI 服务器内部错误',
      503: 'OpenAI 服务暂不可用',
    },
  };

  if (messages[provider]?.[status]) {
    return messages[provider][status];
  }

  // 网络错误
  if (!status) {
    return `网络连接失败，请检查网络设置`;
  }

  return `${provider} error ${status}${raw ? ': ' + raw.slice(0, 100) : ''}`;
}

function requireKey(key: string, name: string): void {
  if (isMockMode()) return;
  // 同时检查环境变量和 localStorage
  const storedKeys = getStoredApiKeys();
  const storedKey = storedKeys[name.toLowerCase() as keyof typeof storedKeys] || '';
  if (key || storedKey) return;
  throw new AIError({
    provider: name,
    stage: 'config',
    message: `${name}_API_KEY 未配置。请在服务端环境变量中配置对应 Key，或设置 AI_MOCK=true 使用 mock 模式`,
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
    message: getErrorMessage('minimax', res.status, await res.text()),
    fallbackUsed: null,
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function chatCompletion(prompt: string): Promise<string> {
  return minimaxChat([{ role: 'user', content: prompt }]);
}

/** MiniMax Vision API — uses MiniMax-VL-01 + /vl/chat/completions */
export async function minimaxVisionChat(
  prompt: string,
  imageBase64: string,
  options?: { maxTokens?: number; signal?: AbortSignal }
): Promise<string> {
  requireKey(MINIMAX_KEY, 'MINIMAX');
  if (AI_MOCK) return '###MOCK: vision analysis result';

  const res = await fetch(MINIMAX_VL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MINIMAX_KEY}` },
    body: JSON.stringify({
      model: MINIMAX_VL_MODEL,
      max_tokens: options?.maxTokens || 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageBase64 } },
        ],
      }],
    }),
    signal: options?.signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new AIError({
      provider: 'minimax-vision',
      stage: 'vision-chat',
      message: getErrorMessage('minimax', res.status, errText),
      fallbackUsed: null,
    });
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/** GPT-4o Vision — OpenAI-compatible, works via BLT relay or direct */
export async function openaiVisionChat(
  prompt: string,
  imageBase64: string,
  options?: { maxTokens?: number; signal?: AbortSignal; timeoutMs?: number }
): Promise<string> {
  if (AI_MOCK) return '###MOCK: openai vision response';
  const openaiCompatibleKey = BLT_KEY || OPENAI_KEY;
  if (!openaiCompatibleKey) {
    throw new AIError({
      provider: 'openai-vision',
      stage: 'config',
      message: 'OPENAI_API_KEY 或 BLT_API_KEY 未配置',
      fallbackUsed: null,
    });
  }

  // Compress image to ~200KB before sending to reduce latency
  const compressed = await compressImage(imageBase64);

  const baseUrls = Array.from(new Set([BLT_KEY ? BLT_BASE_URL : OPENAI_BASE_URL]));
  const errors: string[] = [];

  for (const baseUrl of baseUrls) {
    try {
      // Per-URL timeout for vision, combined with caller's signal
      const perUrlController = new AbortController();
      const perUrlTimeout = setTimeout(() => perUrlController.abort(), options?.timeoutMs || DEFAULT_VISION_REQUEST_TIMEOUT_MS);
      const combinedSignal = options?.signal
        ? AbortSignal.any([options.signal, perUrlController.signal])
        : perUrlController.signal;

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiCompatibleKey}`,
        },
        body: JSON.stringify({
          model: OPENAI_VISION_MODEL,
          max_tokens: options?.maxTokens || 4096,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: compressed } },
            ],
          }],
        }),
        signal: combinedSignal,
      });
      clearTimeout(perUrlTimeout);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        errors.push(`${baseUrl}: ${getErrorMessage('openai', res.status, errText)}`);
        continue;
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      const detail = fetchErr instanceof Error && 'cause' in fetchErr
        ? String((fetchErr as Error & { cause?: { code?: string; message?: string } }).cause?.code || (fetchErr as Error & { cause?: { message?: string } }).cause?.message || '')
        : '';
      // AbortError from caller's signal — no point retrying another URL
      if (options?.signal?.aborted) {
        throw fetchErr;
      }
      console.error(`[Vision] ${baseUrl} fetch error:`, detail ? `${msg} (${detail})` : msg);
      errors.push(`${baseUrl}: ${detail ? `${msg} (${detail})` : msg}`);
      continue;
    }
  }

  throw new AIError({
    provider: 'openai-vision',
    stage: 'vision-chat',
    message: errors.join('；'),
    fallbackUsed: OPENAI_COMPAT_FALLBACK_BASE_URL,
  });
}

/** Ensure image has proper data URI prefix, no heavy processing in shared module */
async function compressImage(base64: string): Promise<string> {
  // Ensure data URI prefix exists
  if (!base64.startsWith('data:')) {
    return 'data:image/png;base64,' + base64;
  }
  return base64;
}

/** @deprecated Use minimaxVisionChat for vision tasks */
export async function visionCompletion(prompt: string, imageBase64: string): Promise<string> {
  return minimaxVisionChat(prompt, imageBase64);
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
    message: getErrorMessage('deepseek', res.status, await res.text()),
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
 * DeepSeek streaming — yields delta text chunks via async generator
 */
export async function* deepseekStream(
  messages: ChatMessage[],
  options?: { maxTokens?: number; model?: string; reasoning?: boolean }
): AsyncGenerator<{ type: 'text' | 'reasoning' | 'done'; content: string }> {
  requireKey(DEEPSEEK_KEY, 'DEEPSEEK');
  if (AI_MOCK) {
    yield { type: 'text', content: '###MOCK: deepseek streaming response' };
    yield { type: 'done', content: '' };
    return;
  }

  const model = options?.model || DEEPSEEK_MODEL;
  const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_KEY}` },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options?.maxTokens || 4096,
      stream: true,
      ...(options?.reasoning !== false ? { reasoning_effort: 'high' } : {}),
    }),
  });
  if (!res.ok) throw new AIError({
    provider: 'deepseek',
    stage: 'chat-stream',
    message: getErrorMessage('deepseek', res.status, await res.text()),
    fallbackUsed: null,
  });

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body for streaming');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') {
        yield { type: 'done', content: '' };
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;
        if (delta?.reasoning_content) {
          yield { type: 'reasoning', content: delta.reasoning_content };
        }
        if (delta?.content) {
          yield { type: 'text', content: delta.content };
        }
      } catch {
        // skip malformed SSE lines
      }
    }
  }
  yield { type: 'done', content: '' };
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
