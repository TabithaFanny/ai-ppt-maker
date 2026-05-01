/**
 * RenderSpec 构建器
 * PPTJson + StyleKit + LayoutPlan → RenderSpec
 * 生成页面唯一真源，Web 预览和 PPTX 导出都基于此
 */

import type { PPTJson, Slide, ContentBlock, StyleConfig, StyleKit } from '@/types';
import type { SlideRole } from '@/types/stylekit';
import type { RenderSpec, RenderSlide, RenderElement, ResidualIssue } from '@/types/generation';
import { resolveStyleConfig } from './style-bridge';
import { resolveLayoutPlan } from './layout-resolver';
import { performResidualCheck } from './residual-checker';

/** 将相对位置解析为绝对英寸（10x7.5 英寸标准幻灯片） */
function toAbsoluteInches(rel: { x: number; y: number; width: number; height: number }) {
  const SLIDE_W = 10;
  const SLIDE_H = 7.5;
  return {
    x: rel.x * SLIDE_W,
    y: rel.y * SLIDE_H,
    width: rel.width * SLIDE_W,
    height: rel.height * SLIDE_H,
  };
}

/** 为 ContentBlock 生成解析后的样式 */
function resolveBlockStyle(
  block: ContentBlock,
  styleConfig: StyleConfig,
  styleKit?: StyleKit | null
) {
  const dna = styleKit?.styleDNA;
  const isHeading = block.style?.fontWeight === 'bold' || (block.style?.fontSize && block.style.fontSize >= 24);

  return {
    fontFamily: isHeading
      ? (dna?.typography.titleFont || styleConfig.typography.titleFont)
      : (dna?.typography.bodyFont || styleConfig.typography.bodyFont),
    fontSize: block.style?.fontSize || (isHeading
      ? (dna?.typography.titleSize || styleConfig.typography.titleSize)
      : (dna?.typography.bodySize || styleConfig.typography.bodySize)),
    fontWeight: block.style?.fontWeight || (isHeading ? 'bold' : 'normal'),
    color: block.style?.color || (dna?.palette.text || styleConfig.palette.text),
    align: block.style?.align || 'left',
  };
}

/** ContentBlock.type → SlideElement.type 映射 */
function mapContentType(blockType: ContentBlock['type']): RenderElement['type'] {
  switch (blockType) {
    case 'text': return 'paragraph';
    case 'list': return 'bullet-list';
    case 'image': return 'image';
    case 'chart': return 'chart';
    default: return 'paragraph';
  }
}

/** 生成 pptxgenjs 兼容的 options */
function toPptxOptions(
  resolvedStyle: RenderElement['resolvedStyle'],
  resolvedPosition: RenderElement['resolvedPosition']
): Record<string, unknown> {
  return {
    x: resolvedPosition.x,
    y: resolvedPosition.y,
    w: resolvedPosition.width,
    h: resolvedPosition.height,
    fontSize: resolvedStyle.fontSize,
    fontFace: resolvedStyle.fontFamily,
    color: resolvedStyle.color.replace('#', ''),
    bold: resolvedStyle.fontWeight === 'bold',
    align: resolvedStyle.align,
  };
}

/**
 * 构建单页的 RenderSlide
 */
export function buildRenderSlide(
  slide: Slide,
  slideIndex: number,
  styleConfig: StyleConfig,
  styleKit?: StyleKit | null,
  slideRole?: SlideRole
): RenderSlide {
  const role: SlideRole = slideRole || 'content';
  const dna = styleKit?.styleDNA;

  const elements: RenderElement[] = slide.content.map((block) => {
    const resolvedPosition = toAbsoluteInches(block.position);
    const resolvedStyle = resolveBlockStyle(block, styleConfig, styleKit);
    const pptxOptions = toPptxOptions(resolvedStyle, resolvedPosition);

    return {
      id: `render-${block.id}`,
      sourceElementId: block.id,
      type: mapContentType(block.type),
      content: block.content,
      resolvedPosition,
      resolvedStyle,
      pptxOptions,
    };
  });

  return {
    id: slide.id,
    slideRole: role,
    background: dna?.palette.background || styleConfig.palette.background,
    elements,
  };
}

/**
 * 构建完整的 RenderSpec
 */
export function buildRenderSpec(
  pptJson: PPTJson,
  styleConfigOrKit: StyleConfig | StyleKit,
  slideRoles?: Map<string, SlideRole>
): RenderSpec {
  const styleKit = 'styleDNA' in styleConfigOrKit ? styleConfigOrKit : null;
  const styleConfig = styleKit
    ? resolveStyleConfig({ styleKit }) || styleConfigOrKit as StyleConfig
    : styleConfigOrKit as StyleConfig;

  const slides: RenderSlide[] = pptJson.slides.map((slide, index) => {
    const role = slideRoles?.get(slide.id) || 'content';
    return buildRenderSlide(slide, index, styleConfig, styleKit, role);
  });

  // 运行残差检查
  const residualChecks = performResidualCheck(pptJson);
  const issues: ResidualIssue[] = residualChecks.flatMap((check) =>
    check.issues.map((issue) => ({
      ...issue,
      slideId: check.slideId,
    }))
  );

  return {
    id: crypto.randomUUID(),
    projectId: pptJson.metadata.projectId,
    styleKitId: styleKit?.id || '',
    slides,
    validationPassed: issues.filter((i) => i.severity === 'critical').length === 0,
    issues,
  };
}

/**
 * 从 RenderSpec 获取某页的 pptxgenjs slide options
 */
export function getSlideBackground(renderSlide: RenderSlide): string {
  return renderSlide.background.replace('#', '');
}
