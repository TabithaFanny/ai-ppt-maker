'use client';

import { useState } from 'react';
import { Wand2, Loader2, AlertCircle, Check, X, Type, Move, Layout, RefreshCw, CopyPlus } from 'lucide-react';
import { validatePatch } from '@/lib/validate-patch';
import { generatePatchDiff } from '@/lib/patch-diff';
import { computeTextDiff, formatPosition } from '@/lib/text-diff';
import type { EditPatch, RewriteMode } from '@/types/generation';
import type { PatchDiff, DiffChange } from '@/lib/patch-diff';
import type { PPTJson, Slide } from '@/types';

interface AiEditPanelProps {
  currentSlide: Slide;
  pptJson: PPTJson;
  onApplyPatch: (patch: EditPatch) => void;
  onInsertAsNewSlide: (slide: Slide) => void;
  onClose: () => void;
}

type EditTab = 'single' | 'rewrite';

const REWRITE_MODES: { key: RewriteMode; label: string }[] = [
  { key: 'professional', label: '更专业' },
  { key: 'concise', label: '更简洁' },
  { key: 'persuasive', label: '更有说服力' },
  { key: 'defense', label: '适合答辩' },
];

function TextDiffView({ oldValue, newValue }: { oldValue: string; newValue: string }) {
  const segments = computeTextDiff(oldValue, newValue);
  return (
    <div className="mt-1.5 p-2 bg-white rounded border text-xs leading-relaxed font-mono">
      {segments.map((seg, i) => {
        if (seg.type === 'same') return <span key={i}>{seg.text}</span>;
        if (seg.type === 'removed') return <span key={i} className="bg-red-100 text-red-700 line-through rounded px-0.5">{seg.text}</span>;
        return <span key={i} className="bg-green-100 text-green-700 rounded px-0.5">{seg.text}</span>;
      })}
    </div>
  );
}

function PositionDiffView({ oldValue, newValue }: { oldValue: unknown; newValue: unknown }) {
  const oldPos = oldValue as { x: number; y: number; width: number; height: number };
  const newPos = newValue as { x: number; y: number; width: number; height: number };
  return (
    <div className="mt-1.5 flex items-center gap-2 text-xs">
      <Move size={12} className="text-gray-400" />
      <span className="text-gray-500">{formatPosition(oldPos)}</span>
      <span className="text-gray-400">→</span>
      <span className="text-blue-600 font-medium">{formatPosition(newPos)}</span>
    </div>
  );
}

function LayoutDiffView({ oldValue, newValue }: { oldValue: unknown; newValue: unknown }) {
  return (
    <div className="mt-1.5 flex items-center gap-2 text-xs">
      <Layout size={12} className="text-gray-400" />
      <span className="px-1.5 py-0.5 bg-gray-100 rounded">{String(oldValue)}</span>
      <span className="text-gray-400">→</span>
      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">{String(newValue)}</span>
    </div>
  );
}

function DiffChangeView({ change }: { change: DiffChange }) {
  if (change.field === 'content' && typeof change.oldValue === 'string' && typeof change.newValue === 'string') {
    return <TextDiffView oldValue={change.oldValue} newValue={change.newValue} />;
  }
  if (change.field === 'position' && change.oldValue && change.newValue) {
    return <PositionDiffView oldValue={change.oldValue} newValue={change.newValue} />;
  }
  if (change.field === 'layout' && change.oldValue !== undefined && change.newValue !== undefined) {
    return <LayoutDiffView oldValue={change.oldValue} newValue={change.newValue} />;
  }
  return (
    <div className="mt-1 text-xs text-gray-600">
      {change.field}: {JSON.stringify(change.oldValue)} → {JSON.stringify(change.newValue)}
    </div>
  );
}

function OperationBadge({ operation }: { operation: string }) {
  const config: Record<string, { label: string; color: string }> = {
    update_text: { label: '修改文字', color: 'bg-blue-100 text-blue-700' },
    batch_update_text: { label: '批量修改', color: 'bg-indigo-100 text-indigo-700' },
    move_element: { label: '移动元素', color: 'bg-amber-100 text-amber-700' },
    resize_element: { label: '调整大小', color: 'bg-orange-100 text-orange-700' },
    delete_element: { label: '删除元素', color: 'bg-red-100 text-red-700' },
    add_element: { label: '新增元素', color: 'bg-green-100 text-green-700' },
    replace_layout: { label: '切换布局', color: 'bg-purple-100 text-purple-700' },
    update_title: { label: '修改标题', color: 'bg-cyan-100 text-cyan-700' },
  };
  const { label, color } = config[operation] ?? { label: operation, color: 'bg-gray-100 text-gray-700' };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{label}</span>;
}

