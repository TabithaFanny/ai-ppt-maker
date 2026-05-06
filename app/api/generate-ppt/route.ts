import { NextRequest } from 'next/server';
import { translateRequirements, generatePPTJson } from '@/lib/claude';
import { resolveStyleConfig } from '@/lib/style-bridge';
import { planDeck } from '@/lib/deck-planner';
import { resolveDeckPlanToPPTJson } from '@/lib/deck-resolver';
import { ok, fail } from '@/lib/api-response';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(ip, RATE_LIMITS.ai);
  if (!rl.allowed) {
    return fail('请求过于频繁，请稍后重试', 429);
  }

  try {
    const { styleConfig, styleKit, userInput, useDeckPlan = true } = await request.json();
    const resolvedStyleConfig = resolveStyleConfig({ styleConfig, styleKit });

    if (!resolvedStyleConfig) {
      return fail('缺少风格配置', 400);
    }

    if (useDeckPlan && styleKit) {
      // 新路径: DeckPlan → PPTJson
      const { deckPlan } = await planDeck(userInput, styleKit);
      const pptJson = resolveDeckPlanToPPTJson(deckPlan, styleKit);
      return ok({ pptJson, deckPlan });
    } else {
      // 旧路径 (fallback)
      const description = await translateRequirements(styleKit || resolvedStyleConfig, userInput);
      const pptJson = await generatePPTJson(description, resolvedStyleConfig);
      return ok({ pptJson });
    }
  } catch (error) {
    console.error('生成失败:', error);
    return fail(error instanceof Error ? error.message : '生成失败');
  }
}
