'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Slide, ContentBlock, StyleKit } from '@/types';
import { useElementSelection } from '@/hooks/useElementSelection';
import { resolveLayoutPlan, snapToZone, findHoveredZone } from '@/lib/layout-resolver';
import LayoutGuide from './LayoutGuide';
import { Lock } from 'lucide-react';
import type { LayoutPlan, ResolvedZone } from '@/types/generation';

interface ElementCanvasProps {
  slide: Slide;
  onUpdate: (blockId: string, updates: Partial<ContentBlock>, action?: 'move' | 'resize') => void;
  readOnly?: boolean;
  styleKit?: StyleKit | null;
  slideRole?: string;
  showLayoutGuide?: boolean;
}

const HANDLE_SIZE = 8;
const MIN_SIZE = 0.05;

export default function ElementCanvas({
  slide,
  onUpdate,
  readOnly = false,
  styleKit = null,
  slideRole = 'content',
  showLayoutGuide = false,
}: ElementCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    blockId: string;
    startX: number;
    startY: number;
    originalPosition: { x: number; y: number; width: number; height: number };
  } | null>(null);
  const [resizeState, setResizeState] = useState<{
    blockId: string;
    handle: string;
    startX: number;
    startY: number;
    originalPosition: { x: number; y: number; width: number; height: number };
  } | null>(null);
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);

  const { selectedElement, setSelectedElement, hoveredElement, setHoveredElement } = useElementSelection();

  // 计算 LayoutPlan
  const layoutPlan: LayoutPlan | null = useMemo(() => {
    if (!showLayoutGuide) return null;
    return resolveLayoutPlan(slide.id, slideRole as any, slide.content, styleKit);
  }, [slide.id, slideRole, slide.content, styleKit, showLayoutGuide]);

  // Convert relative position to pixel position
  const toPixels = useCallback((rel: { x: number; y: number; width: number; height: number }) => {
    const container = canvasRef.current;
    if (!container) return { x: 0, y: 0, width: 0, height: 0 };

    const rect = container.getBoundingClientRect();
    return {
      x: rel.x * rect.width,
      y: rel.y * rect.height,
      width: rel.width * rect.width,
      height: rel.height * rect.height,
    };
  }, []);

  // Convert pixel position to relative position
  const toRelative = useCallback((pixels: { x: number; y: number; width: number; height: number }) => {
    const container = canvasRef.current;
    if (!container) return { x: 0, y: 0, width: 0, height: 0 };

    const rect = container.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1 - pixels.width / rect.width, pixels.x / rect.width)),
      y: Math.max(0, Math.min(1 - pixels.height / rect.height, pixels.y / rect.height)),
      width: Math.max(MIN_SIZE, pixels.width / rect.width),
      height: Math.max(MIN_SIZE, pixels.height / rect.height),
    };
  }, []);

  // Handle mouse down on element (start drag)
  const handleElementMouseDown = useCallback(
    (e: React.MouseEvent, block: ContentBlock) => {
      if (readOnly) return;
      e.stopPropagation();

      setSelectedElement({ slideId: slide.id, elementId: block.id });

      // Locked elements can be selected but not dragged
      if (block.locked) return;

      const pixels = toPixels(block.position);
      setDragState({
        blockId: block.id,
        startX: e.clientX,
        startY: e.clientY,
        originalPosition: { ...block.position },
      });
    },
    [readOnly, slide.id, setSelectedElement, toPixels]
  );

  // Handle mouse down on resize handle
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, block: ContentBlock, handle: string) => {
      if (readOnly || block.locked) return;
      e.stopPropagation();

      setResizeState({
        blockId: block.id,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        originalPosition: { ...block.position },
      });
    },
    [readOnly]
  );

  // Handle mouse move (drag or resize)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragState) {
        const deltaX = e.clientX - dragState.startX;
        const deltaY = e.clientY - dragState.startY;

        const container = canvasRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const relX = deltaX / rect.width;
        const relY = deltaY / rect.height;

        let newPosition = {
          x: Math.max(0, Math.min(1 - dragState.originalPosition.width, dragState.originalPosition.x + relX)),
          y: Math.max(0, Math.min(1 - dragState.originalPosition.height, dragState.originalPosition.y + relY)),
          width: dragState.originalPosition.width,
          height: dragState.originalPosition.height,
        };

        // Snap-to-zone: 拖拽结束时尝试吸附到 zone
        if (layoutPlan) {
          const snapped = snapToZone(newPosition, layoutPlan.zones);
          if (snapped) {
            newPosition = { x: snapped.x, y: snapped.y, width: snapped.width, height: snapped.height };
          }

          // 检测悬停的 zone
          const hovered = findHoveredZone(newPosition, layoutPlan.zones);
          setHoveredZoneId(hovered?.id ?? null);
        }

        onUpdate(dragState.blockId, { position: newPosition }, 'move');
      }

      if (resizeState) {
        const deltaX = e.clientX - resizeState.startX;
        const deltaY = e.clientY - resizeState.startY;

        const container = canvasRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const relX = deltaX / rect.width;
        const relY = deltaY / rect.height;

        let newPosition = { ...resizeState.originalPosition };

        switch (resizeState.handle) {
          case 'se': // Southeast
            newPosition.width = Math.max(MIN_SIZE, resizeState.originalPosition.width + relX);
            newPosition.height = Math.max(MIN_SIZE, resizeState.originalPosition.height + relY);
            break;
          case 'sw': // Southwest
            newPosition.x = resizeState.originalPosition.x + relX;
            newPosition.width = Math.max(MIN_SIZE, resizeState.originalPosition.width - relX);
            newPosition.height = Math.max(MIN_SIZE, resizeState.originalPosition.height + relY);
            break;
          case 'ne': // Northeast
            newPosition.width = Math.max(MIN_SIZE, resizeState.originalPosition.width + relX);
            newPosition.y = resizeState.originalPosition.y + relY;
            newPosition.height = Math.max(MIN_SIZE, resizeState.originalPosition.height - relY);
            break;
          case 'nw': // Northwest
            newPosition.x = resizeState.originalPosition.x + relX;
            newPosition.width = Math.max(MIN_SIZE, resizeState.originalPosition.width - relX);
            newPosition.y = resizeState.originalPosition.y + relY;
            newPosition.height = Math.max(MIN_SIZE, resizeState.originalPosition.height - relY);
            break;
        }

        // Ensure minimum size and bounds
        newPosition.x = Math.max(0, newPosition.x);
        newPosition.y = Math.max(0, newPosition.y);

        onUpdate(resizeState.blockId, { position: newPosition }, 'resize');
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
      setResizeState(null);
      setHoveredZoneId(null);
    };

    if (dragState || resizeState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, resizeState, onUpdate]);

  // Handle click on canvas (deselect)
  const handleCanvasClick = useCallback(() => {
    setSelectedElement(null);
  }, [setSelectedElement]);

  return (
    <div
      ref={canvasRef}
      className="relative w-full aspect-video bg-white rounded-lg overflow-hidden"
      onClick={handleCanvasClick}
      style={styleKit ? {
        backgroundColor: styleKit.styleDNA.palette.background,
        borderRadius: `${styleKit.styleDNA.effects.borderRadius}px`,
      } : undefined}
    >
      {/* Layout guide overlay */}
      {showLayoutGuide && layoutPlan && (
        <LayoutGuide
          zones={layoutPlan.zones}
          highlightedZoneId={hoveredZoneId}
        />
      )}

      {/* Render each content block */}
      {slide.content.map((block) => {
        const pixels = toPixels(block.position);
        const isSelected =
          selectedElement?.slideId === slide.id && selectedElement?.elementId === block.id;
        const isHovered =
          hoveredElement?.slideId === slide.id && hoveredElement?.elementId === block.id;

        return (
          <div
            key={block.id}
            className={`absolute ${block.locked ? 'cursor-default' : 'cursor-move'} ${
              isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
            } ${isHovered && !isSelected ? 'ring-1 ring-blue-300' : ''}`}
            style={{
              left: pixels.x,
              top: pixels.y,
              width: pixels.width,
              height: pixels.height,
            }}
            onMouseDown={(e) => handleElementMouseDown(e, block)}
            onMouseEnter={() => setHoveredElement({ slideId: slide.id, elementId: block.id })}
            onMouseLeave={() => setHoveredElement(null)}
          >
            {/* Content */}
            <div className="w-full h-full p-1 overflow-hidden">
              {block.type === 'text' || block.type === 'list' ? (
                <div
                  className="text-sm"
                  style={{
                    fontSize: block.style?.fontSize ? `${block.style.fontSize}px` : '14px',
                    fontWeight: block.style?.fontWeight || 'normal',
                    color: block.style?.color || '#000',
                    textAlign: block.style?.align || 'left',
                  }}
                >
                  {block.content}
                </div>
              ) : block.type === 'image' ? (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <span className="text-xs text-gray-400">图片</span>
                </div>
              ) : block.type === 'chart' ? (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <span className="text-xs text-gray-400">图表</span>
                </div>
              ) : null}
            </div>

            {/* Lock indicator */}
            {block.locked && (
              <div className="absolute top-1 right-1 p-0.5 bg-amber-100 rounded">
                <Lock size={10} className="text-amber-600" />
              </div>
            )}

            {/* Resize handles (only when selected and not locked) */}
            {isSelected && !readOnly && !block.locked && (
              <>
                {/* Corner handles */}
                <div
                  className="absolute w-2 h-2 bg-blue-500 rounded-sm cursor-nwse-resize -top-1 -left-1"
                  onMouseDown={(e) => handleResizeMouseDown(e, block, 'nw')}
                />
                <div
                  className="absolute w-2 h-2 bg-blue-500 rounded-sm cursor-nesw-resize -top-1 -right-1"
                  onMouseDown={(e) => handleResizeMouseDown(e, block, 'ne')}
                />
                <div
                  className="absolute w-2 h-2 bg-blue-500 rounded-sm cursor-nesw-resize -bottom-1 -left-1"
                  onMouseDown={(e) => handleResizeMouseDown(e, block, 'sw')}
                />
                <div
                  className="absolute w-2 h-2 bg-blue-500 rounded-sm cursor-nwse-resize -bottom-1 -right-1"
                  onMouseDown={(e) => handleResizeMouseDown(e, block, 'se')}
                />
                {/* Edge handles */}
                <div
                  className="absolute w-full h-1 bg-blue-500/50 cursor-ns-resize top-1/2 -translate-y-1/2 left-0"
                  style={{ height: '4px' }}
                  onMouseDown={(e) => handleResizeMouseDown(e, block, 'n')}
                />
                <div
                  className="absolute w-full h-1 bg-blue-500/50 cursor-ns-resize bottom-0 left-0"
                  style={{ height: '4px' }}
                  onMouseDown={(e) => handleResizeMouseDown(e, block, 's')}
                />
                <div
                  className="absolute w-1 h-full bg-blue-500/50 cursor-ew-resize left-1/2 -translate-x-1/2 top-0"
                  style={{ width: '4px' }}
                  onMouseDown={(e) => handleResizeMouseDown(e, block, 'w')}
                />
                <div
                  className="absolute w-1 h-full bg-blue-500/50 cursor-ew-resize right-0 top-0"
                  style={{ width: '4px' }}
                  onMouseDown={(e) => handleResizeMouseDown(e, block, 'e')}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