function SlideContentView({ slide }: { slide: Slide }) {
  return (
    <div className="space-y-2 text-xs">
      <div>
        <span className="font-medium text-gray-500">标题：</span>
        <span>{slide.title || '-'}</span>
      </div>
      <div>
        <span className="font-medium text-gray-500">结论：</span>
        <span>{slide.mainConclusion || '-'}</span>
      </div>
      {slide.content.map((b, i) => (
        <div key={b.id} className="border-l-2 border-gray-200 pl-2">
          <span className="font-medium text-gray-400">[{b.type}] </span>
          <span>{b.content?.slice(0, 100) || '-'}</span>
        </div>
      ))}
    </div>
  );
}

export default function AiEditPanel({ currentSlide, pptJson, onApplyPatch, onInsertAsNewSlide, onClose }: AiEditPanelProps) {
  const [editTab, setEditTab] = useState<EditTab>('single');
  const [instruction, setInstruction] = useState('');
  const [rewriteMode, setRewriteMode] = useState<RewriteMode>('professional');
  const [customInstruction, setCustomInstruction] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ patch: EditPatch; diff: PatchDiff } | null>(null);
  const [rewriteResult, setRewriteResult] = useState<EditPatch | null>(null);

  const handleSubmit = async (mode?: RewriteMode) => {
    const activeMode = mode || rewriteMode;
    const activeInstruction = editTab === 'rewrite' ? `用${REWRITE_MODES.find(m => m.key === activeMode)?.label || activeMode}语气改写` : instruction;

    if (editTab === 'single' && !instruction.trim()) return;

    setIsLoading(true);
    setError(null);
    setPreview(null);
    setRewriteResult(null);

    try {
      const response = await fetch('/api/edit-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slide: currentSlide,
          instruction: activeInstruction,
          rewriteMode: editTab === 'rewrite' ? activeMode : undefined,
          customInstruction: editTab === 'rewrite' ? customInstruction.trim() || undefined : undefined,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error);
        return;
      }

      const patch = result.data as EditPatch;

      const validation = validatePatch(pptJson, patch);
      if (!validation.valid) {
        const msgs = validation.errors.map((e) => e.message).join('; ');
        setError(`补丁校验失败: ${msgs}`);
        return;
      }

      const diff = generatePatchDiff(pptJson, patch);
      setPreview({ patch, diff });
      setRewriteResult(patch);
    } catch (err) {
      setError(`请求失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (preview) {
      onApplyPatch(preview.patch);
      resetState();
    }
  };

  const handleApplyTitleOnly = () => {
    if (!rewriteResult) return;
    const rawValue = rewriteResult.newValue;
    // 安全转换：支持 string / { title: string } / object
    const titleValue: string = typeof rawValue === 'string'
      ? rawValue
      : (rawValue && typeof rawValue === 'object' && 'title' in (rawValue as object))
        ? String((rawValue as Record<string, unknown>).title ?? '')
        : currentSlide.title;
    const finalTitle = titleValue || currentSlide.title;
    const titlePatch: EditPatch = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      slideId: currentSlide.id,
      operation: 'update_title',
      elementId: undefined,
      oldValue: currentSlide.title,
      newValue: finalTitle,
      description: '仅替换标题',
    };
    onApplyPatch(titlePatch);
    resetState();
  };

  const handleInsertAsNewSlide = () => {
    if (!rewriteResult) return;
    const rawValue = rewriteResult.newValue;
    // 只从 newValue 安全提取 title，不提取 content（结构不安全）
    const newTitle = typeof rawValue === 'string'
      ? rawValue
      : (rawValue && typeof rawValue === 'object' && 'title' in rawValue)
        ? String((rawValue as any).title)
        : currentSlide.title;
    // 复制当前 slide 保证合法性，不从 newValue 提取 content
    const newSlide: Slide = {
      ...currentSlide,
      id: crypto.randomUUID(),
      title: newTitle,
      // content: 保持 currentSlide.content，不提取不安全的数据
    };
    onInsertAsNewSlide(newSlide);
    resetState();
  };

  const resetState = () => {
    setPreview(null);
    setRewriteResult(null);
    setInstruction('');
    setCustomInstruction('');
    setError(null);
  };

  const handleRegenerate = () => {
    handleSubmit();
  };

  return (
    <div className="border rounded-lg bg-white shadow-sm max-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Wand2 size={16} />
          AI 编辑
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
          <X size={16} />
        </button>
      </div>

      {/* Tab selector */}
      <div className="flex border-b">
        <button
          onClick={() => { setEditTab('single'); resetState(); }}
          className={`flex-1 py-2 text-xs font-medium text-center ${editTab === 'single' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          单点修改
        </button>
        <button
          onClick={() => { setEditTab('rewrite'); resetState(); }}
          className={`flex-1 py-2 text-xs font-medium text-center ${editTab === 'rewrite' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          全文改写
        </button>
      </div>

      {/* Rewrite mode tabs */}
      {editTab === 'rewrite' && (
        <div className="flex gap-1 p-2 border-b bg-gray-50 overflow-x-auto">
          {REWRITE_MODES.map((mode) => (
            <button
              key={mode.key}
              onClick={() => { setRewriteMode(mode.key); setError(null); setPreview(null); setRewriteResult(null); }}
              className={`px-3 py-1.5 text-xs rounded-full font-medium whitespace-nowrap transition-colors ${
                rewriteMode === mode.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border hover:bg-gray-100'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Original content (rewrite mode) */}
        {editTab === 'rewrite' && !preview && (
          <div className="p-3 bg-gray-50 border rounded">
            <div className="text-xs font-medium text-gray-500 mb-2">原始内容</div>
            <SlideContentView slide={currentSlide} />
          </div>
        )}

        {/* Single edit input */}
        {editTab === 'single' && !preview && (
          <div className="flex gap-2">
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSubmit()}
              placeholder="输入修改要求，如：把标题改成..."
              className="flex-1 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              onClick={() => handleSubmit()}
              disabled={isLoading || !instruction.trim()}
              className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              生成
            </button>
          </div>
        )}

        {/* Rewrite custom instruction */}
        {editTab === 'rewrite' && !preview && (
          <div className="space-y-2">
            <textarea
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              placeholder="补充要求（可选）：强调某个要点、调整篇幅、增加某个角度..."
              rows={2}
              className="w-full px-3 py-2 border rounded text-sm"
              disabled={isLoading}
            />
            <button
              onClick={() => handleSubmit()}
              disabled={isLoading}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {isLoading ? '生成中...' : `生成${REWRITE_MODES.find(m => m.key === rewriteMode)?.label || ''}建议`}
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-blue-600" />
            <span className="ml-2 text-sm text-gray-500">正在生成...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{String(error ?? '')}</span>
          </div>
        )}

        {/* Diff Preview */}
        {preview && (
          <div className="space-y-2">
            {/* Side-by-side comparison */}
            {editTab === 'rewrite' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-gray-50 border rounded">
                  <div className="text-xs font-medium text-gray-500 mb-2">原始内容</div>
                  <SlideContentView slide={currentSlide} />
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <div className="text-xs font-medium text-blue-600 mb-2">改写建议</div>
                  <div className="text-xs space-y-2">
                    {preview.diff.changes.map((change, i) => (
                      <DiffChangeView key={i} change={change} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="p-3 bg-gray-50 border rounded text-sm space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium text-gray-800">修改预览</div>
                <OperationBadge operation={preview.patch.operation} />
              </div>
              <div className="text-gray-600 text-xs">{preview.diff.summary}</div>
              {editTab === 'single' && preview.diff.changes.map((change, i) => (
                <DiffChangeView key={i} change={change} />
              ))}
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              {editTab === 'rewrite' ? (
                <>
                  <button
                    onClick={handleConfirm}
                    className="w-full px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 flex items-center justify-center gap-1"
                  >
                    <Check size={14} />
                    全部应用
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={handleApplyTitleOnly}
                      className="flex-1 px-3 py-2 border rounded text-sm hover:bg-gray-50 flex items-center justify-center gap-1"
                    >
                      <Type size={14} />
                      仅替换标题
                    </button>
                    <button
                      onClick={handleInsertAsNewSlide}
                      className="flex-1 px-3 py-2 border rounded text-sm hover:bg-gray-50 flex items-center justify-center gap-1"
                    >
                      <CopyPlus size={14} />
                      插入为新版本
                    </button>
                  </div>
                  <button
                    onClick={handleRegenerate}
                    disabled={isLoading}
                    className="w-full px-3 py-2 border rounded text-sm hover:bg-gray-50 flex items-center justify-center gap-1"
                  >
                    <RefreshCw size={14} />
                    重新生成
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleConfirm}
                    className="w-full px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 flex items-center justify-center gap-1"
                  >
                    <Check size={14} />
                    确认应用
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRegenerate}
                      disabled={isLoading}
                      className="flex-1 px-3 py-2 border rounded text-sm hover:bg-gray-50 flex items-center justify-center gap-1"
                    >
                      <RefreshCw size={14} />
                      重新生成
                    </button>
                    <button
                      onClick={() => setPreview(null)}
                      className="flex-1 px-3 py-2 border rounded text-sm hover:bg-gray-50"
                    >
                      取消
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
