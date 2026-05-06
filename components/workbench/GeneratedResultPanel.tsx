'use client';

import { useState, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { Eye, Edit3, Loader2, Download, Maximize2, RefreshCw, CheckCircle2, History, FileText } from 'lucide-react';
import { exportWorkbenchToPPTX } from '@/lib/export-workbench-pptx';
import type { GenSlideResultSnapshot } from '@/types';

export default function GeneratedResultPanel() {
  const store = useStore();
  const {
    generatedSlideResults,
    generatedSlidePrompts,
    selectedNewSlideIndex,
    addWorkbenchMessage,
    upsertGeneratedSlideResult,
    updateGeneratedSlidePrompt,
    assetLibrary,
    extractedDocumentText,
    currentStyleKit,
    currentProject,
    referenceSlidePrompts,
    masterTemplate,
  } = store;
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);

  const selectedPrompt = generatedSlidePrompts.find(
    (p) => p.index === selectedNewSlideIndex
  );
  const selectedResult = generatedSlideResults.find(
    (r) => r.slideIndex === selectedNewSlideIndex
  );

  const versions = selectedResult?.previousVersions || [];
  const currentVersion = selectedResult?.version || 1;
  const viewingSnapshot = historyIndex !== null ? versions[historyIndex] : null;

  const handleAiTweak = () => {
    if (!selectedPrompt) return;
    const msg = `请微调第 ${selectedPrompt.index} 页「${selectedPrompt.title}」的样式：`;
    addWorkbenchMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: msg,
      timestamp: Date.now(),
    });
  };

  const handleRegenerate = useCallback(async () => {
    if (!selectedPrompt || regenerating) return;
    setRegenerating(true);
    updateGeneratedSlidePrompt(selectedPrompt.index, { status: 'generating' });

    try {
      const res = await fetch('/api/generate-slide-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompts: [selectedPrompt],
          assetLibrary,
          extractedDocumentText,
          styleKit: currentStyleKit,
          styleConfig: currentProject?.styleConfig,
          referenceSlidePrompts,
          masterTemplate,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const results = json.data?.results || [];
        if (results.length > 0) {
          const r = results[0];
          upsertGeneratedSlideResult({
            slideId: crypto.randomUUID(),
            slideIndex: r.index,
            pptJsonSlide: r.slide,
            previewImage: r.imageBase64,
            status: 'generated',
            tweakNote: selectedPrompt.contentGoal,
          });
          updateGeneratedSlidePrompt(r.index, { status: 'generated' });
        }
      } else {
        updateGeneratedSlidePrompt(selectedPrompt.index, { status: 'pending' });
      }
    } catch {
      updateGeneratedSlidePrompt(selectedPrompt.index, { status: 'pending' });
    } finally {
      setRegenerating(false);
      setHistoryIndex(null);
    }
  }, [selectedPrompt, regenerating, updateGeneratedSlidePrompt, upsertGeneratedSlideResult, assetLibrary, extractedDocumentText, currentStyleKit, currentProject, referenceSlidePrompts, masterTemplate]);

  const handleConfirm = useCallback(() => {
    if (!selectedResult) return;
    upsertGeneratedSlideResult({ ...selectedResult, status: 'confirmed' });
    updateGeneratedSlidePrompt(selectedResult.slideIndex, { status: 'confirmed' });
  }, [selectedResult, upsertGeneratedSlideResult, updateGeneratedSlidePrompt]);

  const handleRollback = useCallback((snapshot: GenSlideResultSnapshot) => {
    if (!selectedResult) return;
    upsertGeneratedSlideResult({
      slideId: snapshot.slideId,
      slideIndex: selectedResult.slideIndex,
      pptJsonSlide: snapshot.pptJsonSlide,
      previewImage: snapshot.previewImage,
      status: 'generated',
      tweakNote: snapshot.tweakNote,
    });
    setHistoryIndex(null);
    setShowHistory(false);
  }, [selectedResult, upsertGeneratedSlideResult]);

  const resultsCount = generatedSlideResults.filter((r) => r.status === 'generated' || r.status === 'confirmed').length;

  // Display image: either from history snapshot or current result
  const displayImage = viewingSnapshot?.previewImage || selectedResult?.previewImage;
  const displayTitle = viewingSnapshot?.pptJsonSlide?.title || selectedResult?.pptJsonSlide?.title;

  return (
    <>
      <PanelWrapper title={`生成结果${resultsCount > 0 ? ` (${resultsCount})` : ''}`}>
        {!selectedPrompt ? (
          <div className="flex flex-1 items-center justify-center bg-[#f8fafc] p-4 text-center">
            <div className="w-full rounded-[22px] border border-dashed border-[#cbd5e1] bg-white p-6 shadow-sm">
              <Eye size={30} className="mx-auto mb-3 text-[#94a3b8]" />
              <p className="text-sm font-semibold text-[#0f172a]">等待查看生成结果</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#64748b]">在左侧选择某一页 Prompt 并生成后，这里会展示结果预览与操作入口。</p>
            </div>
          </div>
        ) : selectedResult ? (
          <div className="flex-1 overflow-y-auto bg-[#f8fafc] p-3 space-y-3">
            {/* Preview image with zoom */}
            <div className="overflow-hidden rounded-2xl border border-[#dbeafe] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                <div>
                  <p className="text-xs font-semibold text-[#0f172a]">
                    第 {selectedResult.slideIndex} 页
                    {viewingSnapshot ? ` · v${viewingSnapshot.version}` : ` · v${currentVersion}`}
                  </p>
                  <p className="text-[10px] text-[#64748b]">
                    {viewingSnapshot ? '历史版本预览（可回滚）' : '可微调或确认结果'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {versions.length > 0 && (
                    <button
                      onClick={() => { setShowHistory(!showHistory); setHistoryIndex(null); }}
                      className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] transition-colors ${
                        showHistory ? 'border-[#6366f1] bg-[#eef2ff] text-[#4338ca]' : 'border-[#e2e8f0] text-[#64748b] hover:bg-gray-50'
                      }`}
                    >
                      <History size={10} />
                      {versions.length}
                    </button>
                  )}
                  <StatusChip status={selectedResult.status} />
                </div>
              </div>
              <div className="aspect-video bg-white flex items-center justify-center overflow-hidden relative group">
                {displayImage ? (
                  <>
                    <img
                      src={displayImage}
                      alt={`生成结果 第 ${selectedResult.slideIndex} 页`}
                      className={`w-full h-full object-cover ${viewingSnapshot ? 'opacity-80' : ''}`}
                    />
                    {viewingSnapshot && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                        <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[#4338ca] shadow">
                          v{viewingSnapshot.version} 历史预览
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() => setZoomImage(displayImage || null)}
                      title="放大查看生成结果"
                      className="absolute top-1 right-1 p-1 bg-black/40 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Maximize2 size={12} />
                    </button>
                  </>
                ) : (
                  <div className="text-center">
                    <Loader2 size={20} className="animate-spin text-[#1e40af] mx-auto mb-1" />
                    <p className="text-xs text-gray-400">渲染中...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Version history strip */}
            {showHistory && versions.length > 0 && (
              <div className="rounded-2xl border border-[#c7d2fe] bg-[#eef2ff] p-2.5 shadow-sm">
                <p className="text-[10px] font-medium text-[#4338ca] mb-2">版本历史 ({versions.length} 个旧版本)</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {versions.map((snap, idx) => (
                    <button
                      key={snap.slideId + snap.version}
                      onClick={() => setHistoryIndex(historyIndex === idx ? null : idx)}
                      className={`flex-shrink-0 rounded-xl border overflow-hidden transition-all ${
                        historyIndex === idx
                          ? 'border-[#6366f1] ring-2 ring-[#c7d2fe] shadow-md'
                          : 'border-[#e2e8f0] hover:border-[#a5b4fc]'
                      }`}
                    >
                      {snap.previewImage ? (
                        <img src={snap.previewImage} alt={`v${snap.version}`} className="w-20 h-12 object-cover" />
                      ) : (
                        <div className="w-20 h-12 bg-gray-100 flex items-center justify-center text-[9px] text-gray-400">无预览</div>
                      )}
                      <div className="px-1.5 py-1 bg-white text-center">
                        <span className="text-[9px] font-medium text-[#334155]">v{snap.version}</span>
                      </div>
                    </button>
                  ))}
                </div>
                {viewingSnapshot && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleRollback(viewingSnapshot)}
                      className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-[#4338ca] px-3 py-1.5 text-[10px] text-white hover:bg-[#3730a3]"
                    >
                      <RefreshCw size={10} />
                      回滚到 v{viewingSnapshot.version}
                    </button>
                    <button
                      onClick={() => setHistoryIndex(null)}
                      className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-[#c7d2fe] px-3 py-1.5 text-[10px] text-[#4338ca] hover:bg-white"
                    >
                      查看当前版本
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Slide info */}
            <div className="rounded-2xl border border-[#e2e8f0] bg-white p-3 text-xs shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">结果摘要</span>
                <span className="rounded-full bg-[#eff6ff] px-2 py-0.5 text-[10px] text-[#1d4ed8]">Prompt {selectedPrompt.index}</span>
              </div>
              {selectedResult.pptJsonSlide && (
                <>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {displayTitle}
                  </p>
                  {selectedResult.pptJsonSlide.mainConclusion && (
                    <p className="text-[11px] leading-relaxed text-gray-500">
                      {selectedResult.pptJsonSlide.mainConclusion}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Actions */}
            <div className="rounded-2xl border border-[#e2e8f0] bg-white p-3 shadow-sm space-y-2">
              <p className="text-[10px] font-medium text-[#64748b]">后续操作</p>
              <div className="flex gap-2">
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#eff6ff] px-3 py-2 text-[11px] text-[#1e40af] hover:bg-[#dbeafe] transition-colors disabled:opacity-40"
                >
                  {regenerating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  {regenerating ? '生成中...' : '重新生成'}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={selectedResult.status === 'confirmed'}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-40"
                >
                  <CheckCircle2 size={12} />
                  {selectedResult.status === 'confirmed' ? '已确认' : '确认'}
                </button>
              </div>
              <button
                onClick={handleAiTweak}
                className="w-full flex items-center gap-1.5 rounded-xl border border-[#e2e8f0] px-3 py-2 text-[11px] text-gray-600 hover:text-[#1e40af] hover:bg-gray-50 transition-colors"
              >
                <Edit3 size={12} />
                AI 微调（发送到对话）
              </button>
              <div className="flex gap-2">
                {selectedResult.previewImage && (
                  <button
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = selectedResult.previewImage!;
                      a.download = `slide-${selectedResult.slideIndex}.png`;
                      a.click();
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#e2e8f0] px-3 py-2 text-[11px] text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Download size={12} />
                    下载图片
                  </button>
                )}
                <button
                  onClick={async () => {
                    try {
                      await exportWorkbenchToPPTX(
                        [selectedResult],
                        generatedSlidePrompts,
                        { fileName: `slide-${selectedResult.slideIndex}`, masterTemplate: store.masterTemplate },
                      );
                    } catch (err) {
                      console.error('[ExportPPTX] single slide failed', err);
                      alert('导出失败，请重试');
                    }
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1e40af] px-3 py-2 text-[11px] text-white hover:bg-[#1e40af]/90 transition-colors"
                >
                  <Download size={12} />
                  导出此页 PPTX
                </button>
              </div>
            </div>

            {/* Batch export summary */}
            {generatedSlideResults.filter(r => r.status === 'generated' || r.status === 'confirmed').length > 1 && (
              <div className="rounded-2xl border border-[#bfdbfe] bg-[#eff6ff] p-3 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-[#1d4ed8]">
                    共 {generatedSlideResults.filter(r => r.status === 'generated' || r.status === 'confirmed').length} 页已就绪
                  </p>
                  <button
                    onClick={async () => {
                      const ready = generatedSlideResults.filter(r => r.status === 'generated' || r.status === 'confirmed');
                      try {
                        await exportWorkbenchToPPTX(
                          ready,
                          generatedSlidePrompts,
                          { fileName: currentProject?.title || 'output', masterTemplate: store.masterTemplate },
                        );
                      } catch (err) {
                        console.error('[ExportPPTX] batch failed', err);
                        alert('批量导出失败，请重试');
                      }
                    }}
                    className="flex items-center gap-1 rounded-xl bg-[#1e40af] px-3 py-1.5 text-[10px] font-medium text-white hover:bg-[#1e40af]/90"
                  >
                    <Download size={10} />
                    全部导出 PPTX
                  </button>
                </div>
                <div className="flex w-full gap-1.5">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/export-editable-pptx', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            mode: 'structure',
                            prompts: generatedSlidePrompts,
                            results: generatedSlideResults.filter(r => r.status === 'generated' || r.status === 'confirmed'),
                            deckName: currentProject?.title || 'output',
                            fileName: currentProject?.title || 'editable-output',
                          }),
                        });
                        if (!res.ok) {
                          const err = await res.json().catch(() => ({ error: res.statusText }));
                          throw new Error(err.error || '导出失败');
                        }
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${currentProject?.title || 'editable-output'}.pptx`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch (err) {
                        console.error('[EditablePPTX] structure export failed', err);
                        alert(err instanceof Error ? err.message : '导出失败，请检查 Python 环境');
                      }
                    }}
                    className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-[#c7d2fe] bg-white px-2.5 py-1.5 text-[10px] font-medium text-[#4338ca] hover:bg-[#eef2ff] transition-colors"
                  >
                    <FileText size={10} />
                    可编辑 PPTX
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        addWorkbenchMessage({ id: `vision-export-${Date.now()}`, role: 'assistant', content: '正在用 Vision AI 识别页面元素，可能需要 30-60 秒...', timestamp: Date.now() });
                        const res = await fetch('/api/export-editable-pptx', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            mode: 'vision',
                            prompts: generatedSlidePrompts,
                            results: generatedSlideResults.filter(r => r.status === 'generated' || r.status === 'confirmed'),
                            deckName: currentProject?.title || 'output',
                            fileName: (currentProject?.title || 'vision-output') + '-vision',
                          }),
                        });
                        if (!res.ok) {
                          const err = await res.json().catch(() => ({ error: res.statusText }));
                          throw new Error(err.error || '视觉识别导出失败');
                        }
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${currentProject?.title || 'vision-output'}-vision.pptx`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch (err) {
                        console.error('[EditablePPTX] vision export failed', err);
                        alert(err instanceof Error ? err.message : '视觉识别导出失败');
                      }
                    }}
                    className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-[#a78bfa] bg-[#f5f3ff] px-2.5 py-1.5 text-[10px] font-medium text-[#6d28d9] hover:bg-[#ede9fe] transition-colors"
                  >
                    <Eye size={10} />
                    视觉识别导出
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center bg-[#f8fafc] p-4 text-center">
            <div className="w-full rounded-[22px] border border-dashed border-[#cbd5e1] bg-white p-6 shadow-sm">
              <Loader2 size={30} className={`mx-auto mb-3 ${selectedPrompt.status === 'generating' ? 'animate-spin text-[#2563eb]' : 'text-[#94a3b8]'}`} />
              <p className="text-sm font-semibold text-[#0f172a]">
                {selectedPrompt.status === 'pending'
                  ? '此页尚未生成'
                  : selectedPrompt.status === 'generating'
                    ? '正在生成该页结果'
                    : '等待结果同步'}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#64748b]">
                {selectedPrompt.status === 'pending'
                  ? '请先在左侧点击"生成此页"或批量生成。'
                  : selectedPrompt.status === 'generating'
                    ? '系统正在根据 Prompt 生成页面结果，请稍候。'
                    : '结果生成后会在这里展示。'}
              </p>
            </div>
          </div>
        )}
      </PanelWrapper>

      {/* Zoom modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
          onClick={() => setZoomImage(null)}
        >
          <button
            onClick={() => setZoomImage(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-sm"
          >
            Esc 关闭
          </button>
          <img
            src={zoomImage}
            alt="生成结果放大预览"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

function PanelWrapper({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <h3 className="text-xs font-semibold tracking-[0.02em] text-[var(--color-text-primary)]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const config: Record<string, string> = {
    generated: 'bg-green-100 text-green-700 border-green-200',
    editing: 'bg-amber-100 text-amber-700 border-amber-200',
    confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };
  const label: Record<string, string> = {
    generated: '已生成',
    editing: '编辑中',
    confirmed: '已确认',
  };
  return <span className={`rounded-full border px-2 py-1 text-[10px] font-medium ${config[status] || config.generated}`}>{label[status] || '已生成'}</span>;
}
