import { Project, StyleConfig, StyleKit } from '@/types';

function inferOverallStyle(styleKit: StyleKit): StyleConfig['overallStyle'] {
  const moodMap: Record<StyleKit['styleDNA']['mood'], StyleConfig['overallStyle']> = {
    professional: 'business',
    creative: 'creative',
    academic: 'academic',
    casual: 'tech',
  };

  return moodMap[styleKit.styleDNA.mood] || 'business';
}

export function styleKitToStyleConfig(styleKit: StyleKit): StyleConfig {
  return {
    overallStyle: inferOverallStyle(styleKit),
    palette: {
      primary: styleKit.styleDNA.palette.primary,
      secondary: styleKit.styleDNA.palette.secondary,
      accent: styleKit.styleDNA.palette.accent,
      background: styleKit.styleDNA.palette.background,
      text: styleKit.styleDNA.palette.text,
    },
    typography: {
      titleFont: styleKit.styleDNA.typography.titleFont,
      bodyFont: styleKit.styleDNA.typography.bodyFont,
      titleSize: styleKit.styleDNA.typography.titleSize,
      bodySize: styleKit.styleDNA.typography.bodySize,
    },
    layout: {
      type: mapLayoutType(styleKit),
      spacing: styleKit.styleDNA.spacing.elementGap,
      padding: styleKit.styleDNA.spacing.slidePadding,
    },
    designPrinciples: buildDesignPrinciples(styleKit),
  };
}

function mapLayoutType(styleKit: StyleKit): StyleConfig['layout']['type'] {
  const primaryLayout = styleKit.layoutPatterns[0]?.layoutType;
  switch (primaryLayout) {
    case 'two-column':
      return 'double';
    case 'full-bleed':
      return 'full';
    case 'centered':
      return 'centered';
    default:
      return 'single';
  }
}

function buildDesignPrinciples(styleKit: StyleKit): string[] {
  const principles = new Set<string>();

  principles.add(`整体风格为${styleKit.styleDNA.moodDescription}`);
  if (styleKit.styleDNA.effects.gradientEnabled) principles.add('适度使用渐变增强视觉层次');
  if (styleKit.styleDNA.effects.shadowEnabled) principles.add('保留柔和阴影提升卡片层次');
  if (styleKit.styleDNA.spacing.slidePadding >= 32) principles.add('保持充足留白');
  if (styleKit.layoutPatterns.length > 0) principles.add('优先复用模板中的典型版式');

  return [...principles];
}

export function resolveStyleConfig(options: {
  styleConfig?: StyleConfig;
  styleKit?: StyleKit | null;
}): StyleConfig | null {
  if (options.styleKit) return styleKitToStyleConfig(options.styleKit);
  return options.styleConfig ?? null;
}

export function resolveProjectStyleConfig(
  project: Project | null | undefined,
  currentStyleKit?: StyleKit | null
): StyleConfig | null {
  if (currentStyleKit && project?.styleKitId === currentStyleKit.id) {
    return styleKitToStyleConfig(currentStyleKit);
  }

  return project?.styleConfig ?? null;
}
