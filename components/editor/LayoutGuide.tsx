'use client';

/**
 * LayoutGuide — 画布覆盖层，显示 zone 边界和标签
 * 用于在元素编辑模式下引导用户布局
 */

import type { ResolvedZone } from '@/types/generation';

interface LayoutGuideProps {
  zones: ResolvedZone[];
  highlightedZoneId?: string | null;
  showLabels?: boolean;
}

/** zone 类型 → 颜色映射 */
const ZONE_COLORS: Record<string, { border: string; bg: string; label: string }> = {
  text: { border: 'border-blue-400', bg: 'bg-blue-50', label: 'bg-blue-100 text-blue-700' },
  image: { border: 'border-green-400', bg: 'bg-green-50', label: 'bg-green-100 text-green-700' },
  chart: { border: 'border-purple-400', bg: 'bg-purple-50', label: 'bg-purple-100 text-purple-700' },
  icon: { border: 'border-amber-400', bg: 'bg-amber-50', label: 'bg-amber-100 text-amber-700' },
  decoration: { border: 'border-gray-300', bg: 'bg-gray-50', label: 'bg-gray-100 text-gray-500' },
};

export default function LayoutGuide({
  zones,
  highlightedZoneId,
  showLabels = true,
}: LayoutGuideProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {zones.map((zone) => {
        const colors = ZONE_COLORS[zone.contentType] || ZONE_COLORS.text;
        const isHighlighted = zone.id === highlightedZoneId;

        return (
          <div
            key={zone.id}
            className={`absolute border-2 border-dashed transition-all duration-150 ${
              isHighlighted
                ? 'border-blue-500 bg-blue-100/40 scale-[1.02]'
                : `${colors.border} ${colors.bg}/30`
            }`}
            style={{
              left: `${zone.position.x * 100}%`,
              top: `${zone.position.y * 100}%`,
              width: `${zone.position.width * 100}%`,
              height: `${zone.position.height * 100}%`,
              borderRadius: '4px',
              opacity: zone.isOccupied && !isHighlighted ? 0.3 : 0.7,
            }}
          >
            {showLabels && (
              <span
                className={`absolute top-0.5 left-1 text-[10px] px-1.5 py-0.5 rounded ${
                  isHighlighted ? 'bg-blue-200 text-blue-800' : colors.label
                }`}
              >
                {zone.name}
                {zone.isOccupied && ' ✓'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
