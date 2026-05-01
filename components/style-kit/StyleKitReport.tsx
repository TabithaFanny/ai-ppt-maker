'use client';

import { StyleKit, SlideRole, LayoutPattern } from '@/types';
import { CheckCircle, Palette, Type, Layout, Sparkles, Clock } from 'lucide-react';

interface StyleKitReportProps {
  styleKit: StyleKit;
  totalSlides: number;
  onConfirm?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
}

const MOOD_LABELS: Record<StyleKit['styleDNA']['mood'], string> = {
  professional: '专业商务',
  creative: '创意艺术',
  academic: '学术严谨',
  casual: '休闲随意',
};

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={18} className="text-indigo-600" />
      <h3 className="font-semibold text-gray-900">{title}</h3>
    </div>
  );
}

function ColorSwatch({
  label,
  hex,
}: {
  label: string;
  hex: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-10 h-10 rounded-lg border border-gray-200 shadow-sm"
        style={{ backgroundColor: hex }}
      />
      <div>
        <p className="text-xs text-gray-500 uppercase">{label}</p>
        <p className="text-sm font-mono text-gray-900">{hex}</p>
      </div>
    </div>
  );
}

function LayoutPatternBadge({ pattern }: { pattern: LayoutPattern }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
      <div className="flex items-center gap-2 mb-2">
        <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">
          {pattern.layoutType}
        </span>
        <span className="text-xs text-gray-500">
          {pattern.applicableSlides.length} slides
        </span>
      </div>
      <p className="text-xs text-gray-600 line-clamp-2">{pattern.layoutPrompt}</p>
      {pattern.bestFor.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {pattern.bestFor.map((bf) => (
            <span key={bf} className="px-1.5 py-0.5 text-xs bg-white border border-gray-200 rounded">
              {bf}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StyleKitReport({
  styleKit,
  totalSlides,
  onConfirm,
  onCancel,
  onRetry,
}: StyleKitReportProps) {
  const { styleDNA, layoutPatterns, stats } = styleKit;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Sparkles className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{styleKit.name}</h2>
            <p className="text-indigo-100 text-sm">
              StyleKit 分析完成 · {totalSlides} 页幻灯片
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Overall Assessment */}
        <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
          <CheckCircle className="text-green-600" size={24} />
          <div>
            <p className="font-medium text-green-900">风格提取成功</p>
            <p className="text-sm text-green-700">
              已从 {totalSlides} 页幻灯片中提取视觉风格 DNA
            </p>
          </div>
        </div>

        {/* Mood & Atmosphere */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <SectionHeader icon={Sparkles} title="风格定位" />
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
              {MOOD_LABELS[styleDNA.mood]}
            </span>
            <span className="text-gray-600 text-sm">{styleDNA.moodDescription}</span>
          </div>
        </div>

        {/* Color Palette */}
        <div>
          <SectionHeader icon={Palette} title="配色方案" />
          <div className="grid grid-cols-5 gap-3">
            <ColorSwatch label="Primary" hex={styleDNA.palette.primary} />
            <ColorSwatch label="Secondary" hex={styleDNA.palette.secondary} />
            <ColorSwatch label="Accent" hex={styleDNA.palette.accent} />
            <ColorSwatch label="Background" hex={styleDNA.palette.background} />
            <ColorSwatch label="Text" hex={styleDNA.palette.text} />
          </div>
        </div>

        {/* Typography */}
        <div>
          <SectionHeader icon={Type} title="字体系统" />
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Title Font</p>
              <p className="font-semibold" style={{ fontFamily: styleDNA.typography.titleFont }}>
                {styleDNA.typography.titleFont}
              </p>
              <p className="text-xs text-gray-500">{styleDNA.typography.titleSize}pt</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Body Font</p>
              <p className="font-semibold" style={{ fontFamily: styleDNA.typography.bodyFont }}>
                {styleDNA.typography.bodyFont}
              </p>
              <p className="text-xs text-gray-500">{styleDNA.typography.bodySize}pt</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-gray-500">
            <span>Subtitle: {styleDNA.typography.subtitleSize}pt</span>
            <span>Caption: {styleDNA.typography.captionSize}pt</span>
          </div>
        </div>

        {/* Spacing & Effects */}
        <div>
          <SectionHeader icon={Layout} title="间距与效果" />
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <p className="text-xs text-gray-500">Slide Padding</p>
              <p className="font-semibold text-lg">{styleDNA.spacing.slidePadding}px</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <p className="text-xs text-gray-500">Content Margin</p>
              <p className="font-semibold text-lg">{styleDNA.spacing.contentMargin}px</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <p className="text-xs text-gray-500">Element Gap</p>
              <p className="font-semibold text-lg">{styleDNA.spacing.elementGap}px</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <span className={`px-2 py-1 rounded text-sm ${
              styleDNA.effects.shadowEnabled
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}>
              Shadow: {styleDNA.effects.shadowType}
            </span>
            <span className="px-2 py-1 bg-gray-100 rounded text-sm">
              Radius: {styleDNA.effects.borderRadius}px
            </span>
            <span className={`px-2 py-1 rounded text-sm ${
              styleDNA.effects.gradientEnabled
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-500'
            }`}>
              Gradient: {styleDNA.effects.gradientEnabled ? 'Yes' : 'No'}
            </span>
          </div>
        </div>

        {/* Layout Patterns */}
        {layoutPatterns.length > 0 && (
          <div>
            <SectionHeader icon={Layout} title="布局模式" />
            <div className="grid grid-cols-2 gap-3">
              {layoutPatterns.slice(0, 4).map((pattern) => (
                <LayoutPatternBadge key={pattern.id} pattern={pattern} />
              ))}
            </div>
          </div>
        )}

        {/* Usage Stats */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Clock size={14} />
              创建于 {new Date(styleKit.createdAt).toLocaleDateString('zh-CN')}
            </span>
            <span>已使用 {stats.usageCount} 次</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
          >
            重新分析
          </button>
        )}
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
          >
            取消
          </button>
        )}
        {onConfirm && (
          <button
            onClick={onConfirm}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
          >
            保存 StyleKit
          </button>
        )}
      </div>
    </div>
  );
}
