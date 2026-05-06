/**
 * DeckPlan → PPTJson 转换模块
 * 将结构化规划解析为可渲染的 PPTJson
 */

import { DeckPlan, PPTJson, Slide, ContentBlock, StyleConfig, StyleKit } from '@/types';
import type { SlideRole, LayoutType } from '@/types';
import { resolveStyleConfig } from './style-bridge';
import { resolveLayoutPlan, chooseLayoutForRole } from './layout-resolver';

/** SlideRole → Slide.layout 映射 */
const ROLE_TO_LAYOUT: Record<SlideRole, Slide['layout']> = {
  'cover': 'title',
  'toc': 'content',
  'section-header': 'title',
  'content': 'content',
  'image-focus': 'image',
  'data-display': 'chart',
  'quote': 'quote',
  'comparison': 'content',
  'summary': 'content',
  'closing': 'title',
  // AI PPT 助手新增角色
  'agenda': 'content',
  'background': 'content',
  'problem': 'content',
  'insight': 'content',
  'solution': 'content',
  'architecture': 'content',
  'feature': 'content',
  'workflow': 'content',
  'case': 'content',
  'data': 'chart',
  'business': 'content',
  'team': 'content',
};

/** 根据 SlideRole 和 StyleKit 选择最佳布局类型（委托给 layout-resolver） */
function chooseLayoutType(role: SlideRole, styleKit?: StyleKit): LayoutType {
  return chooseLayoutForRole(role, styleKit);
}

/** 根据布局类型和内容大纲生成 ContentBlock 位置（基于 zone 系统） */
function generatePositions(
  layoutType: LayoutType,
  contentOutline: { type: string; description: string; required: boolean }[],
  styleConfig: StyleConfig,
  slideRole?: SlideRole,
  styleKit?: StyleKit
): ContentBlock[] {
  // 使用 layout-resolver 获取 zone 布局
  const tempSlideId = crypto.randomUUID();
  const layoutPlan = resolveLayoutPlan(tempSlideId, slideRole || 'content', [], styleKit, layoutType);
  const zones = layoutPlan.zones;

  // 将 contentOutline 项匹配到 zone
  const blocks: ContentBlock[] = [];
  const usedZoneIds = new Set<string>();

  for (const item of contentOutline) {
    const contentType = mapOutlineToContentType(item.type);

    // 找匹配的未使用 zone
    const matchingZone = zones.find(
      (z) => !usedZoneIds.has(z.id) && z.contentType === contentType
    );

    // 如果没有精确匹配，找任意未使用的 zone
    const zone = matchingZone || zones.find((z) => !usedZoneIds.has(z.id));

    if (zone) {
      usedZoneIds.add(zone.id);
      blocks.push({
        id: crypto.randomUUID(),
        type: mapOutlineType(item.type),
        content: item.description,
        position: { ...zone.position },
        style: {
          fontSize: item.type === 'heading' ? styleConfig.typography.titleSize : styleConfig.typography.bodySize,
          fontWeight: item.type === 'heading' ? 'bold' : 'normal',
          color: styleConfig.palette.text,
          align: 'left',
        },
      });
    }
  }

  return blocks;
}

/** 内容大纲类型 → zone contentType 映射 */
function mapOutlineToContentType(type: string): 'text' | 'image' | 'chart' | 'icon' | 'decoration' {
  switch (type) {
    case 'heading':
    case 'paragraph':
    case 'bullet-list':
    case 'caption':
      return 'text';
    case 'image':
      return 'image';
    case 'chart':
      return 'chart';
    case 'icon':
      return 'icon';
    case 'decoration':
      return 'decoration';
    default:
      return 'text';
  }
}

/** 内容大纲类型 → ContentBlock 类型映射 */
function mapOutlineType(type: string): ContentBlock['type'] {
  switch (type) {
    case 'heading': return 'text';
    case 'paragraph': return 'text';
    case 'bullet-list': return 'list';
    case 'image': return 'image';
    case 'chart': return 'chart';
    default: return 'text';
  }
}

/**
 * 将 DeckPlan 解析为 PPTJson
 */
export function resolveDeckPlanToPPTJson(
  deckPlan: DeckPlan,
  styleConfigOrKit: StyleConfig | StyleKit
): PPTJson {
  const styleConfig = 'styleDNA' in styleConfigOrKit
    ? resolveStyleConfig({ styleKit: styleConfigOrKit })
    : styleConfigOrKit;

  if (!styleConfig) {
    throw new Error('Style configuration is required');
  }

  const styleKit = 'styleDNA' in styleConfigOrKit ? styleConfigOrKit : undefined;

  const slides: Slide[] = deckPlan.slidePlans.map(plan => {
    const layoutType = chooseLayoutType(plan.role, styleKit);
    const content = generatePositions(layoutType, plan.contentOutline, styleConfig, plan.role, styleKit);

    return {
      id: plan.id,
      layout: ROLE_TO_LAYOUT[plan.role],
      title: plan.title,
      mainConclusion: plan.mainConclusion,
      content,
    };
  });

  return {
    metadata: {
      projectId: deckPlan.projectId,
      title: deckPlan.title,
      category: deckPlan.scenario,
      audience: deckPlan.audience,
      createdAt: new Date().toISOString(),
    },
    designSystem: {
      palette: styleConfig.palette,
      typography: styleConfig.typography,
    },
    roles: {
      designer: 'AI DeckPlanner',
      contentStrategist: 'AI Content Planner',
      visualDirector: 'AI Layout Resolver',
    },
    slides,
  };
}
