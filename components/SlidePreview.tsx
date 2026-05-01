'use client';

/**
 * SlidePreview — 使用 StyleKit CSS 变量渲染的幻灯片预览组件
 * 替代 GenerateStep 中的硬编码预览
 */

import { Slide, StyleKit, StyleConfig } from '@/types';
import { styleKitToCSSVars } from '@/lib/render-style';

interface SlidePreviewProps {
  slide: Slide;
  styleKit?: StyleKit | null;
  styleConfig?: StyleConfig | null;
  className?: string;
}

export default function SlidePreview({ slide, styleKit, styleConfig, className = '' }: SlidePreviewProps) {
  // 构建 CSS 变量
  const cssVars: Record<string, string> = styleKit
    ? styleKitToCSSVars(styleKit)
    : styleConfig
      ? {
          '--sk-primary': styleConfig.palette.primary,
          '--sk-secondary': styleConfig.palette.secondary,
          '--sk-accent': styleConfig.palette.accent,
          '--sk-background': styleConfig.palette.background,
          '--sk-text': styleConfig.palette.text,
          '--sk-title-font': `${styleConfig.typography.titleFont}, "PingFang SC", "Microsoft YaHei", sans-serif`,
          '--sk-body-font': `${styleConfig.typography.bodyFont}, "PingFang SC", "Microsoft YaHei", sans-serif`,
          '--sk-title-size': `${styleConfig.typography.titleSize}pt`,
          '--sk-body-size': `${styleConfig.typography.bodySize}pt`,
          '--sk-slide-padding': `${styleConfig.layout.padding}px`,
          '--sk-element-gap': `${styleConfig.layout.spacing}px`,
          '--sk-border-radius': '8px',
          '--sk-shadow': '0 2px 8px rgba(0,0,0,0.1)',
        }
      : {};

  return (
    <div
      className={`relative w-full aspect-video overflow-hidden ${className}`}
      style={{
        ...cssVars,
        backgroundColor: 'var(--sk-background, #ffffff)',
        fontFamily: 'var(--sk-body-font, sans-serif)',
        color: 'var(--sk-text, #202124)',
        padding: 'var(--sk-slide-padding, 40px)',
        borderRadius: 'var(--sk-border-radius, 8px)',
        boxShadow: 'var(--sk-shadow, 0 2px 8px rgba(0,0,0,0.1))',
      } as React.CSSProperties}
    >
      {/* 标题 */}
      <h1
        style={{
          fontFamily: 'var(--sk-title-font, sans-serif)',
          fontSize: 'var(--sk-title-size, 2.5rem)',
          fontWeight: 700,
          color: 'var(--sk-primary, #1a73e8)',
          marginBottom: '0.5rem',
          lineHeight: 1.2,
        }}
      >
        {slide.title}
      </h1>

      {/* 核心结论 */}
      <p
        style={{
          fontSize: 'var(--sk-body-size, 1rem)',
          fontStyle: 'italic',
          color: 'var(--sk-text, #5f6368)',
          opacity: 0.8,
          marginBottom: 'var(--sk-element-gap, 12px)',
        }}
      >
        {slide.mainConclusion}
      </p>

      {/* 内容块 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sk-element-gap, 8px)' }}>
        {slide.content.map((block) => (
          <SlideBlock key={block.id} block={block} />
        ))}
      </div>
    </div>
  );
}

function SlideBlock({ block }: { block: Slide['content'][0] }) {
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${block.position.x * 100}%`,
    top: `${block.position.y * 100}%`,
    width: `${block.position.width * 100}%`,
    height: `${block.position.height * 100}%`,
    fontSize: block.style?.fontSize
      ? `${block.style.fontSize}pt`
      : 'var(--sk-body-size, 1rem)',
    fontWeight: block.style?.fontWeight || 'normal',
    color: block.style?.color || 'var(--sk-text, #202124)',
    textAlign: block.style?.align || 'left',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
  };

  switch (block.type) {
    case 'text':
      return (
        <div style={baseStyle}>
          <p style={{ width: '100%', margin: 0, lineHeight: 1.5 }}>{block.content}</p>
        </div>
      );
    case 'list':
      return (
        <div style={{ ...baseStyle, alignItems: 'flex-start' }}>
          <ul style={{ width: '100%', margin: 0, paddingLeft: '1.2em', lineHeight: 1.6 }}>
            {block.content.split('\n').filter(Boolean).map((item, i) => (
              <li key={i}>{item.replace(/^[•\-\*]\s*/, '')}</li>
            ))}
          </ul>
        </div>
      );
    case 'image':
      return (
        <div style={baseStyle}>
          {block.content ? (
            <img
              src={block.content}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--sk-border-radius, 4px)' }}
            />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              backgroundColor: 'var(--sk-primary, #e8f0fe)',
              borderRadius: 'var(--sk-border-radius, 4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.3,
              fontSize: '0.75rem',
            }}>
              [图片占位]
            </div>
          )}
        </div>
      );
    case 'chart':
      return (
        <div style={baseStyle}>
          <div style={{
            width: '100%',
            height: '100%',
            backgroundColor: 'var(--sk-secondary, #e6f4ea)',
            borderRadius: 'var(--sk-border-radius, 4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.3,
            fontSize: '0.75rem',
          }}>
            [图表占位]
          </div>
        </div>
      );
    default:
      return (
        <div style={baseStyle}>
          <p style={{ width: '100%', margin: 0 }}>{block.content}</p>
        </div>
      );
  }
}
