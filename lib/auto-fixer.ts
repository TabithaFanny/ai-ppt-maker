/**
 * 自动修复器
 * 对 RenderSpec 中的可修复问题进行自动修复
 */

import type { PPTJson, Slide } from '@/types';
import type { ResidualIssue } from '@/types/generation';

/** 修复结果 */
export interface FixResult {
  fixed: number;
  remaining: number;
  fixes: { issue: ResidualIssue; action: string }[];
}

/**
 * 修复空标题：从内容中提取
 */
function fixEmptyTitle(slide: Slide): { fixed: boolean; slide: Slide } {
  if (slide.title.trim()) return { fixed: false, slide };

  // 从内容中提取第一个 text 块作为标题
  const firstText = slide.content.find(
    (b) => (b.type === 'text' || b.type === 'list') && b.content.trim()
  );

  if (firstText) {
    const titleText = firstText.content.split('\n')[0].slice(0, 50);
    return { fixed: true, slide: { ...slide, title: titleText } };
  }

  return { fixed: true, slide: { ...slide, title: '未命名幻灯片' } };
}

/**
 * 修复空结论：从内容中总结
 */
function fixEmptyConclusion(slide: Slide): { fixed: boolean; slide: Slide } {
  if (slide.mainConclusion.trim()) return { fixed: false, slide };

  const textBlocks = slide.content.filter(
    (b) => (b.type === 'text' || b.type === 'list') && b.content.trim()
  );

  if (textBlocks.length > 0) {
    const lastBlock = textBlocks[textBlocks.length - 1];
    const conclusion = lastBlock.content.split('\n')[0].slice(0, 100);
    return { fixed: true, slide: { ...slide, mainConclusion: conclusion } };
  }

  return { fixed: false, slide };
}

/**
 * 修复空内容块：标记或移除
 */
function fixEmptyBlocks(slide: Slide): { fixed: boolean; slide: Slide } {
  const nonEmptyContent = slide.content.filter((b) => b.content.trim());
  if (nonEmptyContent.length === slide.content.length) return { fixed: false, slide };
  return { fixed: true, slide: { ...slide, content: nonEmptyContent } };
}

/**
 * 修复越界位置：clamp 到页面边界
 */
function fixOutOfBounds(slide: Slide): { fixed: boolean; slide: Slide } {
  let fixed = false;
  const content = slide.content.map((block) => {
    const { x, y, width, height } = block.position;
    let newX = x;
    let newY = y;
    let newW = width;
    let newH = height;

    // Clamp 宽高
    if (newW > 1) { newW = 1; fixed = true; }
    if (newH > 1) { newH = 1; fixed = true; }

    // Clamp 位置
    if (newX + newW > 1) { newX = 1 - newW; fixed = true; }
    if (newY + newH > 1) { newY = 1 - newH; fixed = true; }
    if (newX < 0) { newX = 0; fixed = true; }
    if (newY < 0) { newY = 0; fixed = true; }

    if (!fixed) return block;

    return {
      ...block,
      position: { x: newX, y: newY, width: newW, height: newH },
    };
  });

  return { fixed, slide: { ...slide, content } };
}

/**
 * 对单页执行自动修复
 */
export function autoFixSlide(
  slide: Slide,
  issues: ResidualIssue[]
): { slide: Slide; fixes: { issue: ResidualIssue; action: string }[] } {
  const fixes: { issue: ResidualIssue; action: string }[] = [];
  let currentSlide = slide;

  // 修复空标题
  const titleFix = fixEmptyTitle(currentSlide);
  if (titleFix.fixed) {
    currentSlide = titleFix.slide;
    const issue = issues.find((i) => i.type === 'empty_block' && i.description.includes('标题'));
    if (issue) fixes.push({ issue, action: '从内容提取标题' });
  }

  // 修复空结论
  const conclusionFix = fixEmptyConclusion(currentSlide);
  if (conclusionFix.fixed) {
    currentSlide = conclusionFix.slide;
    const issue = issues.find((i) => i.type === 'empty_block' && i.description.includes('结论'));
    if (issue) fixes.push({ issue, action: '从内容提取结论' });
  }

  // 修复空内容块
  const emptyFix = fixEmptyBlocks(currentSlide);
  if (emptyFix.fixed) {
    currentSlide = emptyFix.slide;
    const issue = issues.find((i) => i.type === 'empty_block' && i.description.includes('内容块'));
    if (issue) fixes.push({ issue, action: '移除空内容块' });
  }

  // 修复越界位置
  const boundsFix = fixOutOfBounds(currentSlide);
  if (boundsFix.fixed) {
    currentSlide = boundsFix.slide;
  }

  return { slide: currentSlide, fixes };
}

/**
 * 轻量级实时修复 — 不依赖 ResidualIssue，只做安全的非破坏性修复
 * 适用于编辑器中每次 slide 变更后运行
 * - 越界位置 clamp
 * - 空标题回退
 * 不移除空内容块（避免编辑时丢失用户正在输入的内容）
 */
export function autoFixSlideRealtime(slide: Slide): { slide: Slide; changed: boolean } {
  let current = slide;
  let changed = false;

  // 越界位置 clamp
  const boundsResult = fixOutOfBounds(current);
  if (boundsResult.fixed) {
    current = boundsResult.slide;
    changed = true;
  }

  // 空标题回退（只在标题完全为空时触发）
  if (!current.title.trim()) {
    const firstText = current.content.find(
      (b) => (b.type === 'text' || b.type === 'list') && b.content.trim()
    );
    if (firstText) {
      current = { ...current, title: firstText.content.split('\n')[0].slice(0, 50) };
      changed = true;
    }
  }

  return { slide: current, changed };
}

/**
 * 对整个 PPTJson 执行自动修复
 */
export function autoFixPPTJson(
  pptJson: PPTJson,
  issues: ResidualIssue[]
): { pptJson: PPTJson; result: FixResult } {
  let totalFixed = 0;
  const allFixes: { issue: ResidualIssue; action: string }[] = [];

  const slides = pptJson.slides.map((slide) => {
    const slideIssues = issues.filter(
      (i) => i.slideId === slide.id || (!i.slideId && !i.elementId)
    );
    const { slide: fixedSlide, fixes } = autoFixSlide(slide, slideIssues);
    totalFixed += fixes.length;
    allFixes.push(...fixes);
    return fixedSlide;
  });

  return {
    pptJson: { ...pptJson, slides },
    result: {
      fixed: totalFixed,
      remaining: Math.max(0, issues.length - totalFixed),
      fixes: allFixes,
    },
  };
}
