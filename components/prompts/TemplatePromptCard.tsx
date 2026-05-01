'use client';

import { TemplatePrompt } from '@/types';
import { Trash2, Clock, CheckCircle } from 'lucide-react';

interface TemplatePromptCardProps {
  template: TemplatePrompt;
  onClick?: () => void;
  onDelete?: () => void;
}

const STYLE_LABELS: Record<TemplatePrompt['overallStyle'], string> = {
  business: '商务',
  tech: '科技',
  creative: '创意',
  academic: '学术',
};

const STYLE_COLORS: Record<TemplatePrompt['overallStyle'], string> = {
  business: 'bg-blue-100 text-blue-700',
  tech: 'bg-purple-100 text-purple-700',
  creative: 'bg-pink-100 text-pink-700',
  academic: 'bg-amber-100 text-amber-700',
};

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} 天前`;
  if (hours > 0) return `${hours} 小时前`;
  if (minutes > 0) return `${minutes} 分钟前`;
  return '刚刚';
}

export default function TemplatePromptCard({
  template,
  onClick,
  onDelete,
}: TemplatePromptCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  // Preview first 5 colors from the palette
  const previewColors = template.colorPalette.slice(0, 5);

  return (
    <div
      onClick={onClick}
      className="group relative bg-white border rounded-lg p-4 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all duration-200"
    >
      {/* Header: Name and Style Tag */}
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-gray-900 line-clamp-1 pr-2" title={template.name}>
          {template.name}
        </h3>
        <span
          className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${
            STYLE_COLORS[template.overallStyle]
          }`}
        >
          {STYLE_LABELS[template.overallStyle]}
        </span>
      </div>

      {/* Color Palette Preview */}
      <div className="flex items-center gap-1 mb-3">
        {previewColors.map((color, index) => (
          <div
            key={index}
            className="w-6 h-6 rounded border border-gray-200 shadow-sm"
            style={{ backgroundColor: color.hex }}
            title={color.name}
          />
        ))}
        {template.colorPalette.length > 5 && (
          <span className="text-xs text-gray-400 ml-1">
            +{template.colorPalette.length - 5}
          </span>
        )}
      </div>

      {/* Footer: Usage Stats and Tags */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>使用 {template.usageCount} 次</span>
          {template.lastUsedAt && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatRelativeTime(template.lastUsedAt)}
            </span>
          )}
        </div>

        {template.userOptimizedPrompt && (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-600 text-xs rounded-full">
            <CheckCircle size={12} />
            已优化
          </span>
        )}
      </div>

      {/* Delete Button (hover reveal) */}
      <button
        onClick={handleDelete}
        className="absolute bottom-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        aria-label="删除模板"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
