/**
 * image-to-manifest.ts
 *
 * 核心能力：用 Vision AI 识别幻灯片图片，输出精确的 manifest 元素描述。
 *
 * 流程：
 *   previewImage (base64) → Vision AI → JSON 元素列表 → ManifestSlide
 *
 * 这是 bggg-creator-image2pptx 方案中"图片识别"环节的实现。
 * 与 build-manifest.ts（从 GenSlidePrompt 粗结构转换）不同，
 * 本模块直接"看"图片，提取像素级精确的文字、形状、图片区域。
 */

import type {
  ManifestSlide,
  ManifestElement,
  EditablePptManifest,
} from './manifest-types';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT, DEFAULT_SLIDE_WIDTH_IN } from './manifest-types';

// ── Vision prompt ──

const VISION_SYSTEM_PROMPT = `你是一个 PPT 页面视觉分析专家。你的任务是：观察一张 PPT 幻灯片图片（16:9，画布 1600×900 像素），精确识别出页面中所有可见元素，并输出结构化的 JSON 描述。

## 输出格式

只输出一个 JSON 对象，不要有其他文字。格式：

{
  "name": "页面标题/描述",
  "background": { "kind": "background", "fill": "#hex颜色" },
  "elements": [
    {
      "kind": "text",
      "name": "元素名称",
      "text": "精确文字内容（逐字识别，包括中英文、数字、标点）",
      "x": 像素X坐标,
      "y": 像素Y坐标,
      "w": 像素宽度,
      "h": 像素高度,
      "font_size_px": 字号(像素),
      "bold": true/false,
      "color": "#hex颜色",
      "align": "left/center/right",
      "font_family": "字体名称（如看不出就写 Arial）"
    },
    {
      "kind": "shape",
      "shape": "rect/roundRect/ellipse/circle/line",
      "name": "形状描述",
      "x": 像素X坐标,
      "y": 像素Y坐标,
      "w": 像素宽度,
      "h": 像素高度,
      "fill": "#hex颜色或null",
      "stroke": "#hex颜色或null",
      "stroke_width_px": 描边粗细
    },
    {
      "kind": "image",
      "name": "图片内容描述",
      "description": "详细描述图片内容（用于后续 AI 重新生成该图片）",
      "x": 像素X坐标,
      "y": 像素Y坐标,
      "w": 像素宽度,
      "h": 像素高度
    }
  ]
}

## 关键规则

1. **坐标系**：画布左上角为 (0,0)，右下角为 (1600,900)。所有坐标和尺寸都用像素整数。
2. **元素顺序**：从底层到顶层（先背景、再底部形状、再文字）。
3. **文字识别**：必须逐字精确识别，不能模糊概括。中文、英文、数字、标点都要识别。
4. **文字样式**：估算字号（px）、是否加粗、颜色（hex）、对齐方式。
5. **形状识别**：矩形、圆角矩形、圆形、线条。估算填充色和描边色。
6. **图片区域**：照片、图标、插画、复杂图表标记为 image，用 description 描述内容。
7. **背景**：识别背景色（纯色）或标记为图片背景。
8. **不要遗漏**：页面上所有可见的文字、形状、图片都必须识别。小图标、装饰线、页码、Logo 都不能省。
9. **不要虚构**：只描述图片中实际存在的内容。
10. **位置精度**：坐标误差控制在 ±30px 以内，字号误差控制在 ±4px 以内。`;

// ── Parse vision output ──

