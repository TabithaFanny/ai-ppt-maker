/**
 * LayoutPlan 区域布局解析器
 * 根据 SlideRole + StyleKit → LayoutPlan（zone 坐标 + 元素分配）
 */

import type { SlideRole, LayoutType, StyleKit, LayoutZone } from '@/types/stylekit';
import type { ContentBlock } from '@/types/elements';
import type { LayoutPlan, ResolvedZone } from '@/types/generation';
// DEFAULT_SLIDE_ROLE_DEFINITIONS imported only when needed

/** 预设 zone 布局模板（无 StyleKit 时的 fallback） */
const FALLBACK_ZONES: Record<LayoutType, LayoutZone[]> = {
  hero: [
    { id: 'hero-title', name: '标题', position: { x: 0.1, y: 0.2, width: 0.8, height: 0.2 }, contentType: 'text' },
    { id: 'hero-subtitle', name: '副标题', position: { x: 0.15, y: 0.45, width: 0.7, height: 0.12 }, contentType: 'text' },
    { id: 'hero-decoration', name: '装饰', position: { x: 0.3, y: 0.65, width: 0.4, height: 0.15 }, contentType: 'decoration' },
  ],
  'two-column': [
    { id: 'tc-title', name: '标题', position: { x: 0.05, y: 0.05, width: 0.9, height: 0.12 }, contentType: 'text' },
    { id: 'tc-left', name: '左栏', position: { x: 0.05, y: 0.2, width: 0.43, height: 0.7 }, contentType: 'text' },
    { id: 'tc-right', name: '右栏', position: { x: 0.52, y: 0.2, width: 0.43, height: 0.7 }, contentType: 'text' },
  ],
  grid: [
    { id: 'grid-title', name: '标题', position: { x: 0.05, y: 0.05, width: 0.9, height: 0.12 }, contentType: 'text' },
    { id: 'grid-1', name: '格子1', position: { x: 0.05, y: 0.2, width: 0.28, height: 0.35 }, contentType: 'text' },
    { id: 'grid-2', name: '格子2', position: { x: 0.36, y: 0.2, width: 0.28, height: 0.35 }, contentType: 'text' },
    { id: 'grid-3', name: '格子3', position: { x: 0.67, y: 0.2, width: 0.28, height: 0.35 }, contentType: 'text' },
    { id: 'grid-4', name: '格子4', position: { x: 0.05, y: 0.58, width: 0.28, height: 0.35 }, contentType: 'text' },
    { id: 'grid-5', name: '格子5', position: { x: 0.36, y: 0.58, width: 0.28, height: 0.35 }, contentType: 'text' },
    { id: 'grid-6', name: '格子6', position: { x: 0.67, y: 0.58, width: 0.28, height: 0.35 }, contentType: 'text' },
  ],
  centered: [
    { id: 'center-title', name: '标题', position: { x: 0.1, y: 0.15, width: 0.8, height: 0.2 }, contentType: 'text' },
    { id: 'center-body', name: '正文', position: { x: 0.15, y: 0.4, width: 0.7, height: 0.4 }, contentType: 'text' },
  ],
  'full-bleed': [
    { id: 'fb-image', name: '全幅图片', position: { x: 0, y: 0, width: 1, height: 0.75 }, contentType: 'image' },
    { id: 'fb-caption', name: '说明', position: { x: 0.1, y: 0.78, width: 0.8, height: 0.15 }, contentType: 'text' },
  ],
  quote: [
    { id: 'quote-mark', name: '引号装饰', position: { x: 0.08, y: 0.1, width: 0.12, height: 0.15 }, contentType: 'decoration' },
    { id: 'quote-text', name: '引言', position: { x: 0.1, y: 0.25, width: 0.8, height: 0.45 }, contentType: 'text' },
    { id: 'quote-source', name: '出处', position: { x: 0.5, y: 0.75, width: 0.4, height: 0.1 }, contentType: 'text' },
  ],
  'data-chart': [
    { id: 'dc-title', name: '标题', position: { x: 0.05, y: 0.05, width: 0.9, height: 0.1 }, contentType: 'text' },
    { id: 'dc-chart', name: '图表', position: { x: 0.05, y: 0.18, width: 0.55, height: 0.72 }, contentType: 'chart' },
    { id: 'dc-notes', name: '说明', position: { x: 0.65, y: 0.18, width: 0.3, height: 0.72 }, contentType: 'text' },
  ],
  comparison: [
    { id: 'cmp-title', name: '标题', position: { x: 0.05, y: 0.05, width: 0.9, height: 0.1 }, contentType: 'text' },
    { id: 'cmp-left-header', name: '左标题', position: { x: 0.05, y: 0.18, width: 0.43, height: 0.08 }, contentType: 'text' },
    { id: 'cmp-left', name: '左侧内容', position: { x: 0.05, y: 0.28, width: 0.43, height: 0.62 }, contentType: 'text' },
    { id: 'cmp-right-header', name: '右标题', position: { x: 0.52, y: 0.18, width: 0.43, height: 0.08 }, contentType: 'text' },
    { id: 'cmp-right', name: '右侧内容', position: { x: 0.52, y: 0.28, width: 0.43, height: 0.62 }, contentType: 'text' },
  ],
  timeline: [
    { id: 'tl-title', name: '标题', position: { x: 0.05, y: 0.05, width: 0.9, height: 0.1 }, contentType: 'text' },
    { id: 'tl-line', name: '时间线', position: { x: 0.05, y: 0.2, width: 0.9, height: 0.02 }, contentType: 'decoration' },
    { id: 'tl-1', name: '节点1', position: { x: 0.05, y: 0.28, width: 0.28, height: 0.3 }, contentType: 'text' },
    { id: 'tl-2', name: '节点2', position: { x: 0.36, y: 0.28, width: 0.28, height: 0.3 }, contentType: 'text' },
    { id: 'tl-3', name: '节点3', position: { x: 0.67, y: 0.28, width: 0.28, height: 0.3 }, contentType: 'text' },
  ],
  gallery: [
    { id: 'gal-title', name: '标题', position: { x: 0.05, y: 0.05, width: 0.9, height: 0.1 }, contentType: 'text' },
    { id: 'gal-1', name: '图片1', position: { x: 0.05, y: 0.18, width: 0.43, height: 0.38 }, contentType: 'image' },
    { id: 'gal-2', name: '图片2', position: { x: 0.52, y: 0.18, width: 0.43, height: 0.38 }, contentType: 'image' },
    { id: 'gal-3', name: '图片3', position: { x: 0.05, y: 0.59, width: 0.43, height: 0.38 }, contentType: 'image' },
    { id: 'gal-4', name: '图片4', position: { x: 0.52, y: 0.59, width: 0.43, height: 0.38 }, contentType: 'image' },
  ],
};

