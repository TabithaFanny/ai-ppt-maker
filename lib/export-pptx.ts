/**
 * PPTX 导出模块
 * 基于 RenderSpec 生成高质量 PPTX 文件
 */

import pptxgen from 'pptxgenjs';
import type { RenderSpec, RenderSlide, RenderElement } from '@/types/generation';
import { getSlideBackground } from './render-spec';

/** 导出选项 */
export interface ExportOptions {
  fileName: string;
  onProgress?: (current: number, total: number) => void;
}

/** 导出警告 */
export interface ExportWarning {
  slideIndex: number;
  message: string;
}

/**
 * 将 URL 转为 base64 data URL
 * 跨域或失败时返回 null，不阻断流程
 */
async function urlToBase64(url: string): Promise<string | null> {
  // 已经是 data URL 则直接返回
  if (url.startsWith('data:')) return url;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * 预处理所有图片元素：将 URL 转为 base64
 * 跨域/失败跳过并记录警告，不阻断导出
 */
async function resolveAllImageElements(
  renderSpec: RenderSpec,
): Promise<ExportWarning[]> {
  const warnings: ExportWarning[] = [];

  const resolvedSlides = await Promise.all(
    renderSpec.slides.map(async (slide, slideIndex) => {
      const resolvedElements = await Promise.all(
        slide.elements.map(async (element) => {
          if (element.type !== 'image' || !element.content) return element;

          const base64 = await urlToBase64(element.content);
          if (base64) {
            return { ...element, content: base64 };
          }
          warnings.push({
            slideIndex,
            message: `第 ${slideIndex + 1} 页图片加载失败（跨域或超时），已跳过`,
          });
          return element;
        }),
      );
      return { ...slide, elements: resolvedElements };
    }),
  );

  // 原地替换
  (renderSpec.slides as RenderSlide[]) = resolvedSlides;
  return warnings;
}

/**
 * 从 RenderSpec 导出 PPTX
 */
export async function exportRenderSpecToPPTX(
  renderSpec: RenderSpec,
  options: ExportOptions,
): Promise<ExportWarning[]> {
  const warnings: ExportWarning[] = [];

  // 预处理图片 URL → base64
  const imageWarnings = await resolveAllImageElements(renderSpec);
  warnings.push(...imageWarnings);

  const pptx = new pptxgen();

  for (let index = 0; index < renderSpec.slides.length; index++) {
    const renderSlide = renderSpec.slides[index];
    options.onProgress?.(index + 1, renderSpec.slides.length);

    const pptxSlide = pptx.addSlide();

    // 背景色
    pptxSlide.background = { color: getSlideBackground(renderSlide) };

    // 渲染每个元素
    for (const element of renderSlide.elements) {
      renderElement(pptxSlide, element);
    }

    // 让出主线程
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  await pptx.writeFile({ fileName: options.fileName });
  return warnings;
}

/**
 * 渲染单个元素到 PPTX 幻灯片
 */
function renderElement(pptxSlide: pptxgen.Slide, element: RenderElement): void {
  const { resolvedPosition, resolvedStyle } = element;
  const { x, y, width, height } = resolvedPosition;

  switch (element.type) {
    case 'heading':
    case 'paragraph':
    case 'bullet-list':
    case 'caption':
      pptxSlide.addText(element.content, {
        x,
        y,
        w: width,
        h: height,
        fontSize: resolvedStyle.fontSize,
        fontFace: resolvedStyle.fontFamily,
        color: resolvedStyle.color.replace('#', ''),
        bold: resolvedStyle.fontWeight === 'bold',
        align: resolvedStyle.align as any,
        valign: 'top',
      });
      break;

    case 'image':
      if (element.content) {
        try {
          pptxSlide.addImage({
            data: element.content,
            x,
            y,
            w: width,
            h: height,
          });
        } catch {
          pptxSlide.addText('[图片加载失败]', {
            x,
            y,
            w: width,
            h: height,
            fontSize: 12,
            color: '999999',
            align: 'center',
            valign: 'middle',
          });
        }
      }
      break;

    case 'chart':
      pptxSlide.addText(element.content || '[图表]', {
        x,
        y,
        w: width,
        h: height,
        fontSize: 14,
        color: '999999',
        align: 'center',
        valign: 'middle',
      });
      break;

    case 'icon':
    case 'decoration':
      break;

    default:
      if (element.content) {
        pptxSlide.addText(element.content, {
          x,
          y,
          w: width,
          h: height,
          fontSize: resolvedStyle.fontSize,
          fontFace: resolvedStyle.fontFamily,
          color: resolvedStyle.color.replace('#', ''),
        });
      }
  }
}
