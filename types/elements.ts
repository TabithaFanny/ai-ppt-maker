// 统一元素类型 — 合并 ContentBlock(旧) + ContentElement(StyleKit)

/** 统一的幻灯片元素类型 (新系统使用) */
export interface SlideElement {
  id: string;
  type: 'heading' | 'paragraph' | 'bullet-list' | 'image' | 'chart' | 'icon' | 'decoration' | 'caption';
  content: string;
  position: { x: number; y: number; width: number; height: number };
  style?: {
    fontSize?: number;
    fontWeight?: 'normal' | 'bold';
    color?: string;
    align?: 'left' | 'center' | 'right';
  };
  zoneId?: string;
  locked?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * 旧版内容块类型 (PPTJson 现有格式)
 * @deprecated 新代码请使用 SlideElement。现有 PPTJson 仍在使用此类型，
 * Phase 1 DeckPlan 迁移完成后将逐步替换。
 */
export interface ContentBlock {
  id: string;
  type: 'text' | 'image' | 'chart' | 'list';
  content: string;
  position: { x: number; y: number; width: number; height: number };
  style?: {
    fontSize?: number;
    fontWeight?: string;
    color?: string;
    align?: 'left' | 'center' | 'right';
  };
  locked?: boolean;
}
