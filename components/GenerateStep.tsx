'use client';

import { useState, useRef, TouchEvent, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { ChevronLeft, ChevronRight, Download, Share2, Maximize2, Minimize2, RefreshCw, X, Image } from 'lucide-react';
import pptxgen from 'pptxgenjs';
import SlidePreview from './SlidePreview';
import { buildRenderSpec, getSlideBackground } from '@/lib/render-spec';
import { autoFixPPTJson } from '@/lib/auto-fixer';
import { exportRenderSpecToPPTX } from '@/lib/export-pptx';
import { generateImage } from '@/lib/gpt-image';
import { imageService } from '@/lib/db';
import type { StyleKit } from '@/types';

export default function GenerateStep() {
  const { currentProject, currentStyleKit } = useStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  // 单张重生成状态
  const [slideImages, setSlideImages] = useState<Record<number, string>>({});
  const [regeneratingPage, setRegeneratingPage] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [modalPageIndex, setModalPageIndex] = useState<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const slides = currentProject?.pptJson?.slides || [];

  // 挂载时从 IndexedDB 恢复已保存的 AI 图片
  useEffect(() => {
    if (!currentProject?.id) return;
    imageService.getByProject(currentProject.id).then((images) => {
      if (images.length > 0) {
        const imageMap: Record<number, string> = {};
        for (const img of images) {
          imageMap[img.slideIndex] = img.imageUrl;
        }
        setSlideImages(imageMap);
      }
    }).catch(console.error);
  }, [currentProject?.id]);

  const nextSlide = () => setCurrentIndex((prev) => Math.min(prev + 1, slides.length - 1));
  const prevSlide = () => setCurrentIndex((prev) => Math.max(prev - 1, 0));

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX; // reset to avoid ghost swipe
  };

  const handleTouchMove = (e: TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;
    if (diff > threshold) {
      nextSlide();
    } else if (diff < -threshold) {
      prevSlide();
    }
    touchEndX.current = touchStartX.current; // reset for next gesture
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  /** 构建单页生图 Prompt */
  const buildSlidePrompt = (slideIndex: number): string => {
    const slide = slides[slideIndex];
    if (!slide) return '';

    const styleConfig = currentProject?.styleConfig;
    const styleDesc = styleConfig?.overallStyle || 'business';
    const primaryColor = styleConfig?.palette?.primary || '#1a73e8';

    // Slide.title 是标题，slide.content 是 ContentBlock[]
    const title = slide.title || `第${slideIndex + 1}页`;
    const content = slide.content
      ?.slice(0, 3)
      ?.map((block) => block.content)
      ?.filter(Boolean)
      ?.join('，') || '';

    const role = slide.layout || 'content';
    const roleTemplate: Record<string, string> = {
      title: '极简商务风封面，渐变背景，居中大标题，无装饰图',
      content: '简洁内容页，白色为主，左侧标题区，右侧内容，无背景图',
      image: '图片展示页，主图突出，图文并茂',
      chart: '数据展示页，图表区清晰分割，圆角卡片承载数据',
      quote: '引用页，大字引文居中，小字出处',
    };

    return `${roleTemplate[role] || roleTemplate.content}\n主题：${title}${content ? '，' + content : ''}\n主色调：${primaryColor}\n风格：${styleDesc}`;
  };

  /** 打开重生成弹窗 */
  const openRegenModal = (pageIndex: number) => {
    setModalPageIndex(pageIndex);
    setEditPrompt(buildSlidePrompt(pageIndex));
    setPreviewUrl(slideImages[pageIndex] || null);
    setShowModal(true);
  };

  /** 执行单页重生成 */
  const handleRegenerate = async () => {
    if (!editPrompt.trim()) return;

    setIsRegenerating(true);
    try {
      const result = await generateImage({
        prompt: editPrompt,
        size: '1792x1024',
      });

      if (result.success && result.imageUrl) {
        setSlideImages((prev) => ({ ...prev, [modalPageIndex]: result.imageUrl! }));
        setPreviewUrl(result.imageUrl);
        // 持久化
        if (currentProject?.id && slides[modalPageIndex]) {
          imageService.save(currentProject.id, slides[modalPageIndex].id, modalPageIndex, result.imageUrl).catch(console.error);
        }
        const { useToast } = await import('@/lib/toast');
        useToast.getState().show('success', '图片已更新');
      } else {
        const { useToast } = await import('@/lib/toast');
        useToast.getState().show('error', result.error || '生成失败');
      }
    } catch (error) {
      console.error('重生成失败:', error);
      const { useToast } = await import('@/lib/toast');
      useToast.getState().show('error', '生成失败，请重试');
    } finally {
      setIsRegenerating(false);
    }
  };

  /** 批量生成所有页的 AI 预览图 */
  const generateAllImages = async () => {
    setIsGenerating(true);
    setProgress({ current: 0, total: slides.length });
    let successCount = 0;
    for (let i = 0; i < slides.length; i++) {
      setProgress({ current: i + 1, total: slides.length });
      try {
        const prompt = buildSlidePrompt(i);
        const result = await generateImage({ prompt, size: '1792x1024' });
        if (result.success && result.imageUrl) {
          setSlideImages(prev => ({ ...prev, [i]: result.imageUrl! }));
          successCount++;
          // 持久化到 IndexedDB
          if (currentProject?.id && slides[i]) {
            imageService.save(currentProject.id, slides[i].id, i, result.imageUrl).catch(console.error);
          }
        }
      } catch (e) {
        console.error(`第 ${i + 1} 页生成失败:`, e);
      }
    }
    setIsGenerating(false);
    setProgress({ current: 0, total: 0 });
    const { useToast } = await import('@/lib/toast');
    useToast.getState().show('success', `生成完成：${successCount}/${slides.length} 页`);
  };

  const exportToPPTX = async () => {
    if (!currentProject?.pptJson) return;

    setIsGenerating(true);
    setExporting(true);
    const { pptJson } = currentProject;

    try {
      const renderSpecForCheck = buildRenderSpec(
        pptJson,
        (currentStyleKit || currentProject.styleConfig) as StyleKit
      );
      const { pptJson: fixedPPTJson, result: fixResult } = autoFixPPTJson(
        pptJson,
        renderSpecForCheck.issues
      );

      const slideRoles = new Map<string, string>();
      if (currentProject.deckPlan) {
        for (const plan of currentProject.deckPlan.slidePlans) {
          slideRoles.set(plan.id, plan.role);
        }
      }

      const styleSource = currentStyleKit || currentProject.styleConfig;
      if (!styleSource) {
        const { useToast } = await import('@/lib/toast');
        useToast.getState().show('error', '缺少样式配置');
        return;
      }

      const renderSpec = buildRenderSpec(
        fixedPPTJson,
        styleSource as StyleKit,
        slideRoles as Map<string, string> as any
      );

      const warnings = await exportRenderSpecToPPTX(renderSpec, {
        fileName: `${pptJson.metadata.title}.pptx`,
        onProgress: (current, total) => setProgress({ current, total }),
      });

      const { useToast } = await import('@/lib/toast');
      const fixMsg = fixResult.fixed > 0 ? `（自动修复了 ${fixResult.fixed} 个问题）` : '';
      const warningMsg = warnings.length > 0 ? `（${warnings.length} 个图片警告）` : '';
      if (warnings.length > 0) {
        useToast.getState().show('warning', `PPT 导出完成${fixMsg}${warningMsg}`);
      } else {
        useToast.getState().show('success', `PPT 导出成功${fixMsg}${warningMsg}`);
      }
      if (warnings.length > 0) {
        console.warn('PPT 导出警告:', warnings);
      }
    } catch (error) {
      console.error('导出失败:', error);
      const { useToast } = await import('@/lib/toast');
      useToast.getState().show('error', '导出失败，请重试');
    } finally {
      setIsGenerating(false);
      setExporting(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const exportJSON = () => {
    if (!currentProject?.pptJson) return;
    const json = JSON.stringify(currentProject.pptJson, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject.pptJson.metadata.title}.json`;
    a.click();
    // 延迟回收，给浏览器足够时间完成下载
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const copyShareLink = async () => {
    const link = `${window.location.origin}/projects/${currentProject?.id}`;
    try {
      await navigator.clipboard.writeText(link);
      const { useToast } = await import('@/lib/toast');
      useToast.getState().show('success', '分享链接已复制');
    } catch {
      const { useToast } = await import('@/lib/toast');
      useToast.getState().show('error', '复制失败，请重试');
    }
  };

  const handleExportPDF = async () => {
    // PDF 功能降级：提供复制内容替代方案
    if (!currentProject?.pptJson) return;
    const { useToast } = await import('@/lib/toast');
    const slides = currentProject.pptJson.slides;
    const contentText = slides
      .map((s, i) => `【第 ${i + 1} 页】${s.title}\n${s.content?.map(c => c.content).join('\n') || ''}`)
      .join('\n\n');

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(contentText);
        useToast.getState().show('success', 'PPT 内容已复制到剪贴板，可粘贴到 Word 或其他工具');
        return;
      } catch {
        // fallback: download as txt
      }
    }
    // fallback: 下载为 txt 文件
    const blob = new Blob([contentText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject.pptJson.metadata.title || 'PPT内容'}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
    useToast.getState().show('success', '内容已下载为 TXT 文件');
  };

  if (slides.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">没有可预览的内容</p>
      </div>
    );
  }

  const currentSlide = slides[currentIndex];
  // 该页如果有 AI 图片优先显示
  const activeImageUrl = slideImages[currentIndex] || null;

  return (
    <div className={`h-screen flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Top bar */}
      <div className={`border-b p-4 flex items-center justify-between ${isFullscreen ? 'hidden' : ''}`}>
        <h2 className="text-xl font-bold">预览与导出</h2>
        <div className="hidden md:flex gap-2">
          <button
            onClick={generateAllImages}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            <Image size={20} />
            {isGenerating ? `AI 生图中 ${progress.current}/${progress.total}` : 'AI 批量生图'}
          </button>
          <button
            onClick={exportJSON}
            className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50"
          >
            <Download size={20} />
            导出 JSON
          </button>
          <button
            onClick={exportToPPTX}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <Download size={20} />
            {isGenerating ? `导出中 ${progress.current}/${progress.total}` : '导出 PPTX'}
          </button>
          <button
            onClick={handleExportPDF}
            disabled={true}
            className="flex items-center gap-2 px-4 py-2 border rounded text-gray-400 cursor-not-allowed hover:bg-gray-50"
          >
            <Download size={20} />
            导出 PDF
          </button>
          <button
            onClick={copyShareLink}
            className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50"
          >
            <Share2 size={20} />
            分享
          </button>
        </div>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50"
        >
          {isDarkMode ? '☀️' : '🌙'}
          {isDarkMode ? '浅色预览' : '深色预览'}
        </button>
        <button
          onClick={toggleFullscreen}
          className="md:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center border rounded hover:bg-gray-50"
          aria-label={isFullscreen ? '退出全屏' : '全屏预览'}
        >
          {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
      </div>

      {/* Slide preview area */}
      <div
        className={`flex-1 flex items-center justify-center p-4 md:p-8 relative transition-colors ${
          isDarkMode ? 'bg-[#1a1a2e]' : 'bg-gray-100'
        }`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* AI 生成图片优先显示 */}
        {activeImageUrl ? (
          <div className="relative max-w-4xl w-full">
            <img
              src={activeImageUrl}
              alt={`第${currentIndex + 1}页 AI 生成图`}
              className="w-full rounded-lg shadow-lg"
            />
            <button
              onClick={() => openRegenModal(currentIndex)}
              className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur rounded-full text-sm font-medium text-gray-700 hover:bg-white shadow-md border transition-all"
            >
              <RefreshCw size={14} />
              重生成
            </button>
          </div>
        ) : (
          <SlidePreview
            slide={currentSlide}
            styleKit={currentStyleKit}
            styleConfig={currentProject?.styleConfig}
            className="max-w-4xl w-full shadow-lg"
          />
        )}

        {/* 左下角：重生成按钮（当没有AI图片时显示） */}
        {!activeImageUrl && (
          <button
            onClick={() => openRegenModal(currentIndex)}
            className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 shadow-md transition-all"
          >
            <Image size={14} />
            AI 生成预览图
          </button>
        )}
      </div>

      {/* Bottom navigation */}
      <div className={`border-t p-4 flex items-center justify-between ${isFullscreen ? 'hidden' : ''}`}>
        <button
          onClick={prevSlide}
          disabled={currentIndex === 0}
          className="flex items-center gap-2 px-4 py-3 min-h-[44px] border rounded hover:bg-gray-50 disabled:opacity-50"
        >
          <ChevronLeft size={20} />
          <span className="hidden sm:inline">上一页</span>
        </button>

        <div className="flex flex-col items-center gap-1">
          <span className="text-gray-600 text-sm">
            {currentIndex + 1} / {slides.length}
          </span>
          {/* 页码指示器（可点击切换） */}
          <div className="flex gap-1 flex-wrap max-w-xs justify-center">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentIndex ? 'bg-blue-600 w-4' : slideImages[i] ? 'bg-green-500' : 'bg-gray-300'
                }`}
                aria-label={`第${i + 1}页`}
              />
            ))}
          </div>
        </div>

        <button
          onClick={nextSlide}
          disabled={currentIndex === slides.length - 1}
          className="hidden md:flex items-center gap-2 px-4 py-3 min-h-[44px] border rounded hover:bg-gray-50 disabled:opacity-50"
        >
          下一页
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 导出加载遮罩 */}
      {exporting && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center min-w-[320px]">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-[#e2e8f0] border-t-[#1e40af] animate-spin" />
            <h3 className="text-lg font-bold text-[#0f172a] mb-2">正在导出 PPTX...</h3>
            <p className="text-sm text-[#64748b] mb-4">正在生成幻灯片，请稍候</p>
            {progress.total > 0 && (
              <div className="space-y-2">
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#1e40af] h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-[#94a3b8]">
                  {progress.current} / {progress.total}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 重生成弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold">重生成第 {modalPageIndex + 1} 页</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-full hover:bg-gray-100 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* 预览图 */}
            {previewUrl && (
              <div className="px-6 pt-4">
                <img
                  src={previewUrl}
                  alt="当前预览"
                  className="w-full rounded-lg border"
                />
              </div>
            )}

            {/* Prompt 编辑 */}
            <div className="px-6 py-4 space-y-3">
              <label className="text-sm font-medium text-gray-700">生图 Prompt（可修改）</label>
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                rows={5}
                className="w-full p-3 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="描述这页应该呈现的样子..."
              />
            </div>

            {/* 操作按钮 */}
            <div className="px-6 py-4 flex justify-end gap-3 border-t bg-gray-50">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border rounded hover:bg-gray-100 text-sm"
              >
                取消
              </button>
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating || !editPrompt.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {isRegenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    重新生成
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}