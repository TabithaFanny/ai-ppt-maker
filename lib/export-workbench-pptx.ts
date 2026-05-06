/**
 * Workbench PPTX 导出
 *
 * 从 GenSlideResult[] + GenSlidePrompt[] 构建可编辑 PPTX：
 * - 每页以全屏背景图铺底（生成的 previewImage）
 * - 元素级精确定位的可编辑文本框
 * - 母版级页码、Logo 自动嵌入
 */

import pptxgen from 'pptxgenjs';
import type { GenSlideResult, GenSlidePrompt, MasterTemplate } from '@/types';

const SLIDE_W = 13.333; // LAYOUT_WIDE width in inches
const SLIDE_H = 7.5;    // LAYOUT_WIDE height in inches
type TextAlign = 'left' | 'center' | 'right' | 'justify';

export interface WorkbenchExportOptions {
  fileName: string;
  masterTemplate?: MasterTemplate | null;
  onProgress?: (current: number, total: number) => void;
}

/**
 * 将 URL/dataURL 转 base64 data URL
 */
async function toBase64(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
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

/** Strip # and return 6-char hex for pptxgenjs */
function hex(color: string | undefined): string {
  if (!color) return '333333';
  return color.replace(/^#/, '').slice(0, 6);
}

/** Percentage (0-100) → inches on slide */
function pctToInch(pct: number, total: number): number {
  return (pct / 100) * total;
}

/**
 * 从 Workbench 结果导出可编辑 PPTX
 *
 * 策略：
 * 1. 如果有 previewImage → 全屏背景图 + 元素级可编辑文本覆盖
 * 2. 如果没有 previewImage → 纯色背景 + 元素级文本
 * 3. 母版 Logo/页码在每页底部注入
 */
export async function exportWorkbenchToPPTX(
  results: GenSlideResult[],
  prompts: GenSlidePrompt[],
  options: WorkbenchExportOptions,
): Promise<string[]> {
  const warnings: string[] = [];
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';

  const master = options.masterTemplate;
  const textColor = master ? hex(master.colorSystem.text) : 'FFFFFF';
  const hasDarkBg = master ? isColorDark(master.colorSystem.background) : true;
  const overlayColor = hasDarkBg ? 'FFFFFF' : hex(master?.colorSystem.text);

  const sorted = [...results]
    .filter((r) => r.status === 'generated' || r.status === 'confirmed')
    .sort((a, b) => a.slideIndex - b.slideIndex);

  for (let i = 0; i < sorted.length; i++) {
    const result = sorted[i];
    const prompt = prompts.find((p) => p.index === result.slideIndex);
    options.onProgress?.(i + 1, sorted.length);

    const slide = pptx.addSlide();
    const hasImage = !!result.previewImage;

    // ── Background ──
    if (result.previewImage) {
      const b64 = await toBase64(result.previewImage);
      if (b64) {
        slide.background = { data: b64 };
      } else {
        warnings.push(`第 ${result.slideIndex} 页背景图加载失败`);
        slide.background = { color: hex(master?.colorSystem.background) || 'FFFFFF' };
      }
    } else {
      slide.background = { color: hex(master?.colorSystem.background) || 'FFFFFF' };
    }

    // ── Element-level text placement (from GenSlidePrompt.elements) ──
    const elements = prompt?.elements;
    if (elements && elements.length > 0) {
      for (const el of elements) {
        if (!el.content) continue;
        const pos = el.position;
        if (!pos) continue;

        const x = pctToInch(pos.x, SLIDE_W);
        const y = pctToInch(pos.y, SLIDE_H);
        const w = pctToInch(pos.w, SLIDE_W);
        const h = pctToInch(pos.h, SLIDE_H);

        const isTitle = el.type === 'title';
        const fontSize = el.style?.fontSize || (isTitle ? 28 : 14);
        const bold = el.style?.fontWeight === 'bold' || isTitle;
        const color = el.style?.color ? hex(el.style.color) : (hasImage ? overlayColor : textColor);
        const align = (el.style?.textAlign || 'left') as TextAlign;

        if (el.type === 'image') {
          // Image placeholder
          slide.addText(el.description || '[图片]', {
            x, y, w, h,
            fontSize: 11,
            fontFace: 'Microsoft YaHei',
            color: '999999',
            align: 'center',
            valign: 'middle',
            line: { color: 'CCCCCC', width: 0.5 },
          });
          continue;
        }

        const textOpts: Parameters<typeof slide.addText>[1] = {
          x, y, w, h,
          fontSize,
          fontFace: 'Microsoft YaHei',
          color,
          bold,
          align,
          valign: 'top',
          wrap: true,
        };

        // Text shadow for readability when on background image
        if (hasImage) {
          textOpts.shadow = { type: 'outer', blur: 4, offset: 1, color: '000000', opacity: 0.3 };
        }

        slide.addText(el.content, textOpts);
      }
    } else {
      // ── Fallback: sequential layout from pptJsonSlide ──
      const pptSlide = result.pptJsonSlide;
      if (pptSlide) {
        if (pptSlide.title) {
          slide.addText(pptSlide.title, {
            x: 0.5, y: 0.3, w: 12, h: 0.8,
            fontSize: 28,
            fontFace: 'Microsoft YaHei',
            color: hasImage ? overlayColor : textColor,
            bold: true,
            shadow: hasImage ? { type: 'outer', blur: 6, offset: 2, color: '000000', opacity: 0.4 } : undefined,
          });
        }

        if (pptSlide.content?.length) {
          let yPos = 1.3;
          for (const block of pptSlide.content) {
            if (!block.content) continue;
            const text = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
            const isHeading = block.type === 'text' && block.style?.fontWeight === 'bold';
            const fontSize = isHeading ? 20 : 14;
            const lineH = (fontSize * 1.5) / 72;
            const lines = Math.ceil(text.length / 50);
            const blockH = Math.max(0.5, Math.min(2.5, lines * lineH));

            slide.addText(text, {
              x: 0.5, y: yPos, w: 12, h: blockH,
              fontSize,
              fontFace: 'Microsoft YaHei',
              color: hasImage ? overlayColor : textColor,
              bold: isHeading,
              shadow: hasImage ? { type: 'outer', blur: 4, offset: 1, color: '000000', opacity: 0.3 } : undefined,
              valign: 'top',
            });

            yPos += blockH + 0.15;
            if (yPos > 6.5) break;
          }
        }
      }
    }

    // ── Master template overlays: page number ──
    if (master) {
      const pageNum = `${i + 1} / ${sorted.length}`;
      slide.addText(pageNum, {
        x: SLIDE_W - 1.5,
        y: SLIDE_H - 0.45,
        w: 1.2,
        h: 0.3,
        fontSize: 9,
        fontFace: 'Microsoft YaHei',
        color: hasImage ? 'CCCCCC' : '999999',
        align: 'right',
      });
    }

    // ── Master template overlays: Logo placeholder ──
    if (master?.logo?.found) {
      const logoPos = master.logo.position;
      const lx = logoPos === 'right' || logoPos === 'corner' ? SLIDE_W - 1.6 : 0.3;
      const ly = logoPos === 'bottom' ? SLIDE_H - 0.6 : 0.2;
      slide.addText(master.logo.description.slice(0, 20) || 'Logo', {
        x: lx,
        y: ly,
        w: 1.3,
        h: 0.35,
        fontSize: 8,
        fontFace: 'Microsoft YaHei',
        color: hasImage ? 'BBBBBB' : '999999',
        align: 'center',
        line: { color: 'CCCCCC', width: 0.5 },
      });
    }

    // ── Speaker notes ──
    const noteText = prompt?.speakerNotePrompt || result.pptJsonSlide?.mainConclusion || '';
    if (noteText) {
      slide.addNotes(noteText);
    }

    await new Promise((r) => setTimeout(r, 30));
  }

  await pptx.writeFile({ fileName: options.fileName });
  return warnings;
}

/** Rough check: is this hex color "dark"? */
function isColorDark(color: string | undefined): boolean {
  if (!color) return false;
  const c = color.replace('#', '');
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}
