import { NextRequest } from 'next/server';
import { fetchImageAsBase64, generateImage, generateSlideImage } from '@/lib/gpt-image';
import { Slide, StyleConfig, StyleKit } from '@/types';
import type { MasterTemplate, RefSlidePrompt } from '@/types';
import { resolveStyleConfig } from '@/lib/style-bridge';
import { ok, fail } from '@/lib/api-response';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { requireApiKey } from '@/lib/require-api-key';
import { sanitizeTitle } from '@/lib/sanitize';

export interface GenerateSlideImageRequest {
  slide?: Slide;
  styleConfig?: StyleConfig;
  styleKit?: StyleKit;
  prompts?: Array<{
    id: string;
    index: number;
    title: string;
    type: string;
    referenceSlideIds: number[];
    contentGoal: string;
    elements: Array<{
      type: string;
      content: string;
      description?: string;
      style?: Record<string, unknown>;
      position?: { x: number; y: number; w: number; h: number };
    }>;
    layoutStructure: string;
    colorRules: {
      primary: string;
      secondary: string;
      background: string;
      text: string;
      accent?: string;
    };
    assetReferences: string[];
    globalStylePrompt: string;
    visualPrompt: string;
    imagePrompt?: string;
    chartPrompt?: string;
    speakerNotePrompt?: string;
    status: string;
  }>;
  assetLibrary?: Array<{ assetId: string; name: string; type: string; url: string; description: string }>;
  extractedDocumentText?: string;
  referenceSlidePrompts?: RefSlidePrompt[];
  masterTemplate?: MasterTemplate | null;
}

function promptToSlide(prompt: NonNullable<GenerateSlideImageRequest['prompts']>[number]): Slide {
  return {
    id: prompt.id,
    layout: 'content',
    title: sanitizeTitle(prompt.title),
    mainConclusion: prompt.contentGoal || prompt.layoutStructure || '',
    content: (prompt.elements || []).slice(0, 8).map((element, index) => ({
      id: `${prompt.id}-content-${index}`,
      type: element.type === 'chart' ? 'chart' : element.type === 'image' || element.type === 'icon' ? 'image' : element.type === 'bullet_list' ? 'list' : 'text',
      content: element.content || element.description || element.type,
      position: {
        x: element.position?.x ?? 0,
        y: element.position?.y ?? 0,
        width: element.position?.w ?? 100,
        height: element.position?.h ?? 12,
      },
      style: {
        fontSize: typeof element.style?.fontSize === 'number' ? element.style.fontSize : undefined,
        fontWeight: typeof element.style?.fontWeight === 'string' ? element.style.fontWeight : undefined,
        color: typeof element.style?.color === 'string' ? element.style.color : undefined,
        align: typeof element.style?.textAlign === 'string' ? element.style.textAlign as 'left' | 'center' | 'right' : undefined,
      },
    })),
    speakerNotes: prompt.speakerNotePrompt || '',
  };
}

