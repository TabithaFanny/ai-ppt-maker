'use client';

import { useState } from 'react';
import { Wand2, Loader2, AlertCircle, Check, X, Type, Move, Layout } from 'lucide-react';
import { validatePatch } from '@/lib/validate-patch';
import { generatePatchDiff } from '@/lib/patch-diff';
import { computeTextDiff, formatPosition } from '@/lib/text-diff';
import type { EditPatch } from '@/types/generation';
import type { PatchDiff, DiffChange } from '@/lib/patch-diff';
import type { PPTJson, Slide } from '@/types';

interface AiEditPanelProps {
  currentSlide: Slide;
  pptJson: PPTJson;
  onApplyPatch: (patch: EditPatch) => void;
  onClose: () => void;
}

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
  // 其他字段：简单文本显示
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
  };
  const { label, color } = config[operation] ?? { label: operation, color: 'bg-gray-100 text-gray-700' };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{label}</span>;
}

export default function AiEditPanel({ currentSlide, pptJson, onApplyPatch, onClose }: AiEditPanelProps) {
  const [instruction, setInstruction] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ patch: EditPatch; diff: PatchDiff } | null>(null);

  const handleSubmit = async () => {
    if (!instruction.trim()) return;

    setIsLoading(true);
    setError(null);
    setPreview(null);

    try {
      const response = await fetch('/api/edit-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slide: currentSlide,
          instruction: instruction.trim(),
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error);
        return;
      }

      const patch = result.data as EditPatch;

      // PatchValidator 业务校验
      const validation = validatePatch(pptJson, patch);
      if (!validation.valid) {
        const msgs = validation.errors.map((e) => e.message).join('; ');
        setError(`补丁校验失败: ${msgs}`);
        return;
      }

      // 生成 diff 预览
      const diff = generatePatchDiff(pptJson, patch);
      setPreview({ patch, diff });
    } catch (err) {
      setError(`请求失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (preview) {
      onApplyPatch(preview.patch);
      setPreview(null);
      setInstruction('');
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setError(null);
  };

  return (
    <div className="border rounded-lg bg-white shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Wand2 size={16} />
          AI 单点修改
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      {/* Input */}
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
          onClick={handleSubmit}
          disabled={isLoading || !instruction.trim()}
          className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          生成
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Diff Preview */}
      {preview && (
        <div className="space-y-2">
          <div className="p-3 bg-gray-50 border rounded text-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium text-gray-800">修改预览</div>
              <OperationBadge operation={preview.patch.operation} />
            </div>
            <div className="text-gray-600 text-xs">{preview.diff.summary}</div>
            {preview.diff.changes.map((change, i) => (
              <DiffChangeView key={i} change={change} />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              className="flex-1 px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 flex items-center justify-center gap-1"
            >
              <Check size={14} />
              确认应用
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-2 border rounded text-sm hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
