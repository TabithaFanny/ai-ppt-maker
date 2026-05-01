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
import { Slide, PPTJson, ContentBlock } from '@/types';
import { Plus, Trash2, PanelLeftClose, PanelLeft, Box, Layers, Eye, Library, Wand2, MapPin, Undo2, Redo2 } from 'lucide-react';
import { versionService } from '@/lib/db';
import { resolveProjectStyleConfig } from '@/lib/style-bridge';
import { createUpdateTextPatch, createMovePatch, createResizePatch, createDeleteElementPatch, createAddElementPatch } from '@/lib/edit-patch';
import { autoFixSlideRealtime } from '@/lib/auto-fixer';

type EditMode = 'content' | 'element' | 'preview';

interface EditStepProps {
  initialMode?: EditMode;
}

export default function EditStep({ initialMode = 'content' }: EditStepProps) {
  const { currentProject, currentStyleKit, updatePPTJson, setCurrentStep, pushPatch, undo, redo, canUndo, canRedo } = useStore();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideId, setCurrentSlideId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ stage: '', progress: 0 });
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [editMode, setEditMode] = useState<EditMode>(initialMode);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isAssetLibraryOpen, setIsAssetLibraryOpen] = useState(false);
  const [isResidualPanelOpen, setIsResidualPanelOpen] = useState(false);
  const [showLayoutGuide, setShowLayoutGuide] = useState(true);
  const [isAiEditOpen, setIsAiEditOpen] = useState(false);
  const resolvedStyleConfig = resolveProjectStyleConfig(currentProject, currentStyleKit);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (isMod && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (isMod && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Initialize slides from project or generate new PPT
  useEffect(() => {
    if (currentProject?.pptJson) {
      // 运行轻量级实时修复
      const fixedSlides = currentProject.pptJson.slides.map((s) => {
        const { slide, changed } = autoFixSlideRealtime(s);
        return changed ? slide : s;
      });
      setSlides(fixedSlides);
      if (fixedSlides.length > 0) {
        setCurrentSlideId(fixedSlides[0].id);
      }
    } else if (resolvedStyleConfig && currentProject?.userInput) {
      generateInitialPPT();
    }
  }, [currentProject, resolvedStyleConfig]);

  const generateInitialPPT = async () => {
    if (!resolvedStyleConfig || !currentProject?.userInput) return;

    setIsGenerating(true);
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 120_000); // 120s timeout

    try {
      const response = await fetch('/api/generate-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          styleConfig: resolvedStyleConfig,
          styleKit: currentStyleKit,
          userInput: currentProject.userInput,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) throw new Error('生成失败');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n').filter((line) => line.startsWith('data: '));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            setProgress({ stage: data.stage, progress: data.progress });

            if (data.stage === 'complete' && data.data) {
              updatePPTJson(data.data);
              setSlides(data.data.slides);
              if (data.data.slides.length > 0) {
                setCurrentSlideId(data.data.slides[0].id);
              }
            }
          } catch {
            // Skip non-JSON SSE lines (heartbeats, error messages, etc.)
            console.warn('SSE: skipped non-JSON line:', line.slice(0, 100));
          }
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
      clearTimeout(timeoutId);
      setIsGenerating(false);
    }
  };

  const handleSlideUpdate = (updatedSlide: Slide) => {
    // 轻量级实时修复（越界 clamp、空标题回退）
    const { slide: fixedSlide } = autoFixSlideRealtime(updatedSlide);
    const newSlides = slides.map((s) => (s.id === fixedSlide.id ? fixedSlide : s));
    setSlides(newSlides);
    if (currentProject?.pptJson) {
      const newPPTJson = { ...currentProject.pptJson, slides: newSlides };
      updatePPTJson(newPPTJson);
      saveVersion(newPPTJson);
    }
  };

  const handleBlockUpdate = (blockId: string, updates: Partial<ContentBlock>, action?: 'move' | 'resize') => {
    if (!currentSlide) return;

    const block = currentSlide.content.find((b) => b.id === blockId);
    if (!block) return;

    // Position changes → move or resize patch
    if (updates.position) {
      const patch = action === 'resize'
        ? createResizePatch(currentSlide.id, blockId, block.position, updates.position)
        : createMovePatch(currentSlide.id, blockId, block.position, updates.position);
      pushPatch(patch);
      return;
    }

    // Text content changes → text patch
    if (updates.content !== undefined && updates.content !== block.content) {
      const patch = createUpdateTextPatch(currentSlide.id, blockId, block.content, updates.content);
      pushPatch(patch);
      return;
    }

    // Other updates (style, etc.) — direct update for now
    const updatedSlide = {
      ...currentSlide,
      content: currentSlide.content.map((b) => (b.id === blockId ? { ...b, ...updates } : b)),
    };
    handleSlideUpdate(updatedSlide);
  };

  const handleBlockDelete = (blockId: string) => {
    if (!currentSlide) return;
    const block = currentSlide.content.find((b) => b.id === blockId);
    if (block) {
      const patch = createDeleteElementPatch(currentSlide.id, block);
      pushPatch(patch);
    }
  };

  const handleReorder = (newSlides: Slide[]) => {
    setSlides(newSlides);
    if (currentProject?.pptJson) {
      const newPPTJson = { ...currentProject.pptJson, slides: newSlides };
      updatePPTJson(newPPTJson);
      saveVersion(newPPTJson);
    }
  };

  const versionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveVersion = useCallback(async (pptJson: PPTJson) => {
    if (!currentProject?.id) return;
    // Debounce: only save after 2s of inactivity
    if (versionTimerRef.current) clearTimeout(versionTimerRef.current);
    versionTimerRef.current = setTimeout(async () => {
      await versionService.save(currentProject.id, pptJson);
    }, 2000);
  }, [currentProject?.id]);

  const handleRestoreVersion = (pptJson: PPTJson | undefined) => {
    if (pptJson) {
      updatePPTJson(pptJson);
      setSlides(pptJson.slides);
      if (pptJson.slides.length > 0) {
        setCurrentSlideId(pptJson.slides[0].id);
      }
    }
  };

  const addSlide = () => {
    const newSlide: Slide = {
      id: crypto.randomUUID(),
      layout: 'content',
      title: '新幻灯片',
      mainConclusion: '',
      content: [],
    };
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
    const index = slides.findIndex((s) => s.id === currentSlideId);
    const newSlides = slides.filter((s) => s.id !== currentSlideId);
    setSlides(newSlides);
    setCurrentSlideId(newSlides[Math.max(0, index - 1)].id);
    if (currentProject?.pptJson) {
      const newPPTJson = { ...currentProject.pptJson, slides: newSlides };
      updatePPTJson(newPPTJson);
      saveVersion(newPPTJson);
    }
  };

  const generateImageForSlide = async () => {
    if (!currentSlide || !resolvedStyleConfig) return;

    setIsGeneratingImage(true);
    try {
      const response = await fetch('/api/generate-slide-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slide: currentSlide,
          styleConfig: resolvedStyleConfig,
          styleKit: currentStyleKit,
        }),
      });

      if (!response.ok) throw new Error('生成图片失败');

      const data = await response.json();
      if (data.success && data.imageUrl) {
        // Add image block to current slide
        const imageBlock: ContentBlock = {
          id: crypto.randomUUID(),
          type: 'image',
          content: data.imageUrl,
          position: { x: 0.1, y: 0.3, width: 0.8, height: 0.5 },
        };
        const updatedSlide = {
          ...currentSlide,
          content: [...currentSlide.content, imageBlock],
        };
        handleSlideUpdate(updatedSlide);

        const { useToast } = await import('@/lib/toast');
        useToast.getState().show('success', '配图生成成功');
      }
    } catch (error) {
      console.error('生成配图失败:', error);
      const { useToast } = await import('@/lib/toast');
      useToast.getState().show('error', '生成配图失败，请重试');
    } finally {
      setIsGeneratingImage(false);
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
    const patch = createAddElementPatch(currentSlide.id, newBlock);
    pushPatch(patch);
    setIsAssetLibraryOpen(false);
  };

  const currentSlide = slides.find((s) => s.id === currentSlideId);

  if (isGenerating) {
    const stageText = {
      analyzing: '分析中...',
      translating: '转译中...',
      generating: '生成中...',
    }[progress.stage] || '处理中...';

    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{stageText}</p>
          <div className="w-64 h-2 bg-gray-200 rounded-full mt-4 mx-auto">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${progress.progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-500 mt-2">{progress.progress}%</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsOutlineOpen(!isOutlineOpen)}
            className="md:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center border rounded hover:bg-gray-50"
            aria-label={isOutlineOpen ? '收起大纲' : '展开大纲'}
          >
            {isOutlineOpen ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
          </button>
          <h2 className="text-xl font-bold">编辑内容</h2>

          {/* Edit mode tabs */}
          <div className="hidden md:flex items-center gap-1 ml-4 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setEditMode('content')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm ${
                editMode === 'content' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
              }`}
            >
              <Layers size={14} />
              内容
            </button>
            <button
              onClick={() => setEditMode('element')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm ${
                editMode === 'element' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
              }`}
            >
              <Box size={14} />
              元素
            </button>
            <button
              onClick={() => setEditMode('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm ${
                editMode === 'preview' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
              }`}
            >
              <Eye size={14} />
              预览
            </button>
          </div>
        </div>

        <div className="hidden md:flex gap-2">
          {/* Asset library toggle */}
          <button
            onClick={() => setIsAssetLibraryOpen(!isAssetLibraryOpen)}
            className={`flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50 ${
              isAssetLibraryOpen ? 'bg-blue-50 border-blue-300' : ''
            }`}
          >
            <Library size={20} />
            资源库
          </button>

          {/* AI Edit toggle */}
          <button
            onClick={() => setIsAiEditOpen(!isAiEditOpen)}
            className={`flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50 ${
              isAiEditOpen ? 'bg-purple-50 border-purple-300' : ''
            }`}
          >
            <Wand2 size={20} />
            AI 编辑
          </button>

          {/* Undo/Redo */}
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center border rounded hover:bg-gray-50 disabled:opacity-30"
            aria-label="撤销"
          >
            <Undo2 size={20} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center border rounded hover:bg-gray-50 disabled:opacity-30"
            aria-label="重做"
          >
            <Redo2 size={20} />
          </button>

          {/* Layout guide toggle */}
          <button
            onClick={() => setShowLayoutGuide(!showLayoutGuide)}
            className={`flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50 ${
              showLayoutGuide ? 'bg-green-50 border-green-300' : ''
            }`}
          >
            <MapPin size={20} />
            布局引导
          </button>

          {/* Residual validator toggle */}
          <button
            onClick={() => setIsResidualPanelOpen(!isResidualPanelOpen)}
            className={`flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50 ${
              isResidualPanelOpen ? 'bg-orange-50 border-orange-300' : ''
            }`}
          >
            <Eye size={20} />
            质量检查
          </button>

          {currentProject?.id && (
            <VersionHistory projectId={currentProject.id} onRestore={handleRestoreVersion} />
          )}
          <button
            onClick={addSlide}
            className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50"
          >
            <Plus size={20} />
            添加幻灯片
          </button>
          <button
            onClick={generateImageForSlide}
            disabled={!currentSlide || isGeneratingImage}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            <Wand2 size={20} />
            {isGeneratingImage ? '生成中...' : 'AI 配图'}
          </button>
          <button
            onClick={deleteSlide}
            disabled={slides.length <= 1}
            className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            <Trash2 size={20} />
            删除当前页
          </button>
        </div>
      </div>

      {/* Mobile toolbar */}
      <div className="md:hidden border-b p-2 flex gap-2">
        {/* Edit mode selector for mobile */}
        <select
          value={editMode}
          onChange={(e) => setEditMode(e.target.value as EditMode)}
          className="flex-1 px-3 py-2 border rounded"
        >
          <option value="content">内容编辑</option>
          <option value="element">元素编辑</option>
          <option value="preview">预览模式</option>
        </select>
        <button
          onClick={addSlide}
          className="flex-1 flex items-center justify-center gap-2 min-h-[44px] py-2 border rounded hover:bg-gray-50"
        >
          <Plus size={20} />
          添加
        </button>
        <button
          onClick={deleteSlide}
          disabled={slides.length <= 1}
          className="flex-1 flex items-center justify-center gap-2 min-h-[44px] py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
        >
          <Trash2 size={20} />
          删除
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile outline overlay */}
        {isOutlineOpen && (
          <div className="md:hidden absolute inset-0 z-10 bg-black/50" onClick={() => setIsOutlineOpen(false)} />
        )}

        {/* Left sidebar - Outline tree */}
        <div className={`w-64 md:block ${isOutlineOpen ? 'block' : 'hidden'} relative z-20 bg-white`}>
          <OutlineTree
            slides={slides}
            currentSlideId={currentSlideId}
            onSlideSelect={(id) => {
              setCurrentSlideId(id);
              setIsOutlineOpen(false);
            }}
            onReorder={handleReorder}
          />
        </div>

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          {currentSlide && (
            <>
              {/* Content mode: Original SlideEditor */}
              {editMode === 'content' && (
                <div className="flex-1">
                  <SlideEditor slide={currentSlide} onUpdate={handleSlideUpdate} />
                </div>
              )}

              {/* Element mode: Canvas + Property panel */}
              {editMode === 'element' && (
                <>
                  <div className="flex-1 p-4 overflow-auto">
                    <ElementCanvas
                      slide={currentSlide}
                      onUpdate={handleBlockUpdate}
                      styleKit={currentStyleKit}
                      slideRole={
                        currentProject?.deckPlan?.slidePlans.find(
                          (p) => p.id === currentSlideId
                        )?.role || 'content'
                      }
                      showLayoutGuide={showLayoutGuide}
                    />
                  </div>
                  <PropertyPanel
                    slideId={currentSlide.id}
                    blocks={currentSlide.content}
                    onUpdate={handleBlockUpdate}
                    onDelete={handleBlockDelete}
                  />
                </>
              )}

              {/* Preview mode: Simplified preview */}
              {editMode === 'preview' && (
                <div className="flex-1 flex items-center justify-center bg-gray-100 p-8">
                  <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl aspect-video p-8 overflow-auto">
                    <h1 className="text-3xl font-bold mb-4">{currentSlide.title}</h1>
                    <p className="text-lg italic text-gray-600 mb-6">{currentSlide.mainConclusion}</p>
                    <div className="space-y-4">
                      {currentSlide.content.map((block) => (
                        <div key={block.id} className="text-base">
                          {block.content}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right sidebar - Residual validator */}
        {isResidualPanelOpen && currentProject?.pptJson && (
          <div className="w-80 border-l bg-white overflow-y-auto">
            <ResidualValidator
              pptJson={currentProject.pptJson}
              onIssueClick={(slideId, elementId) => {
                setCurrentSlideId(slideId);
                if (elementId) {
                  setEditMode('element');
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Asset library drawer */}
      <AssetLibrary
        isOpen={isAssetLibraryOpen}
        onClose={() => setIsAssetLibraryOpen(false)}
        onAssetSelect={handleAssetSelect}
        projectId={currentProject?.id}
      />

      {/* AI Edit panel */}
      {isAiEditOpen && currentSlide && currentProject?.pptJson && (
        <div className="fixed bottom-24 right-4 w-96 z-50">
          <AiEditPanel
            currentSlide={currentSlide}
            pptJson={currentProject.pptJson}
            onApplyPatch={(patch) => {
              pushPatch(patch);
              setIsAiEditOpen(false);
            }}
            onClose={() => setIsAiEditOpen(false)}
          />
        </div>
      )}

      {/* Bottom bar */}
      <div className="border-t p-4 flex gap-4">
        <button
          onClick={() => setCurrentStep(3)}
          className="px-4 py-3 min-h-[44px] border rounded hover:bg-gray-50"
        >
          上一步
        </button>
        <button
          onClick={() => setCurrentStep(5)}
          className="flex-1 px-4 py-3 min-h-[44px] bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          下一步：生成预览
        </button>
      </div>
    </div>
  );
}