/** SlideRole → 默认 LayoutType 映射 */
const ROLE_DEFAULT_LAYOUT: Record<SlideRole, LayoutType> = {
  cover: 'hero',
  toc: 'grid',
  'section-header': 'centered',
  content: 'two-column',
  'image-focus': 'full-bleed',
  'data-display': 'data-chart',
  quote: 'quote',
  comparison: 'comparison',
  summary: 'grid',
  closing: 'centered',
  // AI PPT 助手新增角色
  agenda: 'grid',
  background: 'two-column',
  problem: 'two-column',
  insight: 'two-column',
  solution: 'two-column',
  architecture: 'two-column',
  feature: 'grid',
  workflow: 'timeline',
  case: 'two-column',
  data: 'data-chart',
  business: 'two-column',
  team: 'grid',
};

/**
 * 根据 SlideRole 和 StyleKit 选择最佳布局类型
 */
export function chooseLayoutForRole(role: SlideRole, styleKit?: StyleKit | null): LayoutType {
  if (styleKit) {
    const roleDef = styleKit.slideRoleDefinitions.find((d) => d.role === role);
    if (roleDef && roleDef.recommendedLayouts.length > 0) {
      return roleDef.recommendedLayouts[0];
    }
  }
  return ROLE_DEFAULT_LAYOUT[role] || 'two-column';
}

/**
 * 获取布局的 zone 定义
 * 优先从 StyleKit 的 layoutPatterns 中查找，否则使用 fallback
 */
function getZonesForLayout(layoutType: LayoutType, styleKit?: StyleKit | null): LayoutZone[] {
  if (styleKit) {
    const pattern = styleKit.layoutPatterns.find((p) => p.layoutType === layoutType);
    if (pattern && pattern.structure.zones.length > 0) {
      return pattern.structure.zones;
    }
  }
  return FALLBACK_ZONES[layoutType] || FALLBACK_ZONES['two-column'];
}

/**
 * 将 ContentBlock 匹配到最佳 zone
 * 匹配策略：按 contentType 匹配，同类型中按位置就近分配
 */