function parseVisionOutput(raw: string): { name: string; elements: ManifestElement[] } | null {
  // Extract JSON from potential markdown code blocks
  const jsonMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || raw.match(/^\s*(\{[\s\S]*\})\s*$/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    const elements: ManifestElement[] = [];

    // Background
    if (parsed.background) {
      elements.push({
        kind: 'background',
        fill: parsed.background.fill || parsed.background.color,
        file: parsed.background.file,
      });
    }

    // Elements
    for (const el of parsed.elements || []) {
      const kind = el.kind || el.type;

      if (kind === 'text') {
        elements.push({
          kind: 'text',
          name: el.name,
          text: el.text || el.content || '',
          x: Math.round(el.x || 0),
          y: Math.round(el.y || 0),
          w: Math.round(el.w || el.width || 200),
          h: Math.round(el.h || el.height || 60),
          font_size_px: el.font_size_px || el.fontSize || 24,
          font_family: el.font_family || el.fontFamily,
          bold: el.bold || false,
          italic: el.italic || false,
          color: el.color || '#111111',
          align: el.align || 'left',
        });
      } else if (kind === 'shape') {
        elements.push({
          kind: 'shape',
          shape: el.shape || 'rect',
          name: el.name,
          x: Math.round(el.x || 0),
          y: Math.round(el.y || 0),
          w: Math.round(el.w || el.width || 100),
          h: Math.round(el.h || el.height || 100),
          fill: el.fill,
          stroke: el.stroke,
          stroke_width_px: el.stroke_width_px,
        });
      } else if (kind === 'image') {
        // Image elements: we store the description for later regeneration
        // For now, we can't include actual files — mark with a placeholder
        elements.push({
          kind: 'text',
          name: el.name || 'Image Area',
          text: `[图片: ${el.description || el.name || ''}]`,
          x: Math.round(el.x || 0),
          y: Math.round(el.y || 0),
          w: Math.round(el.w || el.width || 200),
          h: Math.round(el.h || el.height || 200),
          font_size_px: 14,
          color: '#999999',
          align: 'center',
          valign: 'middle',
        });
      }
    }

    return {
      name: parsed.name || 'Recognized Slide',
      elements,
    };
  } catch (e) {
    console.error('[image-to-manifest] Failed to parse vision output:', e);
    return null;
  }
}

// ── Public API ──

export interface ImageToManifestOptions {
  /** Which vision provider to use */
  provider?: 'openai' | 'minimax';
  /** Canvas dimensions */
  canvasWidth?: number;
  canvasHeight?: number;
  /** Additional context about the slide (e.g. title, type) */
  slideContext?: string;
  /** Maximum number of slides to analyze in parallel */
  concurrency?: number;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await worker(items[index], index);
    }
  }));

  return results;
}

/**
 * Analyze a single slide image with Vision AI and return a ManifestSlide
 * with pixel-precise element descriptions.
 */
export async function imageToManifestSlide(
  imageBase64: string,
  options?: ImageToManifestOptions,
): Promise<ManifestSlide> {
  const canvasW = options?.canvasWidth || DEFAULT_CANVAS_WIDTH;
  const canvasH = options?.canvasHeight || DEFAULT_CANVAS_HEIGHT;

  let contextNote = '';
  if (options?.slideContext) {
    contextNote = `\n\n## 附加信息\n${options.slideContext}`;
  }

  const prompt = VISION_SYSTEM_PROMPT +
    `\n\n画布尺寸: ${canvasW}×${canvasH} 像素。` +
    contextNote +
    `\n\n请分析这张 PPT 幻灯片图片，输出精确的 JSON 元素描述。`;

  // Dynamic import to keep this module usable in both server and edge
  const { openaiVisionChat, minimaxVisionChat } = await import('@/lib/api-client');

  const visionFn = options?.provider === 'minimax' ? minimaxVisionChat : openaiVisionChat;
  const raw = await visionFn(prompt, imageBase64, { maxTokens: 4096 });

  const parsed = parseVisionOutput(raw);
  if (!parsed) {
    throw new Error(`Vision AI 返回的内容无法解析为有效的元素描述。原始输出:\n${raw.slice(0, 500)}`);
  }

  return {
    name: parsed.name,
    elements: parsed.elements,
  };
}

/**
 * Analyze multiple slide images and build a complete EditablePptManifest.
 *
 * @param slides - Array of { imageBase64, context? } for each slide
 * @param deckName - Name of the deck
 */
export async function imagesToManifest(
  slides: Array<{ imageBase64: string; context?: string }>,
  deckName: string = 'Recognized Deck',
  options?: Omit<ImageToManifestOptions, 'slideContext'>,
): Promise<EditablePptManifest> {
  const canvasW = options?.canvasWidth || DEFAULT_CANVAS_WIDTH;
  const canvasH = options?.canvasHeight || DEFAULT_CANVAS_HEIGHT;
  const concurrency = options?.concurrency || 3;

  const manifestSlides = await mapWithConcurrency(slides, concurrency, async (slide, i) => {
    const manifestSlide = await imageToManifestSlide(slide.imageBase64, {
      ...options,
      slideContext: slide.context || `这是第 ${i + 1}/${slides.length} 页`,
    });
    manifestSlide.name = manifestSlide.name || `Slide ${i + 1}`;
    return manifestSlide;
  });

  return {
    deck: {
      name: deckName,
      canvas_width: canvasW,
      canvas_height: canvasH,
      slide_width_in: DEFAULT_SLIDE_WIDTH_IN,
    },
    slides: manifestSlides,
  };
}
