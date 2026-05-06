/**
 * StyleKit → 渲染配置 桥接模块
 * 将 StyleKit 数据转换为 CSS 变量和 PPTX 导出配置
 */

import { StyleKit } from '@/types';

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
