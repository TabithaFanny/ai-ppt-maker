/**
 * 统一 API 客户端 — 消除 withRetry/sleep 重复定义
 * 所有 MiniMax API 调用应通过此模块
 */

const API_KEY = process.env.MINIMAX_API_KEY || '';
const BASE_URL = process.env.MINIMAX_BASE_URL || 'https://api.minimax.chat/v1';
const MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';

function assertApiKey(): void {
  if (!API_KEY) {
    throw new Error(
      'MINIMAX_API_KEY 未配置。请在 .env.local 中设置 MINIMAX_API_KEY=your_key'
    );
  }
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  operation = 'API call'
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string; type?: string };
      const isLastAttempt = i === maxRetries - 1;
      const status = err?.status ?? 0;
      const isRetryable = status === 429 || status >= 500;

      console.error(`[MiniMax API] ${operation} failed (attempt ${i + 1}/${maxRetries}):`, {
        status: err?.status,
        message: err?.message,
      });

      if (isLastAttempt || !isRetryable) {
        throw new Error(`${operation} failed after ${i + 1} attempts: ${err?.message || 'Unknown error'}`);
      }

      const backoff = Math.min(1000 * Math.pow(2, i), 10000);
      console.log(`[MiniMax API] Retrying in ${backoff}ms...`);
      await sleep(backoff);
    }
  }
  throw new Error(`${operation} failed after ${maxRetries} attempts`);
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

/**
 * 统一 MiniMax 聊天完成调用
 */
export async function minimaxChatCompletion(
  messages: ChatMessage[],
  options?: { maxTokens?: number; model?: string }
): Promise<string> {
  assertApiKey();
  const response = await fetch(`${BASE_URL}/text/chatcompletion_v2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: options?.model || MODEL,
      max_tokens: options?.maxTokens || 4096,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * 便捷函数：纯文本聊天
 */
export async function chatCompletion(prompt: string): Promise<string> {
  return minimaxChatCompletion([{ role: 'user', content: prompt }]);
}

/**
 * 便捷函数：带图片的视觉分析
 */
export async function visionCompletion(prompt: string, imageBase64: string): Promise<string> {
  return minimaxChatCompletion([{
    role: 'user',
    content: [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: imageBase64 } },
    ],
  }]);
}
