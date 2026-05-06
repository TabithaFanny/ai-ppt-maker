/**
 * build-manifest.ts
 *
 * 将 GenSlidePrompt[] / GenSlideResult[] 转换为 EditablePptManifest。
 *
 * 核心转换：
 *  - GenSlideElement.position (百分比 0-100) → 像素坐标 (基于 canvas 1600×900)
 *  - type mapping: heading → text+bold, paragraph → text, bullet-list → text(换行),
 *                  image → image (需要 file path 或 base64), chart → image fallback
 *  - 缺省样式从 colorRules 填充
 *  - 资产引用解析为 file 路径（base64 写入临时目录）
 */

import type { GenSlidePrompt, GenSlideResult, GenSlideElement, ColorRules, GenSlideElementType } from '@/types';
import type {
  EditablePptManifest,
  ManifestSlide,
  ManifestElement,
  ManifestTextElement,
  ManifestShapeElement,
  ManifestImageElement,
  ManifestBackgroundElement,
} from './manifest-types';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT, DEFAULT_SLIDE_WIDTH_IN } from './manifest-types';

// ── Coordinate conversion ──

function pctToPixel(pct: number, canvasSize: number): number {
  return Math.round((pct / 100) * canvasSize);
}

// ── Element conversion ──

const ELEMENT_TYPE_ALIASES: Record<string, GenSlideElementType> = {
  title: 'title',
  heading: 'title',
  标题: 'title',
  subtitle: 'subtitle',
  副标题: 'subtitle',
  text: 'text',
  paragraph: 'text',
  caption: 'text',
  body: 'text',
  list: 'text',
  'bullet-list': 'text',
  bullet_list: 'text',
  正文: 'text',
  文本: 'text',
  image: 'image',
  photo: 'image',
  illustration: 'image',
  图片: 'image',
  图像: 'image',
  shape: 'shape',
  rect: 'shape',
  rectangle: 'shape',
  decoration: 'shape',
  divider: 'shape',
  视觉元素: 'shape',
  装饰元素: 'shape',
  形状: 'shape',
  icon: 'icon',
  图标: 'icon',
  card: 'card',
  卡片: 'card',
  chart: 'chart',
  diagram: 'chart',
  图表: 'chart',
  table: 'table',
  表格: 'table',
  group: 'group',
};

const warnedUnknownTypes = new Set<string>();

export function normalizeElementType(type: unknown): GenSlideElementType {
  const raw = String(type || '').trim();
  const normalized = ELEMENT_TYPE_ALIASES[raw] || ELEMENT_TYPE_ALIASES[raw.toLowerCase()];
  if (normalized) return normalized;

  const warnKey = raw || 'empty';
  if (!warnedUnknownTypes.has(warnKey)) {
    warnedUnknownTypes.add(warnKey);
    console.warn(`[buildManifest] Unknown GenSlideElement.type "${warnKey}", falling back to text`);
  }
  return 'text';
}

