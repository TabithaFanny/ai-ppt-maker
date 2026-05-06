'use client';

import { useState } from 'react';
import { StyleKit } from '@/types';
import { CheckCircle, Palette, Type, Layout, Sparkles, Clock, X, Image, RefreshCw, AlertTriangle, Info } from 'lucide-react';
import NextImage from 'next/image';
import { generateImage } from '@/lib/gpt-image';
import { isMockMode } from '@/lib/api-client';

interface StyleKitReportProps {
  styleKit: StyleKit;
  totalSlides: number;
  onConfirm?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  hadFailures?: boolean;
  wasSampled?: boolean;
  processedSlides?: number;
}

const MOOD_LABELS: Record<StyleKit['styleDNA']['mood'], string> = {
  professional: '专业商务',
  creative: '创意艺术',
  academic: '学术严谨',
  casual: '休闲随意',
};

const MOOD_DESC: Record<StyleKit['styleDNA']['mood'], string> = {
  professional: '专业、克制、可信',
  creative: '创意、活力、新颖',
  academic: '学术、严谨、简洁',
  casual: '休闲、温暖、轻松',
};

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={18} className="text-indigo-600" />
      <h3 className="font-semibold text-gray-900">{title}</h3>
    </div>
  );
}

function ColorSwatch({ hex, label }: { hex: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-10 h-10 rounded-lg border border-gray-200 shadow-sm" style={{ backgroundColor: hex }} />
      <p className="text-[10px] text-gray-500 font-mono">{hex}</p>
      <p className="text-[10px] text-gray-400">{label}</p>
    </div>
  );
}

