'use client';

import { useState } from 'react';
import { StyleKit, SlideRole, LayoutPattern } from '@/types';
import { CheckCircle, Palette, Type, Layout, Sparkles, Clock, X, Image, RefreshCw } from 'lucide-react';
import { generateImage } from '@/lib/gpt-image';

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

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={18} className="text-indigo-600" />
      <h3 className="font-semibold text-gray-900">{title}</h3>
    </div>
  );
}

function ColorSwatch({ label, hex }: { label: string; hex: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-10 h-10 rounded-lg border border-gray-200 shadow-sm" style={{ backgroundColor: hex }} />
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
        <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">{pattern.layoutType}</span>
        <span className="text-xs text-gray-500">{pattern.applicableSlides.length} slides</span>
      </div>
      <p className="text-xs text-gray-600 line-clamp-2">{pattern.layoutPrompt}</p>
      {pattern.bestFor.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {pattern.bestFor.map((bf) => (
            <span key={bf} className="px-1.5 py-0.5 text-xs bg-white border border-gray-200 rounded">{bf}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StyleKitReport({ styleKit, totalSlides, onConfirm, onCancel, onRetry }: StyleKitReportProps) {
  const { styleDNA, layoutPatterns, stats } = styleKit;
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  /** 从 styleKit 构建生图 Prompt */
  const buildCoverPrompt = (): string => {
    const { palette, typography, mood, moodDescription } = styleDNA;
    const primary = palette.primary || '#1a73e8';
    const moodMap: Record<string, string> = {
      professional: '专业商务风格，蓝调科技感',
      creative: '创意艺术风格，活泼多彩',
      academic: '学术严谨风格，简洁典雅',
      casual: '休闲随意风格，轻松温暖',
    };
    const moodText = moodMap[mood] || moodDescription;
    return `Professional ${moodText} presentation cover page. ${primary} as the primary color. Clean, modern design with generous whitespace. Large centered title area, minimal decorative elements. No background photograph. Typography uses ${typography.titleFont} style.`;
  };

  const handleConfirmClick = async () => {
    setIsGeneratingPreview(true);
    try {
      const prompt = buildCoverPrompt();
      const result = await generateImage({ prompt, size: '1792x1024' });
      if (result.success && result.imageUrl) {
        setPreviewUrl(result.imageUrl);
        setShowPreview(true);
      } else {
        // 生成失败，直接确认
        onConfirm?.();
      }
    } catch {
      onConfirm?.();
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handlePreviewConfirm = () => {
    setShowPreview(false);
    setPreviewUrl(null);
    onConfirm?.();
  };

  const handleRegeneratePreview = async () => {
    if (!previewUrl) return;
    setIsGeneratingPreview(true);
    try {
      const prompt = buildCoverPrompt();
      const result = await generateImage({ prompt, size: '1792x1024' });
      if (result.success && result.imageUrl) {
        setPreviewUrl(result.imageUrl);
      }
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Sparkles className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{styleKit.name}</h2>
              <p className="text-indigo-100 text-sm">StyleKit 分析完成 · {totalSlides} 页幻灯片</p>
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
              <p className="text-sm text-green-700">已从 {totalSlides} 页幻灯片中提取视觉风格 DNA</p>
            </div>
          </div>

          {/* Mood */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <SectionHeader icon={Sparkles} title="风格定位" />
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">{MOOD_LABELS[styleDNA.mood]}</span>
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
                <p className="font-semibold" style={{ fontFamily: styleDNA.typography.titleFont }}>{styleDNA.typography.titleFont}</p>
                <p className="text-xs text-gray-500">{styleDNA.typography.titleSize}pt</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Body Font</p>
                <p className="font-semibold" style={{ fontFamily: styleDNA.typography.bodyFont }}>{styleDNA.typography.bodyFont}</p>
                <p className="text-xs text-gray-500">{styleDNA.typography.bodySize}pt</p>
              </div>
            </div>
          </div>

          {/* Spacing */}
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
          </div>

          {/* Layout Patterns */}
          {layoutPatterns.length > 0 && (
            <div>
              <SectionHeader icon={Layout} title="布局模式" />
              <div className="grid grid-cols-2 gap-3">
                {layoutPatterns.slice(0, 4).map((pattern) => <LayoutPatternBadge key={pattern.id} pattern={pattern} />)}
              </div>
            </div>
          )}

          {/* Usage Stats */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Clock size={14} />创建于 {new Date(styleKit.createdAt).toLocaleDateString('zh-CN')}</span>
              <span>已使用 {stats.usageCount} 次</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          {onRetry && (
            <button onClick={onRetry} className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium">重新分析</button>
          )}
          {onCancel && (
            <button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium">取消</button>
          )}
          <button
            onClick={handleConfirmClick}
            disabled={isGeneratingPreview}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-60"
          >
            {isGeneratingPreview ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                生成封面预览...
              </>
            ) : (
              <>
                <Image size={16} />
                预览封面效果
              </>
            )}
          </button>
        </div>
      </div>

      {/* 封面预览弹窗 */}
      {showPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="text-lg font-bold">封面预览</h3>
                <p className="text-sm text-gray-500">AI 根据你的风格配置生成的封面图</p>
              </div>
              <button onClick={() => { setShowPreview(false); setPreviewUrl(null); onConfirm?.(); }} className="p-2 rounded-full hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>

            {previewUrl && (
              <div className="px-6 py-4">
                <img src={previewUrl} alt="封面预览" className="w-full rounded-lg border shadow" />
              </div>
            )}

            <div className="px-6 py-4 flex justify-between items-center bg-gray-50 border-t">
              <button
                onClick={handleRegeneratePreview}
                disabled={isGeneratingPreview}
                className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-100 disabled:opacity-50"
              >
                <RefreshCw size={16} />
                {isGeneratingPreview ? '生成中...' : '再试一张'}
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowPreview(false); setPreviewUrl(null); onConfirm?.(); }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
                >
                  风格OK，继续
                </button>
                <button
                  onClick={handleConfirmClick}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                >
                  确认并保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}