function assignBlocksToZones(
  zones: LayoutZone[],
  blocks: ContentBlock[]
): ResolvedZone[] {
  const resolved: ResolvedZone[] = zones.map((zone) => ({
    ...zone,
    isOccupied: false,
  }));

  // 已分配的 block id 集合
  const assigned = new Set<string>();

  // 第一轮：按 contentType 精确匹配
  for (const block of blocks) {
    if (assigned.has(block.id)) continue;

    const blockContentType = mapBlockTypeToContentType(block.type);
    const matchingZone = resolved.find(
      (z) => !z.isOccupied && z.contentType === blockContentType
    );

    if (matchingZone) {
      matchingZone.assignedElementId = block.id;
      matchingZone.isOccupied = true;
      assigned.add(block.id);
    }
  }

  // 第二轮：未分配的 block 就近放入空闲 zone
  for (const block of blocks) {
    if (assigned.has(block.id)) continue;

    const blockCenter = {
      x: block.position.x + block.position.width / 2,
      y: block.position.y + block.position.height / 2,
    };

    // 找最近的空闲 zone
    let bestZone: ResolvedZone | null = null;
    let bestDist = Infinity;

    for (const zone of resolved) {
      if (zone.isOccupied) continue;

      const zoneCenter = {
        x: zone.position.x + zone.position.width / 2,
        y: zone.position.y + zone.position.height / 2,
      };

      const dist = Math.hypot(
        blockCenter.x - zoneCenter.x,
        blockCenter.y - zoneCenter.y
      );

      if (dist < bestDist) {
        bestDist = dist;
        bestZone = zone;
      }
    }

    if (bestZone) {
      bestZone.assignedElementId = block.id;
      bestZone.isOccupied = true;
      assigned.add(block.id);
    }
  }

  return resolved;
}

/** ContentBlock.type → LayoutZone.contentType 映射 */
function mapBlockTypeToContentType(
  blockType: ContentBlock['type']
): LayoutZone['contentType'] {
  switch (blockType) {
    case 'text':
    case 'list':
      return 'text';
    case 'image':
      return 'image';
    case 'chart':
      return 'chart';
    default:
      return 'text';
  }
}

/**
 * 解析单页的 LayoutPlan
 */
export function resolveLayoutPlan(
  slideId: string,
  slideRole: SlideRole,
  blocks: ContentBlock[],
  styleKit?: StyleKit | null,
  layoutTypeOverride?: LayoutType
): LayoutPlan {
  const layoutType = layoutTypeOverride || chooseLayoutForRole(slideRole, styleKit);
  const zones = getZonesForLayout(layoutType, styleKit);
  const resolvedZones = assignBlocksToZones(zones, blocks);

  return {
    slideId,
    slideRole,
    layoutType,
    zones: resolvedZones,
  };
}

/**
 * 根据 zone 位置生成 snap 后的元素位置
 * 返回 null 表示不 snap（距离太远）
 */
export function snapToZone(
  elementPosition: { x: number; y: number; width: number; height: number },
  zones: ResolvedZone[],
  threshold = 0.08
): { x: number; y: number; width: number; height: number; zoneId: string } | null {
  const elementCenter = {
    x: elementPosition.x + elementPosition.width / 2,
    y: elementPosition.y + elementPosition.height / 2,
  };

  let bestZone: ResolvedZone | null = null;
  let bestDist = Infinity;

  for (const zone of zones) {
    const zoneCenter = {
      x: zone.position.x + zone.position.width / 2,
      y: zone.position.y + zone.position.height / 2,
    };

    const dist = Math.hypot(
      elementCenter.x - zoneCenter.x,
      elementCenter.y - zoneCenter.y
    );

    if (dist < bestDist) {
      bestDist = dist;
      bestZone = zone;
    }
  }

  if (!bestZone || bestDist > threshold) {
    return null;
  }

  return {
    ...bestZone.position,
    zoneId: bestZone.id,
  };
}

/**
 * 检测元素是否悬停在某个 zone 上方
 */
export function findHoveredZone(
  elementPosition: { x: number; y: number; width: number; height: number },
  zones: ResolvedZone[]
): ResolvedZone | null {
  const elementCenter = {
    x: elementPosition.x + elementPosition.width / 2,
    y: elementPosition.y + elementPosition.height / 2,
  };

  for (const zone of zones) {
    const inX =
      elementCenter.x >= zone.position.x &&
      elementCenter.x <= zone.position.x + zone.position.width;
    const inY =
      elementCenter.y >= zone.position.y &&
      elementCenter.y <= zone.position.y + zone.position.height;

    if (inX && inY) {
      return zone;
    }
  }

  return null;
}