function buildWorkbenchImagePrompt(
  prompt: NonNullable<GenerateSlideImageRequest['prompts']>[number],
  assetLibrary: NonNullable<GenerateSlideImageRequest['assetLibrary']>,
  extractedDocumentText: string,
  resolvedStyleConfig?: StyleConfig,
  referenceSlidePrompts: RefSlidePrompt[] = [],
  masterTemplate?: MasterTemplate | null
): string {
  const assets = (prompt.assetReferences || [])
    .map((assetId) => assetLibrary.find((asset) => asset.assetId === assetId))
    .filter(Boolean)
    .map((asset) => `[${asset!.assetId}] ${asset!.name} (${asset!.type}) ${asset!.description}`)
    .join('；');

  const elementSummary = (prompt.elements || [])
    .slice(0, 8)
    .map((element, index) => {
      const content = element.content || element.description || element.type;
      const pos = element.position ? `位置(${element.position.x},${element.position.y},${element.position.w},${element.position.h})` : '';
      return `${index + 1}. ${element.type}: ${content}${pos ? `，${pos}` : ''}`;
    })
    .join('\n');

  const docSnippet = extractedDocumentText ? extractedDocumentText.slice(0, 400) : '';
  const matchedRefs = (prompt.referenceSlideIds || [])
    .map((id) => referenceSlidePrompts.find((ref) => ref.slideIndex === id))
    .filter(Boolean) as RefSlidePrompt[];
  const refContext = matchedRefs
    .map((ref) => [
      `参考第 ${ref.slideIndex} 页：${ref.pageType}`,
      ref.layoutPatternDescription || ref.layoutStructure ? `布局：${ref.layoutPatternDescription || ref.layoutStructure}` : '',
      ref.reusablePrompt ? `复刻风格：${ref.reusablePrompt.slice(0, 700)}` : '',
    ].filter(Boolean).join('\n'))
    .join('\n\n');
  const masterContext = masterTemplate
    ? [
      `母版风格：${masterTemplate.styleTags?.join('、') || ''}`,
      `母版配色：主色 ${masterTemplate.colorSystem.primary}，辅色 ${masterTemplate.colorSystem.secondary}，背景 ${masterTemplate.colorSystem.background}，正文 ${masterTemplate.colorSystem.text}`,
      masterTemplate.masterPrompt ? `母版 Prompt：${masterTemplate.masterPrompt.slice(0, 900)}` : '',
    ].filter(Boolean).join('\n')
    : '';

  return [
    '生成一张 16:9 中文 PPT 页面预览图，不要输出额外文字说明。',
    `页面标题：${prompt.title}`,
    `页面角色：${prompt.type}`,
    resolvedStyleConfig
      ? `项目风格基线：整体风格 ${resolvedStyleConfig.overallStyle}，主色 ${resolvedStyleConfig.palette.primary}，辅色 ${resolvedStyleConfig.palette.secondary}，强调色 ${resolvedStyleConfig.palette.accent}`
      : '',
    `内容目标：${prompt.contentGoal || '无'}`,
    `布局结构：${prompt.layoutStructure || '未指定'}`,
    `颜色规则：主色 ${prompt.colorRules.primary}，辅色 ${prompt.colorRules.secondary}，背景 ${prompt.colorRules.background}，正文 ${prompt.colorRules.text}${prompt.colorRules.accent ? `，强调 ${prompt.colorRules.accent}` : ''}`,
    prompt.globalStylePrompt ? `全局风格：${prompt.globalStylePrompt}` : '',
    prompt.visualPrompt ? `整页视觉 Prompt：${prompt.visualPrompt}` : '',
    prompt.imagePrompt ? `图片要求：${prompt.imagePrompt}` : '',
    prompt.chartPrompt ? `图表要求：${prompt.chartPrompt}` : '',
    masterContext ? `必须继承的母版风格：\n${masterContext}` : '',
    refContext ? `匹配参考页细节：\n${refContext}` : '',
    elementSummary ? `页面元素：\n${elementSummary}` : '',
    assets ? `可用资产：${assets}` : '',
    docSnippet ? `可参考文档摘要：${docSnippet}` : '',
    '要求：画面必须接近专业 PPT 截图风格，保留版式层级、卡片结构和信息模块，不要做成海报。',
  ].filter(Boolean).join('\n\n');
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(ip, RATE_LIMITS.image);
  if (!rl.allowed) {
    return fail('图片生成请求过于频繁，请稍后重试', 429);
  }

  // API Key 守卫
  const keyCheck = requireApiKey();
  if (!('ok' in keyCheck)) return keyCheck;

  try {
    const body = (await request.json()) as GenerateSlideImageRequest;
    const { slide, styleConfig, styleKit, prompts, assetLibrary = [], extractedDocumentText = '', referenceSlidePrompts = [], masterTemplate } = body;
    const resolvedStyleConfig = resolveStyleConfig({ styleConfig, styleKit });

    if (prompts?.length) {
      const results = [];

      for (const prompt of prompts) {
        const imageResult = await generateImage({
          prompt: buildWorkbenchImagePrompt(prompt, assetLibrary, extractedDocumentText, resolvedStyleConfig || undefined, referenceSlidePrompts, masterTemplate),
          size: '1792x1024',
          response_format: 'b64_json',
        });

        if (!imageResult.success) {
          return fail(imageResult.error || `第 ${prompt.index} 页生成失败`);
        }

        const previewImage = imageResult.base64
          ? `data:image/png;base64,${imageResult.base64}`
          : imageResult.imageUrl
            ? await fetchImageAsBase64(imageResult.imageUrl)
            : null;

        results.push({
          index: prompt.index,
          slide: promptToSlide(prompt),
          imageBase64: previewImage,
          imageUrl: imageResult.imageUrl,
        });
      }

      return ok({ results });
    }

    if (!slide || !slide.title) {
      return fail('Slide title is required', 400);
    }

    // 净化标题
    slide.title = sanitizeTitle(slide.title);

    const contentSummary = slide.content
      .filter((block) => block.type === 'text' || block.type === 'list')
      .map((block) => block.content)
      .join(' ')
      .slice(0, 200);

    const result = await generateSlideImage(
      slide.title,
      contentSummary,
      {
        primaryColor: resolvedStyleConfig?.palette?.primary,
        overallStyle: resolvedStyleConfig?.overallStyle,
      }
    );

    if (!result.success) {
      return fail(result.error || 'Image generation failed');
    }

    return ok({
      imageUrl: result.imageUrl,
      base64: result.base64,
    });
  } catch (error) {
    console.error('Generate slide image error:', error);
    return fail('Internal server error');
  }
}
