'use client';

import React from 'react';
import { StyleKit, SlideRole } from '@/types';
import { Trash2, Clock, Star, Layout, Sparkles } from 'lucide-react';

interface StyleKitCardProps {
  styleKit: StyleKit;
  onClick?: () => void;
  onDelete?: () => void;
}

const MOOD_LABELS: Record<StyleKit['styleDNA']['mood'], string> = {
  professional: '专业',
  creative: '创意',
  academic: '学术',
  casual: '休闲',
};

const MOOD_COLORS: Record<StyleKit['styleDNA']['mood'], string> = {
  professional: 'bg-blue-100 text-blue-700',
  creative: 'bg-pink-100 text-pink-700',
  academic: 'bg-amber-100 text-amber-700',
  casual: 'bg-green-100 text-green-700',
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

function renderStars(rating: number | undefined): React.ReactElement[] {
  const stars = [];
  const displayRating = rating ?? 0;
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star
        key={i}
        size={12}
        className={i <= displayRating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
      />
    );
  }
  return stars;
}

export default function StyleKitCard({
  styleKit,
  onClick,
  onDelete,
}: StyleKitCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  const { styleDNA, layoutPatterns, stats } = styleKit;
  const palette = styleDNA.palette;

  // Preview palette colors
  const previewColors = [
    { hex: palette.primary, name: 'primary' },
    { hex: palette.secondary, name: 'secondary' },
    { hex: palette.accent, name: 'accent' },
    { hex: palette.background, name: 'background' },
    { hex: palette.text, name: 'text' },
  ];

  // Get unique layout types
  const layoutTypes = [...new Set(layoutPatterns.map((lp) => lp.layoutType))];

  return (
    <div
      onClick={onClick}
      className="group relative bg-white border rounded-lg p-4 cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all duration-200"
    >
      {/* Header: Name and Mood Tag */}
      <div className="flex items-start justify-between mb-3">
        <h3
          className="font-semibold text-gray-900 line-clamp-1 pr-2"
          title={styleKit.name}
        >
          {styleKit.name}
        </h3>
        <span
          className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${
            MOOD_COLORS[styleDNA.mood]
          }`}
        >
          {MOOD_LABELS[styleDNA.mood]}
        </span>
      </div>

      {/* Mood Description */}
      <p className="text-xs text-gray-500 mb-3 line-clamp-1" title={styleDNA.moodDescription}>
        {styleDNA.moodDescription || '暂无风格描述'}
      </p>

      {/* Color Palette Preview */}
      <div className="flex items-center gap-1.5 mb-3">
        {previewColors.map((color, index) => (
          <div
            key={index}
            className="w-8 h-8 rounded border border-gray-200 shadow-sm flex items-center justify-center"
            style={{ backgroundColor: color.hex }}
            title={`${color.name}: ${color.hex}`}
          >
            {color.hex === palette.background && (
              <span className="text-[8px] text-gray-400">bg</span>
            )}
          </div>
        ))}
      </div>

      {/* Typography Preview */}
      <div className="flex items-center gap-2 mb-3 text-xs text-gray-600">
        <span className="font-medium" style={{ fontFamily: styleDNA.typography.titleFont }}>
          {styleDNA.typography.titleFont}
        </span>
        <span className="text-gray-300">/</span>
        <span style={{ fontFamily: styleDNA.typography.bodyFont }}>
          {styleDNA.typography.bodyFont}
        </span>
      </div>

      {/* Layout Patterns */}
      {layoutTypes.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <Layout size={12} className="text-gray-400" />
          <div className="flex flex-wrap gap-1">
            {layoutTypes.slice(0, 3).map((type) => (
              <span
                key={type}
                className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
              >
                {type}
              </span>
            ))}
            {layoutTypes.length > 3 && (
              <span className="text-xs text-gray-400">+{layoutTypes.length - 3}</span>
            )}
          </div>
        </div>
      )}

      {/* Footer: Stats */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Sparkles size={12} />
            使用 {stats.usageCount} 次
          </span>
          {stats.feedbackCount > 0 && (
            <span className="flex items-center gap-1">
              {renderStars(stats.averageRating)}
              ({stats.feedbackCount})
            </span>
          )}
        </div>
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <Clock size={12} />
          {formatRelativeTime(styleKit.updatedAt)}
        </span>
      </div>

      {/* Delete Button (hover reveal) */}
      <button
        onClick={handleDelete}
        className="absolute bottom-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        aria-label="删除 StyleKit"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
