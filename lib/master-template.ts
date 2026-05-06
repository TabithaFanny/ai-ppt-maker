/**
 * 全局母版提取器
 *
 * 从多页参考 PPT 分析结果中提取跨页共性：
 * - 最常见配色
 * - 共同背景类型
 * - 出现频率 ≥ 50% 的装饰元素（Logo、页码、装饰线等）
 * - 字体系统
 * - 风格标签
 * - 综合母版 Prompt
 */

import type { RefSlidePrompt, MasterTemplate, ElementType } from '@/types';

/** Find the most frequent value in an array */
function mode<T>(arr: T[]): T | undefined {
  const freq = new Map<T, number>();
  for (const v of arr) freq.set(v, (freq.get(v) || 0) + 1);
  let best: T | undefined;
  let bestCount = 0;
  for (const [v, c] of freq) {
    if (c > bestCount) { best = v; bestCount = c; }
  }
  return best;
}

/** Average of numbers, rounded */
function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
}

/** Top N items by frequency, return with count */
function topN<T>(arr: T[], n: number): Array<{ value: T; count: number }> {
  const freq = new Map<T, number>();
  for (const v of arr) freq.set(v, (freq.get(v) || 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([value, count]) => ({ value, count }));
}

/**
 * Infer position label from element rect (percentage coords 0-100)
 */
function inferPosition(rect: { x: number; y: number; w: number; h: number }): 'top' | 'bottom' | 'left' | 'right' | 'corner' | 'full' {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  if (rect.w > 80 && rect.h > 80) return 'full';
  if (cy < 15) return 'top';
  if (cy > 85) return 'bottom';
  if (cx < 15) return 'left';
  if (cx > 85) return 'right';
  return 'corner';
}

/**
 * Extract a MasterTemplate from multiple slide analysis results.
 * Should be called after batch analysis completes.
 */
export function extractMasterTemplate(prompts: RefSlidePrompt[]): MasterTemplate | null {
  if (prompts.length < 2) return null;

  const total = prompts.length;

  // ── 1. Color system (most frequent per role) ──
  const primaries = prompts.map((p) => p.colorRules.primary).filter(Boolean);
  const secondaries = prompts.map((p) => p.colorRules.secondary).filter(Boolean);
  const accents = prompts.map((p) => p.colorRules.accent).filter(Boolean);
  const backgrounds = prompts.map((p) => p.colorRules.background).filter(Boolean);
  const texts = prompts.map((p) => p.colorRules.text).filter(Boolean);

  const colorSystem = {
    primary: mode(primaries) || '#1e40af',
    secondary: mode(secondaries) || '#60a5fa',
    accent: mode(accents) || '#f59e0b',
    background: mode(backgrounds) || '#ffffff',
    text: mode(texts) || '#0f172a',
  };

  // ── 2. Background (most frequent type) ──
  const bgs = prompts.filter((p) => p.background).map((p) => p.background!);
  let background: MasterTemplate['background'] = null;
  if (bgs.length > 0) {
    const bgType = mode(bgs.map((b) => b.type)) || 'solid';
    const bgColors = topN(bgs.flatMap((b) => b.colors), 3).map((t) => t.value);
    const bgDesc = mode(bgs.map((b) => b.description)) || '';
    background = { type: bgType, colors: bgColors, description: bgDesc };
  }

  // ── 3. Shared decorations (elements appearing on ≥ 50% of slides) ──
  const decorTypes: ElementType[] = ['decoration', 'logo', 'page_number', 'line', 'shape', 'icon'];
  const elementFreq = new Map<string, { type: ElementType; desc: string; rects: Array<{ x: number; y: number; w: number; h: number }>; count: number }>();

  for (const prompt of prompts) {
    if (!prompt.elements) continue;
    for (const el of prompt.elements) {
      if (!decorTypes.includes(el.type)) continue;
      // Group by type + rough position
      const pos = inferPosition(el.rect);
      const key = `${el.type}:${pos}`;
      const existing = elementFreq.get(key);
      if (existing) {
        existing.count += 1;
        existing.rects.push(el.rect);
        if (el.purpose && el.purpose.length > existing.desc.length) existing.desc = el.purpose;
      } else {
        elementFreq.set(key, {
          type: el.type,
          desc: el.purpose || el.content?.imageDescription || '',
          rects: [el.rect],
          count: 1,
        });
      }
    }
  }

  const sharedDecorations: MasterTemplate['sharedDecorations'] = [];
  for (const [key, data] of elementFreq) {
    const percent = Math.round((data.count / total) * 100);
    if (percent >= 50) {
      const pos = key.split(':')[1] as MasterTemplate['sharedDecorations'][0]['position'];
      sharedDecorations.push({
        type: data.type,
        description: data.desc,
        position: pos,
        appearsOnPercent: percent,
      });
    }
  }

  // ── 4. Logo detection ──
  const logoElements = sharedDecorations.filter((d) => d.type === 'logo');
  const logo: MasterTemplate['logo'] = logoElements.length > 0
    ? { found: true, description: logoElements[0].description, position: logoElements[0].position }
    : null;

  // ── 5. Typography ──
  const titleSizes = prompts.map((p) => p.fontHierarchy.titleSize).filter((s) => s > 0);
  const bodySizes = prompts.map((p) => p.fontHierarchy.bodySize).filter((s) => s > 0);
  const titleWeights = prompts.map((p) => p.fontHierarchy.titleWeight).filter(Boolean);
  const fontSystems = prompts.map((p) => p.styleSummary?.fontSystem).filter(Boolean) as string[];

  const typography = {
    titleSize: avg(titleSizes) || 36,
    bodySize: avg(bodySizes) || 16,
    titleWeight: mode(titleWeights) || 'bold',
    fontSystem: mode(fontSystems) || '',
  };

  // ── 6. Style tags (top 8 by frequency) ──
  const allTags = prompts.flatMap((p) => p.styleTags || []);
  const styleTags = topN(allTags, 8).map((t) => t.value);

  // ── 7. Master prompt ──
  const masterPrompt = buildMasterPrompt({
    colorSystem,
    background,
    sharedDecorations,
    logo,
    typography,
    styleTags,
  });

  return {
    colorSystem,
    background,
    sharedDecorations,
    logo,
    typography,
    styleTags,
    masterPrompt,
    sourceSlideCount: total,
    extractedAt: Date.now(),
  };
}

function buildMasterPrompt(ctx: {
  colorSystem: MasterTemplate['colorSystem'];
  background: MasterTemplate['background'];
  sharedDecorations: MasterTemplate['sharedDecorations'];
  logo: MasterTemplate['logo'];
  typography: MasterTemplate['typography'];
  styleTags: string[];
}): string {
  const lines: string[] = [];

  lines.push('## 全局母版规则（每页必须遵守）');
  lines.push('');

  // Color
  lines.push(`**配色**：主色 ${ctx.colorSystem.primary}，辅色 ${ctx.colorSystem.secondary}，强调色 ${ctx.colorSystem.accent}，背景 ${ctx.colorSystem.background}，正文 ${ctx.colorSystem.text}。`);

  // Background
  if (ctx.background) {
    lines.push(`**背景**：${ctx.background.type === 'gradient' ? '渐变' : ctx.background.type === 'image' ? '图片' : ctx.background.type === 'pattern' ? '纹理' : '纯色'}背景，色值 ${ctx.background.colors.join(' → ')}。${ctx.background.description}`);
  }

  // Typography
  lines.push(`**字体**：标题 ${ctx.typography.titleSize}px ${ctx.typography.titleWeight}，正文 ${ctx.typography.bodySize}px。${ctx.typography.fontSystem ? `字体系统：${ctx.typography.fontSystem}` : ''}`);

  // Decorations
  if (ctx.sharedDecorations.length > 0) {
    lines.push('**固定装饰**：');
    for (const d of ctx.sharedDecorations) {
      if (d.type === 'logo') continue; // handled separately
      lines.push(`  - ${d.position}位置：${d.type}（${d.description || '装饰元素'}）出现 ${d.appearsOnPercent}% 页面`);
    }
  }

  // Logo
  if (ctx.logo?.found) {
    lines.push(`**Logo**：${ctx.logo.description}，位于${ctx.logo.position}。`);
  }

  // Style
  if (ctx.styleTags.length > 0) {
    lines.push(`**风格关键词**：${ctx.styleTags.join('、')}。`);
  }

  lines.push('');
  lines.push('每页生成时必须包含以上全局元素和配色，不可偏离。');

  return lines.join('\n');
}
