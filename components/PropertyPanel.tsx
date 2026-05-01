'use client';

import { useState, useEffect } from 'react';
import { ContentBlock } from '@/types';
import { useElementSelection } from '@/hooks/useElementSelection';
import { X, Trash2, Lock, Unlock } from 'lucide-react';

interface PropertyPanelProps {
  slideId: string;
  blocks: ContentBlock[];
  onUpdate: (blockId: string, updates: Partial<ContentBlock>) => void;
  onDelete: (blockId: string) => void;
}

export default function PropertyPanel({ slideId, blocks, onUpdate, onDelete }: PropertyPanelProps) {
  const { selectedElement } = useElementSelection();
  const [localBlock, setLocalBlock] = useState<ContentBlock | null>(null);

  const selectedBlock = selectedElement?.slideId === slideId
    ? blocks.find(b => b.id === selectedElement.elementId)
    : null;

  useEffect(() => {
    if (selectedBlock) {
      setLocalBlock(selectedBlock);
    } else {
      setLocalBlock(null);
    }
  }, [selectedBlock]);

  const handleUpdate = (updates: Partial<ContentBlock>) => {
    if (localBlock) {
      onUpdate(localBlock.id, updates);
    }
  };

  if (!localBlock) {
    return (
      <div className="w-64 border-l bg-gray-50 p-4">
        <p className="text-sm text-gray-500">选择一个元素以编辑属性</p>
      </div>
    );
  }

  return (
    <div className="w-64 border-l bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <h4 className="font-medium text-sm">属性</h4>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleUpdate({ locked: !localBlock.locked })}
            className={`p-1.5 rounded ${localBlock.locked ? 'text-amber-600 bg-amber-50' : 'text-gray-400 hover:bg-gray-100'}`}
            title={localBlock.locked ? '解锁元素' : '锁定元素'}
          >
            {localBlock.locked ? <Lock size={16} /> : <Unlock size={16} />}
          </button>
          <button
            onClick={() => onDelete(localBlock.id)}
            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
            title="删除元素"
            disabled={localBlock.locked}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Type */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">类型</label>
          <select
            value={localBlock.type}
            onChange={(e) => handleUpdate({ type: e.target.value as ContentBlock['type'] })}
            className="w-full px-2 py-1.5 text-sm border rounded"
          >
            <option value="text">文字</option>
            <option value="image">图片</option>
            <option value="chart">图表</option>
            <option value="list">列表</option>
          </select>
        </div>

        {/* Content */}
        {(localBlock.type === 'text' || localBlock.type === 'list') && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">内容</label>
            <textarea
              value={localBlock.content}
              onChange={(e) => handleUpdate({ content: e.target.value })}
              rows={4}
              className="w-full px-2 py-1.5 text-sm border rounded resize-none"
            />
          </div>
        )}

        {/* Position */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">位置</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">X</label>
              <input
                type="number"
                value={localBlock.position.x.toFixed(2)}
                onChange={(e) => handleUpdate({ position: { ...localBlock.position, x: Number(e.target.value) } })}
                step="0.05"
                min="0"
                max="1"
                className="w-full px-2 py-1 text-xs border rounded"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Y</label>
              <input
                type="number"
                value={localBlock.position.y.toFixed(2)}
                onChange={(e) => handleUpdate({ position: { ...localBlock.position, y: Number(e.target.value) } })}
                step="0.05"
                min="0"
                max="1"
                className="w-full px-2 py-1 text-xs border rounded"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">宽</label>
              <input
                type="number"
                value={localBlock.position.width.toFixed(2)}
                onChange={(e) => handleUpdate({ position: { ...localBlock.position, width: Number(e.target.value) } })}
                step="0.05"
                min="0.05"
                max="1"
                className="w-full px-2 py-1 text-xs border rounded"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">高</label>
              <input
                type="number"
                value={localBlock.position.height.toFixed(2)}
                onChange={(e) => handleUpdate({ position: { ...localBlock.position, height: Number(e.target.value) } })}
                step="0.05"
                min="0.05"
                max="1"
                className="w-full px-2 py-1 text-xs border rounded"
              />
            </div>
          </div>
        </div>

        {/* Style */}
        {localBlock.style && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">样式</label>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-500">字号</label>
                <input
                  type="number"
                  value={localBlock.style.fontSize || 14}
                  onChange={(e) => handleUpdate({ style: { ...localBlock.style, fontSize: Number(e.target.value) } })}
                  min="8"
                  max="72"
                  className="w-full px-2 py-1 text-xs border rounded"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">字重</label>
                <select
                  value={localBlock.style.fontWeight || 'normal'}
                  onChange={(e) => handleUpdate({ style: { ...localBlock.style, fontWeight: e.target.value } })}
                  className="w-full px-2 py-1 text-xs border rounded"
                >
                  <option value="normal">正常</option>
                  <option value="bold">粗体</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">颜色</label>
                <input
                  type="color"
                  value={localBlock.style.color || '#000000'}
                  onChange={(e) => handleUpdate({ style: { ...localBlock.style, color: e.target.value } })}
                  className="w-full h-8 border rounded cursor-pointer"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">对齐</label>
                <select
                  value={localBlock.style.align || 'left'}
                  onChange={(e) => handleUpdate({ style: { ...localBlock.style, align: e.target.value as 'left' | 'center' | 'right' } })}
                  className="w-full px-2 py-1 text-xs border rounded"
                >
                  <option value="left">左对齐</option>
                  <option value="center">居中</option>
                  <option value="right">右对齐</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
