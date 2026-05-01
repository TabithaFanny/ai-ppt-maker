import { ColorGroup, SlideVisualPrompt, StyleKit, TemplatePrompt } from '@/types';
import { styleKitToStyleConfig } from './style-bridge';

function toColorGroups(styleKit: StyleKit): ColorGroup[] {
  const { palette } = styleKit.styleDNA;
  return [
    { hex: palette.primary, name: 'Primary', role: 'primary' },
    { hex: palette.secondary, name: 'Secondary', role: 'secondary' },
    { hex: palette.accent, name: 'Accent', role: 'accent' },
    { hex: palette.background, name: 'Background', role: 'background' },
    { hex: palette.text, name: 'Text', role: 'text' },
  ];
}

function toSlidePrompts(styleKit: StyleKit): SlideVisualPrompt[] {
  return styleKit.layoutPatterns.map((pattern, index) => ({
    slideIndex: index + 1,
    imageBase64: pattern.thumbnailBase64 || '',
    visualPrompt: pattern.layoutPrompt,
    styleTags: [styleKit.styleDNA.mood, pattern.layoutType],
    colorPalette: [
      styleKit.styleDNA.palette.primary,
      styleKit.styleDNA.palette.secondary,
      styleKit.styleDNA.palette.accent,
    ],
    layout: mapLayout(pattern.layoutType),
    generatedAt: styleKit.updatedAt,
  }));
}

function mapLayout(layoutType: string): SlideVisualPrompt['layout'] {
  switch (layoutType) {
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

export function styleKitToTemplatePrompt(styleKit: StyleKit): TemplatePrompt {
  const styleConfig = styleKitToStyleConfig(styleKit);

  return {
    id: `template-${styleKit.id}`,
    name: styleKit.name,
    sourceFileId: styleKit.sourceFileId,
    sourceStyleKitId: styleKit.id,
    overallStyle: styleConfig.overallStyle,
    colorPalette: toColorGroups(styleKit),
    typography: {
      titleFont: styleKit.styleDNA.typography.titleFont,
      bodyFont: styleKit.styleDNA.typography.bodyFont,
      titleSize: styleKit.styleDNA.typography.titleSize,
      bodySize: styleKit.styleDNA.typography.bodySize,
    },
    universalPrompt: [
      styleKit.styleDNA.moodDescription,
      ...styleKit.layoutPatterns.slice(0, 3).map((pattern) => pattern.layoutPrompt),
    ].join(' | '),
    slidePrompts: toSlidePrompts(styleKit),
    usageCount: styleKit.stats.usageCount,
    lastUsedAt: undefined,
    userOptimizedPrompt: undefined,
    createdAt: styleKit.createdAt,
    updatedAt: styleKit.updatedAt,
  };
}

export function syncPromptTemplatesWithStyleKits(
  existingTemplates: TemplatePrompt[],
  styleKits: StyleKit[]
): TemplatePrompt[] {
  const manualTemplates = existingTemplates.filter((template) => !template.sourceStyleKitId);
  const derivedTemplates = styleKits.map(styleKitToTemplatePrompt);
  return [...manualTemplates, ...derivedTemplates];
}
