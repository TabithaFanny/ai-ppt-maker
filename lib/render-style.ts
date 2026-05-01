/**
 * StyleKit → 渲染配置 桥接模块
 * 将 StyleKit 数据转换为 CSS 变量和 PPTX 导出配置
 */

import { StyleKit, StyleConfig } from '@/types';
import { resolveStyleConfig } from './style-bridge';

/**
 * StyleKit → CSS 变量映射
 * 注入到页面根元素后，所有组件可通过 var(--sk-xxx) 使用
 */
export function styleKitToCSSVars(styleKit: StyleKit): Record<string, string> {
  const dna = styleKit.styleDNA;
  return {
    // 配色
    '--sk-primary': dna.palette.primary,
    '--sk-secondary': dna.palette.secondary,
    '--sk-accent': dna.palette.accent,
    '--sk-background': dna.palette.background,
    '--sk-text': dna.palette.text,

    // 字体
    '--sk-title-font': `${dna.typography.titleFont}, "PingFang SC", "Microsoft YaHei", sans-serif`,
    '--sk-body-font': `${dna.typography.bodyFont}, "PingFang SC", "Microsoft YaHei", sans-serif`,
    '--sk-title-size': `${dna.typography.titleSize}pt`,
    '--sk-subtitle-size': `${dna.typography.subtitleSize}pt`,
    '--sk-body-size': `${dna.typography.bodySize}pt`,
    '--sk-caption-size': `${dna.typography.captionSize}pt`,

    // 间距
    '--sk-slide-padding': `${dna.spacing.slidePadding}px`,
    '--sk-content-margin': `${dna.spacing.contentMargin}px`,
    '--sk-element-gap': `${dna.spacing.elementGap}px`,

    // 效果
    '--sk-border-radius': `${dna.effects.borderRadius}px`,
    '--sk-shadow': dna.effects.shadowEnabled
      ? dna.effects.shadowType === 'soft'
        ? '0 2px 8px rgba(0,0,0,0.1)'
        : '0 2px 4px rgba(0,0,0,0.2)'
      : 'none',

    // 情绪
    '--sk-mood': dna.mood,
  };
}

/**
 * 注入 StyleKit CSS 变量到目标元素
 */
export function injectStyleKitCSSVars(element: HTMLElement, styleKit: StyleKit): void {
  const vars = styleKitToCSSVars(styleKit);
  for (const [key, value] of Object.entries(vars)) {
    element.style.setProperty(key, value);
  }
}

/**
 * 移除 StyleKit CSS 变量
 */
export function removeStyleKitCSSVars(element: HTMLElement): void {
  const vars = styleKitToCSSVars({} as StyleKit);
  for (const key of Object.keys(vars)) {
    element.style.removeProperty(key);
  }
}

/**
 * PPTX 导出配置
 */
export interface PptxSlideConfig {
  backgroundColor: string;
  titleFontFace: string;
  titleFontSize: number;
  titleColor: string;
  titleBold: boolean;
  bodyFontFace: string;
  bodyFontSize: number;
  bodyColor: string;
  bodyBold: boolean;
  slidePadding: number;
  shadow: boolean;
  borderRadius: number;
}

/**
 * StyleKit → PPTX 导出配置
 */
export function styleKitToPptxConfig(styleKit: StyleKit): PptxSlideConfig {
  const dna = styleKit.styleDNA;
  return {
    backgroundColor: dna.palette.background,
    titleFontFace: dna.typography.titleFont,
    titleFontSize: dna.typography.titleSize,
    titleColor: dna.palette.text,
    titleBold: true,
    bodyFontFace: dna.typography.bodyFont,
    bodyFontSize: dna.typography.bodySize,
    bodyColor: dna.palette.text,
    bodyBold: false,
    slidePadding: dna.spacing.slidePadding,
    shadow: dna.effects.shadowEnabled,
    borderRadius: dna.effects.borderRadius,
  };
}

/**
 * StyleConfig → PPTX 导出配置 (兼容旧路径)
 */
export function styleConfigToPptxConfig(styleConfig: StyleConfig): PptxSlideConfig {
  return {
    backgroundColor: styleConfig.palette.background,
    titleFontFace: styleConfig.typography.titleFont,
    titleFontSize: styleConfig.typography.titleSize,
    titleColor: styleConfig.palette.text,
    titleBold: true,
    bodyFontFace: styleConfig.typography.bodyFont,
    bodyFontSize: styleConfig.typography.bodySize,
    bodyColor: styleConfig.palette.text,
    bodyBold: false,
    slidePadding: styleConfig.layout.padding,
    shadow: false,
    borderRadius: 0,
  };
}

/**
 * 统一入口：从 StyleKit 或 StyleConfig 获取 PPTX 配置
 */
export function resolvePptxConfig(options: {
  styleKit?: StyleKit | null;
  styleConfig?: StyleConfig | null;
}): PptxSlideConfig | null {
  if (options.styleKit) {
    return styleKitToPptxConfig(options.styleKit);
  }
  if (options.styleConfig) {
    return styleConfigToPptxConfig(options.styleConfig);
  }
  return null;
}
