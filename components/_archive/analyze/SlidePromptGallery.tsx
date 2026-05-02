'use client';

import { useState } from 'react';
import { Pencil, Check, X, ImageIcon } from 'lucide-react';

interface SlidePromptGalleryProps {
  slidePrompts: Array<{
    slideIndex: number;
    imageBase64?: string;
    visualPrompt: string;
    styleTags: string[];
    colorPalette: string[];
    layout: string;
  }>;
  onEditPrompt?: (slideIndex: number, newPrompt: string) => void;
}

export default function SlidePromptGallery({
  slidePrompts,
  onEditPrompt,
}: SlidePromptGalleryProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEditing = (slideIndex: number, currentPrompt: string) => {
    setEditingIndex(slideIndex);
    setEditValue(currentPrompt);
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditValue('');
  };

  const saveEdit = () => {
    if (editingIndex !== null && onEditPrompt) {
      onEditPrompt(editingIndex, editValue);
    }
    setEditingIndex(null);
    setEditValue('');
  };

  const getLayoutLabel = (layout: string) => {
    const labels: Record<string, string> = {
      title: '标题页',
      content: '内容页',
      image: '图片页',
      chart: '图表页',
      quote: '引用页',
    };
    return labels[layout] || layout;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Prompt 画廊
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({slidePrompts.length} 页)
          </span>
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {slidePrompts.map((slide) => (
          <div
            key={slide.slideIndex}
            className="border border-gray-200 rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow"
          >
            {/* Thumbnail */}
            <div className="aspect-video bg-gray-100 relative">
              {slide.imageBase64 ? (
                <img
                  src={`data:image/png;base64,${slide.imageBase64}`}
                  alt={`Slide ${slide.slideIndex + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center w-full h-full text-gray-400">
                  <ImageIcon size={32} />
                  <span className="text-xs mt-1">无预览图</span>
                </div>
              )}
              {/* Page number badge */}
              <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 text-white text-xs font-medium rounded">
                {slide.slideIndex + 1}
              </div>
              {/* Layout badge */}
              <div className="absolute top-2 right-2 px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded">
                {getLayoutLabel(slide.layout)}
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
              {/* Prompt section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Visual Prompt
                  </span>
                  {onEditPrompt && editingIndex !== slide.slideIndex && (
                    <button
                      onClick={() => startEditing(slide.slideIndex, slide.visualPrompt)}
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="编辑 Prompt"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </div>

                {editingIndex === slide.slideIndex ? (
                  <div className="space-y-2">
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                      placeholder="输入 visual prompt..."
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={cancelEditing}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                      >
                        <X size={12} />
                        取消
                      </button>
                      <button
                        onClick={saveEdit}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded"
                      >
                        <Check size={12} />
                        保存
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-700 line-clamp-4 leading-relaxed">
                    {slide.visualPrompt || '暂无 prompt'}
                  </p>
                )}
              </div>

              {/* Style Tags */}
              {slide.styleTags.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    风格标签
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {slide.styleTags.map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full border border-purple-100"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Color Palette */}
              {slide.colorPalette.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    配色方案
                  </span>
                  <div className="flex gap-1">
                    {slide.colorPalette.map((color, colorIndex) => (
                      <div
                        key={colorIndex}
                        className="w-8 h-8 rounded border border-gray-200 shadow-sm"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {slidePrompts.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <ImageIcon size={48} className="mx-auto mb-3 opacity-30" />
          <p>暂无 slide prompts 数据</p>
        </div>
      )}
    </div>
  );
}
