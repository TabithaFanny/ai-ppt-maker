'use client';

import { useState, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { FileText, Loader2, Play, List, Zap, Check, Edit3, X, Sparkles } from 'lucide-react';
import type { GenSlidePrompt } from '@/types';

// Role badge with new types
const ROLE_BADGE_COLORS: Record<string, string> = {
  cover: 'bg-blue-100 text-blue-700', toc: 'bg-purple-100 text-purple-700',
  'section-header': 'bg-indigo-100 text-indigo-700', content: 'bg-gray-100 text-gray-600',
  'image-focus': 'bg-pink-100 text-pink-700', 'data-display': 'bg-green-100 text-green-700',
  quote: 'bg-yellow-100 text-yellow-700', comparison: 'bg-orange-100 text-orange-700',
  summary: 'bg-cyan-100 text-cyan-700', closing: 'bg-teal-100 text-teal-700',
  agenda: 'bg-violet-100 text-violet-700', background: 'bg-slate-100 text-slate-700',
  problem: 'bg-red-100 text-red-700', insight: 'bg-amber-100 text-amber-700',
  solution: 'bg-emerald-100 text-emerald-700', architecture: 'bg-sky-100 text-sky-700',
  feature: 'bg-rose-100 text-rose-700', workflow: 'bg-cyan-100 text-cyan-700',
  case: 'bg-lime-100 text-lime-700', data: 'bg-green-100 text-green-700',
  business: 'bg-fuchsia-100 text-fuchsia-700', team: 'bg-orange-100 text-orange-700',
};

type GenMode = 'single' | 'batch' | 'all';

const ROLE_LABELS: Record<string, string> = {
  cover: '封面', toc: '目录', 'section-header': '章节页', content: '内容页',
  'image-focus': '图片页', 'data-display': '数据页', quote: '引用页',
  comparison: '对比页', summary: '总结页', closing: '结束页',
  // AI PPT 助手新增角色
  agenda: '议程页', background: '背景页', problem: '问题页', insight: '洞察页',
  solution: '方案页', architecture: '架构页', feature: '功能页', workflow: '流程页',
  case: '案例页', data: '数据页', business: '商业页', team: '团队页',
};

export default function GeneratedPromptPanel() {
  const store = useStore();
  const {
    generatedSlidePrompts, selectedNewSlideIndex, setSelectedNewSlide,
    updateGeneratedSlidePrompt,
    assetLibrary, extractedDocumentText, currentStyleKit, currentProject, referenceSlidePrompts, masterTemplate,
  } = store;
  const [generating, setGenerating] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [checkList, setCheckList] = useState<number[]>([]);

  const selectedPrompt = generatedSlidePrompts.find(
    (p) => p.index === selectedNewSlideIndex
  );

  const toggleCheck = useCallback((index: number) => {
    setCheckList((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  }, []);

  const handleFieldEdit = useCallback(
    (index: number, field: string, value: string) => {
      updateGeneratedSlidePrompt(index, { [field]: value } as Partial<GenSlidePrompt>);
    },
    [updateGeneratedSlidePrompt]
  );

  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null);

  const handleGenerate = useCallback(
    async (mode: GenMode) => {
      const toGenerate =
        mode === 'all'
          ? generatedSlidePrompts.filter((p) => p.status !== 'generated' && p.status !== 'confirmed')
          : mode === 'batch'
            ? generatedSlidePrompts.filter((p) => checkList.includes(p.index))
            : selectedPrompt
              ? [selectedPrompt]
              : [];

      if (toGenerate.length === 0) return;

      setGenerating(true);
      const total = toGenerate.length;
      setGenProgress({ done: 0, total });

      // Process in batches of 2 to avoid API timeout on large decks
      const BATCH = 2;
      let done = 0;

      for (let bi = 0; bi < toGenerate.length; bi += BATCH) {
        const batch = toGenerate.slice(bi, bi + BATCH);

        for (const p of batch) {
          updateGeneratedSlidePrompt(p.index, { status: 'generating' });
        }

        try {
          const res = await fetch('/api/generate-slide-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompts: batch,
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
            for (const r of results) {
              store.upsertGeneratedSlideResult({
                slideId: crypto.randomUUID(),
                slideIndex: r.index,
                pptJsonSlide: r.slide,
                previewImage: r.imageBase64,
                status: 'generated',
              });
              updateGeneratedSlidePrompt(r.index, { status: 'generated' });
            }
            // Mark any missing results as pending
            for (const p of batch) {
              if (!results.find((r: { index: number }) => r.index === p.index)) {
                updateGeneratedSlidePrompt(p.index, { status: 'pending' });
              }
            }
          } else {
            for (const p of batch) {
              updateGeneratedSlidePrompt(p.index, { status: 'pending' });
            }
          }
        } catch {
          for (const p of batch) {
            updateGeneratedSlidePrompt(p.index, { status: 'pending' });
          }
        }

        done += batch.length;
        setGenProgress({ done, total });
        // Save after each batch
        store.saveWorkbench().catch(() => {});
      }

      setGenerating(false);
      setGenProgress(null);
    },
    [generatedSlidePrompts, selectedPrompt, checkList, updateGeneratedSlidePrompt, store, assetLibrary, extractedDocumentText, currentStyleKit, currentProject, referenceSlidePrompts, masterTemplate]
  );

  const hasCheckedBatch = checkList.length > 0;

  return (
    <PanelWrapper title={`新 PPT Prompt${generatedSlidePrompts.length > 0 ? ` · ${generatedSlidePrompts.length}页` : ''}`}>
      {generatedSlidePrompts.length > 0 ? (
        <>
          <div className="flex-1 overflow-y-auto bg-[#f8fafc]">
            <div className="border-b border-[var(--color-border)] bg-[#f8fafc] p-3">
              <div className="rounded-2xl border border-[#dbeafe] bg-white p-3 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-[#0f172a]">页面规划</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-[#64748b]">
                      先看摘要和状态，需要时再展开编辑完整 Prompt。
                    </p>
                  </div>
                  <span className="rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-2 py-1 text-[10px] font-medium text-[#1d4ed8]">
                    {generatedSlidePrompts.length} 页
                  </span>
                </div>
                {/* Deck progress bar */}
                {(() => {
                  const generated = generatedSlidePrompts.filter(p => p.status === 'generated' || p.status === 'confirmed').length;
                  const total = generatedSlidePrompts.length;
                  const pct = total > 0 ? Math.round((generated / total) * 100) : 0;
                  return total > 0 ? (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-[9px] text-[#64748b] mb-1">
                        <span>生成进度</span>
                        <span className="font-medium text-[#1d4ed8]">{generated}/{total} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#e2e8f0] overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-[#1e40af] transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Action bar */}
                <div className="flex gap-2">
              {/*
               * Global style banner — shown when any slide has globalStylePrompt
               * collapsed by default, expandable
               */}
              {generatedSlidePrompts.some((p) => p.globalStylePrompt) && (
                <details className="mb-1 w-full">
                  <summary className="list-none flex cursor-pointer items-center gap-1 rounded-xl bg-blue-50 px-2 py-2 text-[10px] text-blue-700">
                    <Sparkles size={9} />
                    全局风格 Prompt（{generatedSlidePrompts.filter((p) => p.globalStylePrompt).length} 页已设定）
                  </summary>
                  <div className="mt-2 rounded-xl bg-blue-50 p-2 text-[9px] leading-relaxed text-gray-500">
                    {generatedSlidePrompts.find((p) => p.globalStylePrompt)?.globalStylePrompt}
                  </div>
                </details>
              )}
                </div>
                <div className="mt-2 flex gap-2">
              <button
                onClick={() => handleGenerate('single')}
                disabled={!selectedPrompt || generating}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#1e40af] px-3 py-2 text-[10px] text-white shadow-[0_8px_18px_rgba(37,99,235,0.24)] transition-colors hover:bg-[#1e40af]/90 disabled:opacity-40"
              >
                {generating ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                生成此页
              </button>
              <button
                onClick={() => handleGenerate('batch')}
                disabled={!hasCheckedBatch || generating}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#1e40af]/85 px-3 py-2 text-[10px] text-white transition-colors hover:bg-[#1e40af]/75 disabled:opacity-40"
              >
                <List size={10} />
                批量 ({checkList.length})
              </button>
              <button
                onClick={() => handleGenerate('all')}
                disabled={generating || generatedSlidePrompts.length === 0}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-slate-700 px-3 py-2 text-[10px] text-white transition-colors hover:bg-slate-600 disabled:opacity-40"
              >
                {generating && genProgress ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                {genProgress ? `${genProgress.done}/${genProgress.total}` : '全部'}
              </button>
                </div>
              </div>
            </div>

            {/* Page list */}
            <div className="space-y-2 p-3">
              {generatedSlidePrompts.map((prompt) => (
                <div key={prompt.id}>
                  <div
                    onClick={() => setSelectedNewSlide(prompt.index)}
                    className={`w-full cursor-pointer rounded-xl border p-3 text-left transition-all ${
                      selectedNewSlideIndex === prompt.index
                        ? 'border-[#2563eb] bg-[#eff6ff] ring-1 ring-[#bfdbfe]'
                        : 'border-[#e2e8f0] bg-white hover:border-[#bfdbfe]'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {/* Checkbox for batch */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCheck(prompt.index);
                        }}
                        className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                          checkList.includes(prompt.index)
                            ? 'bg-[#1e40af] border-[#1e40af] text-white'
                            : 'border-gray-300'
                        }`}
                      >
                        {checkList.includes(prompt.index) && <Check size={8} />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="truncate text-xs font-semibold text-[#0f172a]">
                            {String(prompt.index).padStart(2, '0')} · {prompt.title}
                          </span>
                          <StatusBadge status={prompt.status} />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] text-gray-500">
                          <span className={`rounded-full px-2 py-0.5 ${ROLE_BADGE_COLORS[prompt.type] || 'bg-slate-100 text-slate-700'}`}>
                            {ROLE_LABELS[prompt.type] || prompt.type}
                          </span>
                          <span>{prompt.elements?.length || 0} 元素</span>
                          {Boolean(prompt.referenceSlideIds?.length) && (
                            <span>参考 P{prompt.referenceSlideIds.join('/P')}</span>
                          )}
                        </div>
                        {prompt.contentGoal && (
                          <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-[#475569]">
                            {prompt.contentGoal}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail view */}
                  {selectedNewSlideIndex === prompt.index && (
                    <div className="mt-2 space-y-3 rounded-xl border border-[#dbeafe] bg-white p-3">
                      {/* Title */}
                      <div>
                        <label className="text-[9px] text-gray-400">页面标题</label>
                        {editingField === `title-${prompt.index}` ? (
                          <div className="flex gap-1 mt-0.5">
                            <input
                              autoFocus
                              defaultValue={prompt.title}
                              title="编辑页面标题"
                              placeholder="输入页面标题"
                              onBlur={(e) => {
                                handleFieldEdit(prompt.index, 'title', e.target.value);
                                setEditingField(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleFieldEdit(prompt.index, 'title', (e.target as HTMLInputElement).value);
                                  setEditingField(null);
                                }
                              }}
                              className="flex-1 px-1.5 py-1 text-[11px] border border-[#1e40af] rounded bg-white focus:outline-none"
                            />
                            <button
                              onClick={() => setEditingField(null)}
                              title="取消编辑页面标题"
                              className="p-1 text-gray-400 hover:text-gray-600"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingField(`title-${prompt.index}`)}
                            className="flex items-center gap-1 text-[11px] text-gray-700 hover:text-[#1e40af] mt-0.5"
                          >
                            {prompt.title}
                            <Edit3 size={9} className="text-gray-300" />
                          </button>
                        )}
                      </div>

                      {/* Role */}
                      <div className="rounded-xl bg-[#f8fafc] p-2">
                        <label className="text-[9px] text-gray-400">页面角色</label>
                        <p className="mt-0.5 text-[10px] font-medium text-gray-600">{ROLE_LABELS[prompt.type] || prompt.type}</p>
                      </div>

                      {/* Content goal */}
                      <div className="rounded-xl bg-[#f8fafc] p-2">
                        <label className="text-[9px] text-gray-400">内容目标</label>
                        {editingField === `goal-${prompt.index}` ? (
                          <div className="flex gap-1 mt-0.5">
                            <input
                              autoFocus
                              defaultValue={prompt.contentGoal}
                              title="编辑内容目标"
                              placeholder="输入该页的内容目标"
                              onBlur={(e) => {
                                handleFieldEdit(prompt.index, 'contentGoal', e.target.value);
                                setEditingField(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleFieldEdit(prompt.index, 'contentGoal', (e.target as HTMLInputElement).value);
                                  setEditingField(null);
                                }
                              }}
                              className="flex-1 px-1.5 py-1 text-[11px] border border-[#1e40af] rounded bg-white focus:outline-none"
                            />
                            <button
                              onClick={() => setEditingField(null)}
                              title="取消编辑内容目标"
                              className="p-1 text-gray-400 hover:text-gray-600"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingField(`goal-${prompt.index}`)}
                            className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-[#1e40af] mt-0.5"
                          >
                            {prompt.contentGoal || '点击设置...'}
                            <Edit3 size={9} className="text-gray-300" />
                          </button>
                        )}
                      </div>

                      {/* Visual Prompt */}
                      <div className="rounded-xl bg-[#f8fafc] p-2">
                        <label className="text-[9px] text-gray-400">生成 Prompt</label>
                        {editingField === `prompt-${prompt.index}` ? (
                          <div className="mt-0.5">
                            <textarea
                              autoFocus
                              defaultValue={prompt.visualPrompt}
                              title="编辑生成 Prompt"
                              placeholder="输入或调整当前页的生成 Prompt"
                              onBlur={(e) => {
                                handleFieldEdit(prompt.index, 'visualPrompt', e.target.value);
                                setEditingField(null);
                              }}
                              rows={4}
                              className="w-full px-1.5 py-1 text-[10px] border border-[#1e40af] rounded bg-white focus:outline-none resize-none"
                            />
                            <p className="text-[8px] text-gray-400 mt-0.5">
                              编辑后按 Tab 或点击外部确认修改
                            </p>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingField(`prompt-${prompt.index}`)}
                            className="mt-0.5 w-full rounded border bg-white p-1.5 text-left text-[10px] leading-relaxed text-gray-600 hover:border-[#1e40af]"
                          >
                            <span className="line-clamp-3 block">
                              {prompt.visualPrompt || '点击编辑生成 Prompt...'}
                            </span>
                          </button>
                        )}
                      </div>

                      {/* Elements */}
                      {prompt.elements && prompt.elements.length > 0 && (
                        <div className="rounded-xl bg-[#f8fafc] p-2">
                          <label className="text-[9px] text-gray-400">页面元素 ({prompt.elements.length})</label>
                          <div className="mt-0.5 space-y-0.5">
                            {prompt.elements.slice(0, 6).map((el, ei) => (
                              <div key={ei} className="flex items-start gap-1.5 text-[9px]">
                                <span className="bg-gray-200 text-gray-600 px-1 py-0.5 rounded flex-shrink-0 min-w-[40px] text-center">
                                  {el.type}
                                </span>
                                <span className="text-gray-500 truncate flex-1">{el.content}</span>
                              </div>
                            ))}
                            {prompt.elements.length > 6 && (
                              <p className="text-[8px] text-gray-400">+ {prompt.elements.length - 6} 更多元素</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Layout Structure */}
                      {prompt.layoutStructure && (
                        <div className="rounded-xl bg-[#f8fafc] p-2">
                          <label className="text-[9px] text-gray-400">布局结构</label>
                          <p className="text-[10px] text-gray-500 bg-gray-100 p-1 rounded mt-0.5 leading-relaxed">
                            {prompt.layoutStructure}
                          </p>
                        </div>
                      )}

                      {/* Color Rules */}
                      {prompt.colorRules && (
                        <div className="rounded-xl bg-[#f8fafc] p-2">
                          <label className="text-[9px] text-gray-400">色彩规则</label>
                          <div className="flex gap-1 mt-0.5">
                            {Object.entries(prompt.colorRules).filter(([, v]) => v).map(([key, color]) => (
                              <div key={key} className="flex items-center gap-0.5">
                                <div className="w-3 h-3 rounded border border-gray-200 flex-shrink-0" style={{ backgroundColor: color }} />
                                <span className="text-[8px] text-gray-400">{key}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Asset References */}
                      <div className="rounded-xl bg-[#f8fafc] p-2">
                        <label className="text-[9px] text-gray-400">引用资产</label>
                        {prompt.assetReferences && prompt.assetReferences.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {prompt.assetReferences.map((ref) => {
                              const asset = assetLibrary.find(a => a.assetId === ref);
                              return (
                                <span key={ref} className="inline-flex items-center gap-0.5 text-[9px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded border border-purple-100">
                                  {asset?.url && <img src={asset.url} alt="" className="w-3 h-3 rounded object-cover" />}
                                  [{ref}] {asset?.name || ''}
                                  <button
                                    onClick={() => {
                                      const newRefs = prompt.assetReferences.filter(r => r !== ref);
                                      updateGeneratedSlidePrompt(prompt.index, { assetReferences: newRefs });
                                    }}
                                    className="ml-0.5 text-purple-400 hover:text-red-500"
                                  >
                                    <X size={8} />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {assetLibrary.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {assetLibrary
                              .filter(a => !prompt.assetReferences?.includes(a.assetId))
                              .slice(0, 6)
                              .map((asset) => (
                                <button
                                  key={asset.assetId}
                                  onClick={() => {
                                    const newRefs = [...(prompt.assetReferences || []), asset.assetId];
                                    updateGeneratedSlidePrompt(prompt.index, { assetReferences: newRefs });
                                  }}
                                  className="inline-flex items-center gap-0.5 text-[8px] bg-white text-gray-500 px-1.5 py-0.5 rounded border border-dashed border-gray-300 hover:border-purple-400 hover:text-purple-600"
                                  title={`添加资产 ${asset.name}`}
                                >
                                  {asset.url && <img src={asset.url} alt="" className="w-3 h-3 rounded object-cover" />}
                                  + {asset.name}
                                </button>
                              ))
                            }
                          </div>
                        )}
                      </div>

                      {/* Global Style Prompt */}
                      {prompt.globalStylePrompt && (
                        <div className="rounded-xl bg-[#f8fafc] p-2">
                          <button
                            onClick={() => setEditingField(`style-${prompt.index}`)}
                            className="text-[9px] text-gray-400 hover:text-[#1e40af] flex items-center gap-1"
                          >
                            全局风格 <Edit3 size={8} />
                          </button>
                          {editingField === `style-${prompt.index}` ? (
                            <div className="mt-0.5">
                              <textarea
                                autoFocus
                                defaultValue={prompt.globalStylePrompt}
                                title="编辑全局风格 Prompt"
                                placeholder="输入全局风格 Prompt"
                                onBlur={(e) => {
                                  handleFieldEdit(prompt.index, 'globalStylePrompt', e.target.value);
                                  setEditingField(null);
                                }}
                                rows={3}
                                className="w-full px-1.5 py-1 text-[10px] border border-[#1e40af] rounded bg-white focus:outline-none resize-none"
                              />
                            </div>
                          ) : (
                            <p className="text-[9px] text-gray-400 bg-blue-50 p-1 rounded mt-0.5 leading-relaxed line-clamp-2">
                              {prompt.globalStylePrompt}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Image Prompt */}
                      {prompt.imagePrompt && (
                        <div className="rounded-xl bg-[#f8fafc] p-2">
                          <label className="text-[9px] text-gray-400">图片 Prompt</label>
                          <p className="text-[9px] text-gray-400 bg-gray-100 p-1 rounded mt-0.5 leading-relaxed line-clamp-2">
                            {prompt.imagePrompt}
                          </p>
                        </div>
                      )}

                      {/* Speaker Note */}
                      {prompt.speakerNotePrompt && (
                        <div className="rounded-xl bg-[#f8fafc] p-2">
                          <label className="text-[9px] text-gray-400">讲稿提示</label>
                          <p className="text-[9px] text-gray-400 bg-gray-100 p-1 rounded mt-0.5 leading-relaxed line-clamp-2">
                            {prompt.speakerNotePrompt}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center bg-[#f8fafc] p-4 text-center">
          <div className="w-full rounded-[22px] border border-dashed border-[#cbd5e1] bg-white p-6 shadow-sm">
            <FileText size={30} className="mx-auto mb-3 text-[#94a3b8]" />
            <p className="text-sm font-semibold text-[#0f172a]">等待生成页面规划</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#64748b]">
              在中间 AI 助手中描述你的目标 PPT，系统会在这里生成每一页的 Prompt 列表。
            </p>
          </div>
        </div>
      )}
    </PanelWrapper>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    pending: { label: '待生成', color: 'border-slate-200 bg-slate-50 text-slate-500' },
    generating: { label: '生成中', color: 'border-blue-200 bg-blue-50 text-blue-700' },
    generated: { label: '已生成', color: 'border-green-200 bg-green-50 text-green-700' },
    modified: { label: '已修改', color: 'border-amber-200 bg-amber-50 text-amber-700' },
    confirmed: { label: '已确认', color: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  };
  const { label, color } = config[status] || config.pending;
  return (
    <span className={`inline-flex flex-shrink-0 items-center gap-0.5 rounded-full border px-2 py-1 text-[10px] font-medium ${color}`}>
      {status === 'generating' && <Loader2 size={7} className="animate-spin" />}
      {label}
    </span>
  );
}

function PanelWrapper({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <h3 className="text-xs font-semibold tracking-[0.02em] text-[var(--color-text-primary)]">{title}</h3>
      </div>
      {children}
    </div>
  );
}
