'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@/lib/store';
import OutlineTree from './OutlineTree';
import SlideEditor from './SlideEditor';
import ElementCanvas from './ElementCanvas';
import PropertyPanel from './PropertyPanel';
import AssetLibrary from './AssetLibrary';
import ResidualValidator from './ResidualValidator';
import VersionHistory from './VersionHistory';
import AiEditPanel from './AiEditPanel';
import EditStepToolbar, { type EditMode } from './EditStepToolbar';
import { Slide, PPTJson, ContentBlock } from '@/types';
import { versionService } from '@/lib/db';
import { resolveProjectStyleConfig } from '@/lib/style-bridge';
import { createUpdateTextPatch, createMovePatch, createResizePatch, createDeleteElementPatch, createAddElementPatch } from '@/lib/edit-patch';
import { autoFixSlideRealtime } from '@/lib/auto-fixer';

export default function EditStep({ initialMode = 'content' }: { initialMode?: EditMode }) {
  const {
    currentProject, currentStyleKit, updatePPTJson, setCurrentStep,
    pushPatch, undo, redo, canUndo, canRedo,
  } = useStore();
  const resolvedStyleConfig = resolveProjectStyleConfig(currentProject, currentStyleKit);

  // 核心状态
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideId, setCurrentSlideId] = useState<string>('');
  const [editMode, setEditMode] = useState<EditMode>(initialMode);
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);

  // 面板开关
  const [isAssetLibraryOpen, setIsAssetLibraryOpen] = useState(false);
  const [isAiEditOpen, setIsAiEditOpen] = useState(false);
  const [isResidualPanelOpen, setIsResidualPanelOpen] = useState(false);
  const [showLayoutGuide, setShowLayoutGuide] = useState(true);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // 生成中状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ stage: '', progress: 0 });
  const versionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentSlide = slides.find((s) => s.id === currentSlideId);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((isMod && e.key === 'z' && e.shiftKey) || (isMod && e.key === 'y')) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // 初始化或生成 PPT
  useEffect(() => {
    if (currentProject?.pptJson) {
      const fixedSlides = currentProject.pptJson.slides.map((s) => {
        const { slide } = autoFixSlideRealtime(s);
        return slide;
      });
      setSlides(fixedSlides);
      if (fixedSlides.length > 0) setCurrentSlideId(fixedSlides[0].id);
    } else if (resolvedStyleConfig && currentProject?.userInput) {
      generatePPT();
    }
  }, [currentProject, resolvedStyleConfig]);

  // ---- 操作函数 ----

  const generatePPT = async () => {
    if (!resolvedStyleConfig || !currentProject?.userInput) return;
    setIsGenerating(true);
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 120_000);
    try {
      const res = await fetch('/api/generate-stream', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ styleConfig: resolvedStyleConfig, styleKit: currentStyleKit, userInput: currentProject.userInput }),
        signal: abort.signal,
      });
      if (!res.ok) throw new Error('生成失败');
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))) {
          try {
            const data = JSON.parse(line.slice(6));
            setProgress({ stage: data.stage, progress: data.progress });
            if (data.stage === 'complete' && data.data) {
              updatePPTJson(data.data);
              setSlides(data.data.slides);
              if (data.data.slides.length > 0) setCurrentSlideId(data.data.slides[0].id);
            }
          } catch { /* skip non-JSON lines */ }
        }
      }
    } catch (error) {
      console.error('生成失败:', error);
      const { useToast } = await import('@/lib/toast');
      if (error instanceof Error && error.name === 'AbortError') {
        useToast.getState().show('error', '生成超时，请检查网络后重试');
      } else {
        useToast.getState().show('error', '生成失败，请重试');
      }
      setCurrentStep(3);
    } finally {
      clearTimeout(timeout);
      setIsGenerating(false);
    }
  };

  const saveVersion = useCallback(async (pptJson: PPTJson) => {
    if (!currentProject?.id) return;
    if (versionTimerRef.current) clearTimeout(versionTimerRef.current);
    versionTimerRef.current = setTimeout(async () => {
      await versionService.save(currentProject.id, pptJson);
    }, 2000);
  }, [currentProject?.id]);

  const commitSlides = (newSlides: Slide[]) => {
    setSlides(newSlides);
    if (currentProject?.pptJson) {
      const newPPTJson = { ...currentProject.pptJson, slides: newSlides };
      updatePPTJson(newPPTJson);
      saveVersion(newPPTJson);
    }
  };

  const handleSlideUpdate = (updatedSlide: Slide) => {
    const { slide: fixed } = autoFixSlideRealtime(updatedSlide);
    commitSlides(slides.map(s => s.id === fixed.id ? fixed : s));
  };

  const handleBlockUpdate = (blockId: string, updates: Partial<ContentBlock>, action?: 'move' | 'resize') => {
    if (!currentSlide) return;
    const block = currentSlide.content.find(b => b.id === blockId);
    if (!block) return;
    if (updates.position) {
      pushPatch(action === 'resize'
        ? createResizePatch(currentSlide.id, blockId, block.position, updates.position)
        : createMovePatch(currentSlide.id, blockId, block.position, updates.position));
      return;
    }
    if (updates.content !== undefined && updates.content !== block.content) {
      pushPatch(createUpdateTextPatch(currentSlide.id, blockId, block.content, updates.content));
      return;
    }
    const updatedSlide = { ...currentSlide, content: currentSlide.content.map(b => b.id === blockId ? { ...b, ...updates } : b) };
    handleSlideUpdate(updatedSlide);
  };

  const handleBlockDelete = (blockId: string) => {
    if (!currentSlide) return;
    const block = currentSlide.content.find(b => b.id === blockId);
    if (block) pushPatch(createDeleteElementPatch(currentSlide.id, block));
  };

  const addSlide = () => {
    const newSlide: Slide = { id: crypto.randomUUID(), layout: 'content', title: '新幻灯片', mainConclusion: '', content: [] };
    const newSlides = [...slides, newSlide];
    setSlides(newSlides);
    setCurrentSlideId(newSlide.id);
    if (currentProject?.pptJson) {
      const newPPTJson = { ...currentProject.pptJson, slides: newSlides };
      updatePPTJson(newPPTJson);
      saveVersion(newPPTJson);
    }
  };

  const deleteSlide = () => {
    if (slides.length <= 1) return;
    const idx = slides.findIndex(s => s.id === currentSlideId);
    const newSlides = slides.filter(s => s.id !== currentSlideId);
    handleSlideUpdate(newSlides[Math.max(0, idx - 1)]);
    // Update state immediately for delete
    setSlides(newSlides);
    setCurrentSlideId(newSlides[Math.max(0, idx - 1)].id);
  };

  const generateImageForSlide = async () => {
    if (!currentSlide || !resolvedStyleConfig) return;
    setIsGeneratingImage(true);
    try {
      const res = await fetch('/api/generate-slide-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slide: currentSlide, styleConfig: resolvedStyleConfig, styleKit: currentStyleKit }),
      });
      if (!res.ok) throw new Error('生成失败');
      const data = await res.json();
      if (data.success && data.imageUrl) {
        const imgBlock: ContentBlock = {
          id: crypto.randomUUID(), type: 'image', content: data.imageUrl,
          position: { x: 0.1, y: 0.3, width: 0.8, height: 0.5 },
        };
        handleSlideUpdate({ ...currentSlide, content: [...currentSlide.content, imgBlock] });
        const { useToast } = await import('@/lib/toast');
        useToast.getState().show('success', '配图生成成功');
      }
    } catch (error) {
      console.error('生成配图失败:', error);
      const { useToast } = await import('@/lib/toast');
      useToast.getState().show('error', '生成配图失败');
    } finally { setIsGeneratingImage(false); }
  };

  const handleRestoreVersion = (pptJson: PPTJson | undefined) => {
    if (pptJson) {
      updatePPTJson(pptJson);
      setSlides(pptJson.slides);
      if (pptJson.slides.length > 0) setCurrentSlideId(pptJson.slides[0].id);
    }
  };

  const handleAssetSelect = (asset: { id: string; type: string; category: string; imageData: string }) => {
    if (!currentSlide) return;
    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type: asset.type === 'image' ? 'image' : asset.type === 'chart' ? 'chart' : 'text',
      content: asset.imageData || asset.category,
      position: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
    };
    pushPatch(createAddElementPatch(currentSlide.id, newBlock));
    setIsAssetLibraryOpen(false);
  };

  // 生成中加载页面
  if (isGenerating) {
    const stageText: Record<string, string> = { analyzing: '分析中...', translating: '转译中...', generating: '生成中...' };
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">{stageText[progress.stage] || '处理中...'}</p>
          <div className="w-64 h-2 bg-gray-200 rounded-full mt-4 mx-auto">
            <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progress.progress}%` }} />
          </div>
          <p className="text-sm text-gray-500 mt-2">{progress.progress}%</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <EditStepToolbar
        isOutlineOpen={isOutlineOpen}
        onToggleOutline={() => setIsOutlineOpen(!isOutlineOpen)}
        editMode={editMode}
        onEditModeChange={setEditMode}
        isAssetLibraryOpen={isAssetLibraryOpen}
        onToggleAssetLibrary={() => setIsAssetLibraryOpen(!isAssetLibraryOpen)}
        isAiEditOpen={isAiEditOpen}
        onToggleAiEdit={() => setIsAiEditOpen(!isAiEditOpen)}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        showLayoutGuide={showLayoutGuide}
        onToggleLayoutGuide={() => setShowLayoutGuide(!showLayoutGuide)}
        isResidualPanelOpen={isResidualPanelOpen}
        onToggleResidual={() => setIsResidualPanelOpen(!isResidualPanelOpen)}
        onAddSlide={addSlide}
        onDeleteSlide={deleteSlide}
        onGenerateImage={generateImageForSlide}
        isGeneratingImage={isGeneratingImage}
        slidesCount={slides.length}
        versionHistoryComponent={
          currentProject?.id ? (
            <VersionHistory projectId={currentProject.id} onRestore={handleRestoreVersion} />
          ) : undefined
        }
      />

      {/* 移动端大纲遮罩 */}
      {isOutlineOpen && (
        <div className="md:hidden fixed inset-0 z-10 bg-black/50" onClick={() => setIsOutlineOpen(false)} />
      )}

      {/* 主体：三栏布局 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧大纲 */}
        <div className={`w-64 flex-shrink-0 md:block ${isOutlineOpen ? 'block' : 'hidden'} relative z-20 bg-white border-r overflow-y-auto`}>
          <OutlineTree
            slides={slides}
            currentSlideId={currentSlideId}
            onSlideSelect={(id) => { setCurrentSlideId(id); setIsOutlineOpen(false); }}
            onReorder={(newSlides) => commitSlides(newSlides)}
          />
        </div>

        {/* 中央编辑区 */}
        <div className="flex-1 min-w-0 overflow-auto">
          {currentSlide && (
            <>
              {editMode === 'content' && (
                <SlideEditor slide={currentSlide} onUpdate={handleSlideUpdate} />
              )}
              {editMode === 'element' && (
                <div className="flex h-full">
                  <div className="flex-1 p-4 overflow-auto">
                    <ElementCanvas
                      slide={currentSlide}
                      onUpdate={handleBlockUpdate}
                      styleKit={currentStyleKit}
                      slideRole={currentProject?.deckPlan?.slidePlans.find(p => p.id === currentSlideId)?.role || 'content'}
                      showLayoutGuide={showLayoutGuide}
                    />
                  </div>
                  <div className="w-72 hidden lg:block flex-shrink-0 border-l overflow-y-auto">
                    <PropertyPanel
                      slideId={currentSlide.id}
                      blocks={currentSlide.content}
                      onUpdate={handleBlockUpdate}
                      onDelete={handleBlockDelete}
                    />
                  </div>
                </div>
              )}
              {editMode === 'preview' && (
                <div className="flex items-center justify-center bg-gray-100 p-8 min-h-full">
                  <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl aspect-video p-8 overflow-auto">
                    <h1 className="text-3xl font-bold mb-4">{currentSlide.title}</h1>
                    <p className="text-lg italic text-gray-600 mb-6">{currentSlide.mainConclusion}</p>
                    <div className="space-y-4">
                      {currentSlide.content.map(block => (
                        <div key={block.id} className="text-base">{block.content}</div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 右侧质量检查（桌面端） */}
        {isResidualPanelOpen && currentProject?.pptJson && (
          <div className="w-80 flex-shrink-0 hidden lg:block border-l bg-white overflow-y-auto">
            <ResidualValidator
              pptJson={currentProject.pptJson}
              onIssueClick={(slideId, elementId) => {
                setCurrentSlideId(slideId);
                if (elementId) setEditMode('element');
              }}
            />
          </div>
        )}
      </div>

      {/* 浮动面板 */}
      <AssetLibrary
        isOpen={isAssetLibraryOpen}
        onClose={() => setIsAssetLibraryOpen(false)}
        onAssetSelect={handleAssetSelect}
        projectId={currentProject?.id}
      />

      {isAiEditOpen && currentSlide && currentProject?.pptJson && (
        <div className="fixed bottom-24 right-4 w-96 z-50">
          <AiEditPanel
            currentSlide={currentSlide}
            pptJson={currentProject.pptJson}
            onApplyPatch={(patch) => { pushPatch(patch); setIsAiEditOpen(false); }}
            onClose={() => setIsAiEditOpen(false)}
          />
        </div>
      )}

      {/* 底部导航 */}
      <div className="border-t p-4 flex gap-4">
        <button onClick={() => setCurrentStep(3)} className="px-4 py-3 min-h-[44px] border rounded hover:bg-gray-50">上一步</button>
        <button onClick={() => setCurrentStep(5)} className="flex-1 px-4 py-3 min-h-[44px] bg-blue-600 text-white rounded hover:bg-blue-700">下一步：生成预览</button>
      </div>
    </div>
  );
}
