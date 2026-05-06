/**
 * API Key 存在性守卫
 *
 * 在 AI 端点使用前检查 API Key 是否已配置，返回用户友好的错误消息。
 */

import { fail } from '@/lib/api-response';

function getApiKeysConfigured(): { minimax: boolean; deepseek: boolean; openai: boolean } {
  return {
    minimax: !!process.env.MINIMAX_API_KEY,
    deepseek: !!process.env.DEEPSEEK_API_KEY,
    openai: !!process.env.OPENAI_API_KEY || !!process.env.BLT_API_KEY,
  };
}

export interface ApiKeyCheckResult {
  ok: true;
}

/**
 * 检查至少一个 AI provider 的 API Key 已配置
 * 如果未配置，返回 500 错误响应
 */
export function requireApiKey(): ApiKeyCheckResult | Response {
  const keys = getApiKeysConfigured();
  const hasAny = keys.minimax || keys.deepseek || keys.openai;

  if (!hasAny) {
    return fail(
      '未配置任何服务端 AI API Key。请在 .env.local 中设置 MINIMAX_API_KEY、DEEPSEEK_API_KEY、OPENAI_API_KEY 或 BLT_API_KEY。',
      500
    );
  }

  return { ok: true };
}

/**
 * 检查特定的 API Key 是否已配置
 */
export function requireSpecificKey(provider: 'minimax' | 'deepseek' | 'openai'): ApiKeyCheckResult | Response {
  const keys = getApiKeysConfigured();

  if (!keys[provider]) {
    return fail(
      provider === 'openai'
        ? '未配置 OPENAI_API_KEY 或 BLT_API_KEY。请在 .env.local 中设置其一。'
        : `未配置 ${provider.toUpperCase()}_API_KEY。请在 .env.local 中设置此环境变量`,
      500
    );
  }

  return { ok: true };
}
