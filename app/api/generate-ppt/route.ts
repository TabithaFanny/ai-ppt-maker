import { NextRequest } from 'next/server';
import { translateRequirements, generatePPTJson } from '@/lib/claude';
import { resolveStyleConfig } from '@/lib/style-bridge';
import { planDeck } from '@/lib/deck-planner';
import { resolveDeckPlanToPPTJson } from '@/lib/deck-resolver';
import { ok, fail } from '@/lib/api-response';

export async function POST(request: NextRequest) {
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
