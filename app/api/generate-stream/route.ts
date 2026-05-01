import { NextRequest } from 'next/server';
import { translateRequirements, generatePPTJson } from '@/lib/claude';
import { resolveStyleConfig } from '@/lib/style-bridge';
import { planDeck } from '@/lib/deck-planner';
import { resolveDeckPlanToPPTJson } from '@/lib/deck-resolver';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const { styleConfig, styleKit, userInput, useDeckPlan = true } = await request.json();
  const resolvedStyleConfig = resolveStyleConfig({ styleConfig, styleKit });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (!resolvedStyleConfig) {
          throw new Error('缺少风格配置');
        }

        // Stage 1: 分析
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 'analyzing', progress: 0 })}\n\n`));

        if (useDeckPlan && styleKit) {
          // === 新路径: DeckPlan → PPTJson ===

          // Stage 2: 内容规划
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 'planning', progress: 15, message: '正在规划内容结构...' })}\n\n`));

          const { deckPlan, issues } = await planDeck(userInput, styleKit);

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            stage: 'planning',
            progress: 40,
            message: `规划完成：${deckPlan.slidePlans.length} 页`,
            deckPlan,
            warnings: issues.filter(i => i.severity === 'warning').map(i => i.message),
          })}\n\n`));

          // Stage 3: 解析为 PPTJson
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 'generating', progress: 50, message: '正在生成页面内容...' })}\n\n`));

          const pptJson = resolveDeckPlanToPPTJson(deckPlan, styleKit);

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 'generating', progress: 85, message: '内容生成完成' })}\n\n`));

          // Stage 4: 完成
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            stage: 'complete',
            progress: 100,
            data: pptJson,
            deckPlan,
          })}\n\n`));
        } else {
          // === 旧路径: translateRequirements → generatePPTJson (fallback) ===

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 'translating', progress: 20 })}\n\n`));

          const description = await translateRequirements(styleKit || resolvedStyleConfig, userInput);

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 'translating', progress: 33 })}\n\n`));

          const pptJson = await generatePPTJson(description, resolvedStyleConfig);

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 'generating', progress: 66 })}\n\n`));

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 'complete', progress: 100, data: pptJson })}\n\n`));
        }

        controller.close();
      } catch (error) {
        console.error('[generate-stream] Error:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          stage: 'error',
          error: error instanceof Error ? error.message : '生成失败',
        })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