function elementToManifestItems(
  el: GenSlideElement,
  colorRules: ColorRules | undefined,
  canvasW: number,
  canvasH: number,
): ManifestElement[] {
  const x = pctToPixel(el.position.x, canvasW);
  const y = pctToPixel(el.position.y, canvasH);
  const w = pctToPixel(el.position.w, canvasW);
  const h = pctToPixel(el.position.h, canvasH);
  const style = el.style || {};

  const type = normalizeElementType(el.type);

  // Text-like elements
  if (['title', 'text', 'subtitle', 'group'].includes(type)) {
    const isHeading = type === 'title';
    const textEl: ManifestTextElement = {
      kind: 'text',
      name: el.description || type,
      text: el.content || '',
      x, y, w, h,
      font_size_px: style.fontSize || (isHeading ? 48 : 24),
      bold: isHeading || style.fontWeight === 'bold',
      color: style.color || (isHeading ? colorRules?.text : colorRules?.text) || '#111111',
      align: style.textAlign || (isHeading ? 'center' : 'left'),
    };
    return [textEl];
  }

  // Bullet list → multi-line text
  if (type === 'table') {
    const lines = el.content.split(/\n|；|;/).map(l => l.trim()).filter(Boolean);
    const text = lines.length ? lines.map(l => `• ${l}`).join('\n') : el.content;
    const textEl: ManifestTextElement = {
      kind: 'text',
      name: el.description || 'Bullet List',
      text,
      x, y, w, h,
      font_size_px: style.fontSize || 20,
      bold: false,
      color: style.color || colorRules?.text || '#333333',
      align: style.textAlign || 'left',
    };
    return [textEl];
  }

  // Image element → needs file path (caller must provide base64-to-file mapping)
  if (type === 'image' || type === 'icon') {
    // For now, we output a placeholder. The API route will resolve asset references
    // and write actual image files before calling the Python renderer.
    const imgEl: ManifestImageElement = {
      kind: 'image',
      name: el.description || 'Image',
      file: `component_images/${el.content || 'placeholder'}.png`,
      x, y, w, h,
      fit: 'contain',
    };
    return [imgEl];
  }

  // Shape elements
  if (type === 'shape' || type === 'card') {
    const shapeEl: ManifestShapeElement = {
      kind: 'shape',
      shape: style.borderRadius && style.borderRadius > 0 ? 'roundRect' : 'rect',
      name: el.description || 'Shape',
      x, y, w, h,
      fill: style.backgroundColor || colorRules?.secondary,
      stroke: style.color,
    };
    return [shapeEl];
  }

  // Chart → image fallback (charts are too complex for native shapes)
  if (type === 'chart') {
    const textEl: ManifestTextElement = {
      kind: 'text',
      name: el.description || 'Chart Placeholder',
      text: `[${type}: ${el.content}]`,
      x, y, w, h,
      font_size_px: style.fontSize || 16,
      color: colorRules?.text || '#666666',
      align: 'center',
      valign: 'middle',
    };
    return [textEl];
  }

  // Fallback: render as text
  const fallbackEl: ManifestTextElement = {
    kind: 'text',
    name: el.description || el.type,
    text: el.content || '',
    x, y, w, h,
    font_size_px: style.fontSize || 20,
    color: style.color || colorRules?.text || '#333333',
    align: style.textAlign || 'left',
  };
  return [fallbackEl];
}

// ── Slide conversion ──

function slideToManifestSlide(
  prompt: GenSlidePrompt,
  _result?: GenSlideResult,
  canvasW: number = DEFAULT_CANVAS_WIDTH,
  canvasH: number = DEFAULT_CANVAS_HEIGHT,
): ManifestSlide {
  const elements: ManifestElement[] = [];

  // 1. Background from colorRules
  if (prompt.colorRules?.background) {
    const bg: ManifestBackgroundElement = {
      kind: 'background',
      fill: prompt.colorRules.background,
    };
    elements.push(bg);
  }

  // 2. Convert each GenSlideElement
  for (const el of prompt.elements || []) {
    const items = elementToManifestItems(el, prompt.colorRules, canvasW, canvasH);
    elements.push(...items);
  }

  // 3. If no elements but has title/contentGoal, add basic text
  if (elements.length <= 1 && prompt.title) {
    elements.push({
      kind: 'text',
      name: 'Title',
      text: prompt.title,
      x: 120, y: 80, w: 1360, h: 120,
      font_size_px: 48,
      bold: true,
      color: prompt.colorRules?.text || '#111111',
      align: 'center',
    });
  }
  if (elements.length <= 2 && prompt.contentGoal) {
    elements.push({
      kind: 'text',
      name: 'Content Goal',
      text: prompt.contentGoal,
      x: 120, y: 240, w: 1360, h: 500,
      font_size_px: 24,
      color: prompt.colorRules?.text || '#333333',
      align: 'left',
    });
  }

  return {
    name: `Slide ${prompt.index}: ${prompt.title}`,
    elements,
  };
}

// ── Public API ──

export interface BuildManifestOptions {
  deckName?: string;
  canvasWidth?: number;
  canvasHeight?: number;
  slideWidthIn?: number;
}

/**
 * Build an EditablePptManifest from GenSlidePrompt[] and optionally GenSlideResult[].
 *
 * This is the normalization layer between your app's data model and the
 * bggg-creator-image2pptx Python renderer.
 */
export function buildManifest(
  prompts: GenSlidePrompt[],
  results?: GenSlideResult[],
  options?: BuildManifestOptions,
): EditablePptManifest {
  const canvasW = options?.canvasWidth || DEFAULT_CANVAS_WIDTH;
  const canvasH = options?.canvasHeight || DEFAULT_CANVAS_HEIGHT;

  const slides = prompts
    .sort((a, b) => a.index - b.index)
    .map((prompt) => {
      const result = results?.find(r => r.slideIndex === prompt.index);
      return slideToManifestSlide(prompt, result, canvasW, canvasH);
    });

  return {
    deck: {
      name: options?.deckName || 'Untitled Deck',
      canvas_width: canvasW,
      canvas_height: canvasH,
      slide_width_in: options?.slideWidthIn || DEFAULT_SLIDE_WIDTH_IN,
    },
    slides,
  };
}
