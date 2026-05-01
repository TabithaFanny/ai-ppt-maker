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

/**
 * 从 RenderSpec 导出 PPTX
 */
export async function exportRenderSpecToPPTX(
  renderSpec: RenderSpec,
  options: ExportOptions
): Promise<void> {
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
        } catch (e) {
          // 图片加载失败，插入占位文本
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
      // 图表暂用文本占位
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
      // 装饰元素在 PPTX 中暂不渲染
      break;

    default:
      // 兜底：作为文本渲染
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