export default function StyleKitReport({
  styleKit,
  onConfirm,
  onCancel,
  onRetry,
  hadFailures,
  wasSampled,
  processedSlides,
}: StyleKitReportProps) {
  const { styleDNA, layoutPatterns, stats } = styleKit;
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  const buildCoverPrompt = (): string => {
    const { palette, mood, moodDescription } = styleDNA;
    const primary = palette.primary || '#1a56db';
    return `Professional ${mood} presentation cover page. Primary color: ${primary}. Clean, modern design with generous whitespace. Large centered title area. Minimal decorative elements. Style: ${moodDescription}`;
  };

  const handlePreviewClick = async () => {
    setIsGeneratingPreview(true);
    try {
      if (isMockMode()) {
        setPreviewUrl('https://placehold.co/1792x1024/1a56db/ffffff?text=Cover+Preview');
        setShowPreview(true);
        return;
      }
      const result = await generateImage({ prompt: buildCoverPrompt(), size: '1792x1024' });
      if (result.success && result.imageUrl) {
        setPreviewUrl(result.imageUrl);
        setShowPreview(true);
      } else {
        setPreviewUrl('https://placehold.co/1792x1024/1a56db/ffffff?text=Preview+Unavailable');
        setShowPreview(true);
      }
    } catch {
      setPreviewUrl('https://placehold.co/1792x1024/1a56db/ffffff?text=Preview+Error');
      setShowPreview(true);
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleRegenerate = async () => {
    setIsGeneratingPreview(true);
    try {
      if (isMockMode()) {
        setPreviewUrl('https://placehold.co/1792x1024/1a56db/ffffff?text=Regenerated+Preview');
        setIsGeneratingPreview(false);
        return;
      }
      const result = await generateImage({ prompt: buildCoverPrompt(), size: '1792x1024' });
      if (result.success && result.imageUrl) setPreviewUrl(result.imageUrl);
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1e40af] to-[#2563eb] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Sparkles className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">风格分析报告</h2>
              <p className="text-blue-100 text-sm">{styleKit.name}</p>
            </div>
          </div>
        </div>

        {/* Sampled / Partial 提示 */}
        {(wasSampled || hadFailures) && (
          <div className={`mx-6 mt-4 p-3 rounded-xl flex items-start gap-3 ${wasSampled ? 'bg-blue-50 border border-blue-100' : 'bg-amber-50 border border-amber-100'}`}>
            {wasSampled ? <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />}
            <div>
              <p className="text-sm font-medium text-gray-900">
                {wasSampled ? '已对参考 PPT 进行抽样分析' : '部分页面分析遇到困难'}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {wasSampled
                  ? '已提取主要视觉风格特征，后续生成时会优先保持整体风格一致。'
                  : '已提取主要风格特征，可继续生成。系统会在后续步骤中自动补齐和修正。'}
              </p>
            </div>
          </div>
        )}

        {/* Processed slides count */}
        {processedSlides !== undefined && (
          <div className="mx-6 mt-3">
            <p className="text-xs text-gray-500">已分析 {processedSlides} 页参考内容</p>
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* 总体说明 */}
          <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl">
            <CheckCircle className="text-green-600" size={24} />
            <div>
              <p className="font-medium text-green-900">风格提取完成</p>
              <p className="text-sm text-green-700">
                已提取参考 PPT 的主色、辅助色、字体层级倾向和版式特征，用于后续生成。
              </p>
            </div>
          </div>

          {/* 视觉气质 */}
          <div className="p-4 bg-gray-50 rounded-xl">
            <SectionHeader icon={Sparkles} title="视觉气质" />
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                {MOOD_LABELS[styleDNA.mood]}
              </span>
              <span className="text-sm text-gray-600">{MOOD_DESC[styleDNA.mood]}</span>
            </div>
          </div>

          {/* 配色方案 */}
          <div>
            <SectionHeader icon={Palette} title="配色方案" />
            <div className="flex gap-4 mb-3">
              <ColorSwatch hex={styleDNA.palette.primary} label="主色" />
              <ColorSwatch hex={styleDNA.palette.secondary} label="辅色" />
              <ColorSwatch hex={styleDNA.palette.accent} label="强调色" />
              <ColorSwatch hex={styleDNA.palette.background} label="背景" />
              <ColorSwatch hex={styleDNA.palette.text} label="文字" />
            </div>
            <p className="text-xs text-gray-500">
              以蓝白为主，搭配浅灰与深灰，营造专业、信任的视觉感受。
            </p>
          </div>

          {/* 字体层级 */}
          <div>
            <SectionHeader icon={Type} title="字体层级" />
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">标题字体</p>
                <p className="font-semibold text-gray-900">{styleDNA.typography.titleFont}</p>
                <p className="text-xs text-gray-500">{styleDNA.typography.titleSize}pt · 加粗</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">正文字体</p>
                <p className="font-semibold text-gray-900">{styleDNA.typography.bodyFont}</p>
                <p className="text-xs text-gray-500">{styleDNA.typography.bodySize}pt · 常规</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">层级分明，标题加粗，正文常规，强调色辅助突出重点。</p>
          </div>

          {/* 版式特征 */}
          <div>
            <SectionHeader icon={Layout} title="版式特征" />
            <div className="space-y-2">
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-700">卡片式布局为主，信息分区清晰；大留白增强呼吸感；顶部导航 + 步骤指示增强流程感。</p>
              </div>
              {layoutPatterns.slice(0, 2).map((pattern) => (
                <div key={pattern.id} className="p-3 bg-gray-50 rounded-xl flex items-center gap-3">
                  <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded whitespace-nowrap">{pattern.layoutType}</span>
                  <p className="text-xs text-gray-600">{pattern.layoutPrompt}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 生成建议 */}
          <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
            <SectionHeader icon={Sparkles} title="生成建议" />
            <ul className="space-y-1 text-sm text-gray-700">
              <li className="flex items-start gap-2"><CheckCircle size={14} className="text-indigo-600 mt-0.5 flex-shrink-0" />延续卡片式布局与蓝白主色调</li>
              <li className="flex items-start gap-2"><CheckCircle size={14} className="text-indigo-600 mt-0.5 flex-shrink-0" />保持清晰的信息层级与充足留白</li>
              <li className="flex items-start gap-2"><CheckCircle size={14} className="text-indigo-600 mt-0.5 flex-shrink-0" />突出专业与可信感</li>
            </ul>
          </div>

          {/* Stats */}
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
            <button onClick={onRetry} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium">重新分析</button>
          )}
          {onCancel && (
            <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium">取消</button>
          )}
          <button
            onClick={handlePreviewClick}
            disabled={isGeneratingPreview}
            className="flex items-center gap-2 px-5 py-2.5 border border-[#e2e8f0] text-gray-700 rounded-xl hover:bg-gray-100 text-sm font-medium transition-colors disabled:opacity-60"
          >
            <Image size={16} aria-hidden="true" />
            {isGeneratingPreview ? '生成中...' : '预览封面风格'}
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1e40af] text-white rounded-xl hover:bg-[#1e40af]/90 text-sm font-medium transition-colors"
          >
            <CheckCircle size={16} />
            继续下一步
          </button>
        </div>
      </div>

      {/* 封面风格预览弹窗 */}
      {showPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0]">
              <div>
                <h3 className="text-lg font-bold text-[#0f172a]">封面风格预览</h3>
                <p className="text-sm text-[#64748b]">此预览仅用于确认封面风格是否符合你的预期。</p>
              </div>
              <button onClick={() => setShowPreview(false)} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-4">
              {previewUrl ? (
                <div className="aspect-video bg-gradient-to-br from-[#1e40af] to-[#2563eb] rounded-xl flex items-center justify-center overflow-hidden relative">
                  <NextImage src={previewUrl} alt="封面预览" fill className="object-cover" unoptimized />
                </div>
              ) : (
                <div className="aspect-video bg-gradient-to-br from-[#1e40af] to-[#2563eb] rounded-xl flex items-center justify-center">
                  <div className="text-center text-white/80">
                    <Sparkles size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">封面标题区域</p>
                    <p className="text-sm opacity-60">副标题和日期信息</p>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 flex items-center justify-between bg-gray-50 border-t border-[#e2e8f0]">
              <button
                onClick={handleRegenerate}
                disabled={isGeneratingPreview}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-[#e2e8f0] rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={16} className={isGeneratingPreview ? 'animate-spin' : ''} />
                {isGeneratingPreview ? '生成中...' : '重新生成'}
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
                >
                  关闭
                </button>
                <button
                  onClick={() => { setShowPreview(false); onConfirm?.(); }}
                  className="px-5 py-2 bg-[#1e40af] text-white text-sm font-medium rounded-xl hover:bg-[#1e40af]/90 transition-colors"
                >
                  风格可以
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
