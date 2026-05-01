'use client';

import { useState, useEffect, useCallback } from 'react';
import { Slide, ContentBlock } from '@/types';
import { Plus, Trash2 } from 'lucide-react';

interface SlideEditorProps {
  slide: Slide;
  onUpdate: (slide: Slide) => void;
}

export default function SlideEditor({ slide, onUpdate }: SlideEditorProps) {
  const [localSlide, setLocalSlide] = useState(slide);

  useEffect(() => {
    setLocalSlide(slide);
  }, [slide]);

  const handleUpdate = useCallback((updatedSlide: Slide) => {
    onUpdate(updatedSlide);
  }, [onUpdate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleUpdate(localSlide);
    }, 500);
    return () => clearTimeout(timer);
  }, [localSlide, handleUpdate]);

  const updateField = (field: keyof Slide, value: string | ContentBlock[] | number) => {
    setLocalSlide({ ...localSlide, [field]: value });
  };

  const addContentBlock = () => {
    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type: 'text',
      content: '',
      position: { x: 0.1, y: 0.3, width: 0.8, height: 0.2 },
    };
    updateField('content', [...localSlide.content, newBlock]);
  };

  const updateContentBlock = (index: number, updates: Partial<ContentBlock>) => {
    const newContent = [...localSlide.content];
    newContent[index] = { ...newContent[index], ...updates };
    updateField('content', newContent);
  };

  const removeContentBlock = (index: number) => {
    updateField('content', localSlide.content.filter((_, i) => i !== index));
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="space-y-4">
        {/* 布局选择 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">布局</label>
          <select
            value={localSlide.layout}
            onChange={(e) => updateField('layout', e.target.value)}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="title">标题页</option>
            <option value="content">内容页</option>
            <option value="image">图片页</option>
            <option value="chart">图表页</option>
            <option value="quote">引用页</option>
          </select>
        </div>

        {/* 标题 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">标题</label>
          <input
            type="text"
            value={localSlide.title}
            onChange={(e) => updateField('title', e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
        </div>

        {/* 核心结论 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">核心结论</label>
          <textarea
            value={localSlide.mainConclusion}
            onChange={(e) => updateField('mainConclusion', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border rounded"
          />
        </div>

        {/* 内容块 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium">内容块</label>
            <button
              onClick={addContentBlock}
              className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
            >
              <Plus size={16} />
              添加
            </button>
          </div>

          <div className="space-y-4">
            {localSlide.content.map((block, index) => (
              <div key={block.id} className="p-4 border rounded space-y-3">
                <div className="flex items-center justify-between">
                  <select
                    value={block.type}
                    onChange={(e) =>
                      updateContentBlock(index, { type: e.target.value as ContentBlock['type'] })
                    }
                    className="px-2 py-1 border rounded text-sm"
                  >
                    <option value="text">文字</option>
                    <option value="image">图片</option>
                    <option value="chart">图表</option>
                    <option value="list">列表</option>
                  </select>
                  <button
                    onClick={() => removeContentBlock(index)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <textarea
                  value={block.content}
                  onChange={(e) => updateContentBlock(index, { content: e.target.value })}
                  placeholder="输入内容"
                  rows={3}
                  className="w-full px-3 py-2 border rounded text-sm"
                />

                <div className="grid grid-cols-4 gap-2">
                  <input
                    type="number"
                    value={block.position.x}
                    onChange={(e) =>
                      updateContentBlock(index, {
                        position: { ...block.position, x: Number(e.target.value) },
                      })
                    }
                    step="0.1"
                    min="0"
                    max="1"
                    placeholder="X"
                    className="px-2 py-1 border rounded text-sm"
                  />
                  <input
                    type="number"
                    value={block.position.y}
                    onChange={(e) =>
                      updateContentBlock(index, {
                        position: { ...block.position, y: Number(e.target.value) },
                      })
                    }
                    step="0.1"
                    min="0"
                    max="1"
                    placeholder="Y"
                    className="px-2 py-1 border rounded text-sm"
                  />
                  <input
                    type="number"
                    value={block.position.width}
                    onChange={(e) =>
                      updateContentBlock(index, {
                        position: { ...block.position, width: Number(e.target.value) },
                      })
                    }
                    step="0.1"
                    min="0"
                    max="1"
                    placeholder="宽"
                    className="px-2 py-1 border rounded text-sm"
                  />
                  <input
                    type="number"
                    value={block.position.height}
                    onChange={(e) =>
                      updateContentBlock(index, {
                        position: { ...block.position, height: Number(e.target.value) },
                      })
                    }
                    step="0.1"
                    min="0"
                    max="1"
                    placeholder="高"
                    className="px-2 py-1 border rounded text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
