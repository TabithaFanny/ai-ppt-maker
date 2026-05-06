import { NextRequest } from 'next/server';
import { translateRequirements, generatePPTJson } from '@/lib/claude';
import { resolveStyleConfig } from '@/lib/style-bridge';
import { planDeck } from '@/lib/deck-planner';
import { resolveDeckPlanToPPTJson } from '@/lib/deck-resolver';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { requireApiKey } from '@/lib/require-api-key';
import { sanitizeTopic, sanitizePromptString, sanitizeTitle, MAX_PROMPT_LENGTH } from '@/lib/sanitize';
import type { StyleConfig, StyleKit, UserInput } from '@/types';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(ip, RATE_LIMITS.ai);
  if (!rl.allowed) {
    return Response.json({ success: false, error: '请求过于频繁，请稍后重试' }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) },
    });
  }

  // API Key 守卫
  const keyCheck = requireApiKey();
  if (!('ok' in keyCheck)) return keyCheck;

  const encoder = new TextEncoder();
  let styleConfig: StyleConfig | undefined;
  let styleKit: StyleKit | null | undefined;
  let userInput: UserInput;
  let useDeckPlan = true;

  // 解析请求体在 try 外处理，避免 SSE stream 未开始就崩溃
  try {
    const body = await request.json() as { styleConfig?: StyleConfig; styleKit?: StyleKit | null; userInput: UserInput; useDeckPlan?: boolean };
    styleConfig = body.styleConfig;
    styleKit = body.styleKit;
    userInput = body.userInput;
    useDeckPlan = body.useDeckPlan ?? true;
    // 净化用户输入
    userInput.topic = sanitizeTopic(userInput.topic || '');
    if (userInput.description) userInput.description = sanitizePromptString(userInput.description, MAX_PROMPT_LENGTH);
    if (userInput.specialRequirements) userInput.specialRequirements = sanitizePromptString(userInput.specialRequirements, 2000);
  } catch (parseError) {
    return new Response(encoder.encode(`data: ${JSON.stringify({
      stage: 'error',
      error: parseError instanceof Error ? parseError.message : '请求解析失败',
    })}\n\n`), {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });
  }

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
