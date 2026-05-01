'use client';

import { useState, useRef, TouchEvent } from 'react';
import { useStore } from '@/lib/store';
import { ChevronLeft, ChevronRight, Download, Share2, Maximize2, Minimize2 } from 'lucide-react';
import pptxgen from 'pptxgenjs';
import SlidePreview from './SlidePreview';
import { buildRenderSpec, getSlideBackground } from '@/lib/render-spec';
import { autoFixPPTJson } from '@/lib/auto-fixer';
import { exportRenderSpecToPPTX } from '@/lib/export-pptx';
import type { StyleKit } from '@/types';

export default function GenerateStep() {
  const { currentProject, currentStyleKit } = useStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const slides = currentProject?.pptJson?.slides || [];

  const nextSlide = () => setCurrentIndex((prev) => Math.min(prev + 1, slides.length - 1));
  const prevSlide = () => setCurrentIndex((prev) => Math.max(prev - 1, 0));

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
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

  const exportToPPTX = async () => {
    if (!currentProject?.pptJson) return;

    setIsGenerating(true);
    const { pptJson } = currentProject;

    try {
      // 1. Auto-fix 可修复问题
      const renderSpecForCheck = buildRenderSpec(
        pptJson,
        (currentStyleKit || currentProject.styleConfig) as StyleKit
      );
      const { pptJson: fixedPPTJson, result: fixResult } = autoFixPPTJson(
        pptJson,
        renderSpecForCheck.issues
      );

      if (fixResult.fixed > 0) {
        console.log(`Auto-fixed ${fixResult.fixed} issues`);
      }

      // 2. 获取 DeckPlan 的 slideRole 映射
      const slideRoles = new Map<string, string>();
      if (currentProject.deckPlan) {
        for (const plan of currentProject.deckPlan.slidePlans) {
          slideRoles.set(plan.id, plan.role);
        }
      }

      // 3. 构建 RenderSpec（使用修复后的 PPTJson）
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

      // 4. 导出
      await exportRenderSpecToPPTX(renderSpec, {
        fileName: `${pptJson.metadata.title}.pptx`,
        onProgress: (current, total) => setProgress({ current, total }),
      });

      const { useToast } = await import('@/lib/toast');
      const fixMsg = fixResult.fixed > 0 ? `（自动修复了 ${fixResult.fixed} 个问题）` : '';
      useToast.getState().show('success', `PPT 导出成功${fixMsg}`);
    } catch (error) {
      console.error('导出失败:', error);
      const { useToast } = await import('@/lib/toast');
      useToast.getState().show('error', '导出失败，请重试');
    } finally {
      setIsGenerating(false);
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
    URL.revokeObjectURL(url);
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

  if (slides.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">没有可预览的内容</p>
      </div>
    );
  }

  const currentSlide = slides[currentIndex];

  return (
    <div className={`h-screen flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Top bar */}
      <div className={`border-b p-4 flex items-center justify-between ${isFullscreen ? 'hidden' : ''}`}>
        <h2 className="text-xl font-bold">预览与导出</h2>
        <div className="hidden md:flex gap-2">
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
            onClick={copyShareLink}
            className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50"
          >
            <Share2 size={20} />
            分享
          </button>
        </div>
        <button
          onClick={toggleFullscreen}
          className="md:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center border rounded hover:bg-gray-50"
          aria-label={isFullscreen ? '退出全屏' : '全屏预览'}
        >
          {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
      </div>

      {/* Slide preview */}
      <div
        className="flex-1 flex items-center justify-center bg-gray-100 p-4 md:p-8"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <SlidePreview
          slide={currentSlide}
          styleKit={currentStyleKit}
          styleConfig={currentProject?.styleConfig}
          className="max-w-4xl w-full shadow-lg"
        />
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
        <div className="flex items-center gap-4">
          <span className="text-gray-600 text-sm">
            {currentIndex + 1} / {slides.length}
          </span>
          <div className="md:hidden flex gap-2">
            <button
              onClick={prevSlide}
              disabled={currentIndex === 0}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center border rounded hover:bg-gray-50 disabled:opacity-50"
              aria-label="上一页"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={nextSlide}
              disabled={currentIndex === slides.length - 1}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center border rounded hover:bg-gray-50 disabled:opacity-50"
              aria-label="下一页"
            >
              <ChevronRight size={20} />
            </button>
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
    </div>
  );
}
