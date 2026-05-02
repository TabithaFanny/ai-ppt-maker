// 生成管道类型 — DeckPlan, SlidePlan, LayoutPlan, RenderSpec, EditPatch
// Phase 1-5 的类型定义，渐进式引入

import type { SlideRole, LayoutType, LayoutZone } from './stylekit';
import type { SlideElement } from './elements';
import type { ScenarioType, AudienceType } from './project';

// ============ RewriteMode (Phase D2) ============

export type RewriteMode = 'professional' | 'concise' | 'persuasive' | 'defense';

// ============ DeckPlan (内容规划层) — Phase 1 ============

export interface SlidePlan {
  id: string;
  index: number;
  role: SlideRole;
  title: string;
  mainConclusion: string;
  contentOutline: {
    type: SlideElement['type'];
    description: string;
    required: boolean;
  }[];
  layoutHint?: LayoutType;
}

export interface DeckPlan {
  id: string;
  projectId: string;
  title: string;
  scenario: ScenarioType;
  audience: AudienceType;
  slidePlans: SlidePlan[];
  metadata: {
    totalPages: number;
    generatedAt: number;
  };
}

// ============ LayoutPlan (区域布局) — Phase 3 ============

export interface ResolvedZone extends LayoutZone {
  assignedElementId?: string;
  isOccupied: boolean;
}

export interface LayoutPlan {
  slideId: string;
  slideRole: SlideRole;
  layoutType: LayoutType;
  zones: ResolvedZone[];
}

// ============ RenderSpec (结构化渲染规范) — Phase 4 ============

export interface RenderElement {
  id: string;
  sourceElementId: string;
  type: SlideElement['type'];
  content: string;
  resolvedPosition: { x: number; y: number; width: number; height: number };
  resolvedStyle: {
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    color: string;
    align: string;
  };
  pptxOptions?: Record<string, unknown>;
}

export interface RenderSlide {
  id: string;
  slideRole: SlideRole;
  background: string;
  elements: RenderElement[];
}

export interface RenderSpec {
  id: string;
  projectId: string;
  styleKitId: string;
  slides: RenderSlide[];
  validationPassed: boolean;
  issues: ResidualIssue[];
}

// ============ EditPatch (单点修改) — Phase 5 ============

export interface EditPatch {
  id: string;
  timestamp: number;
  slideId: string;
  elementId?: string;
  operation:
    | 'update_text'
    | 'batch_update_text'
    | 'move_element'
    | 'resize_element'
    | 'delete_element'
    | 'add_element'
    | 'replace_layout'
    | 'update_title'
    | 'update_conclusion'
    | 'update_speaker_notes';
  oldValue: unknown;
  newValue: unknown;
  description: string;
}

// ============ 质量检查 (共享) ============

export interface ResidualIssue {
  type: 'missing_asset' | 'inconsistent_layout' | 'text_overflow' | 'empty_block' | 'style_deviation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  elementId?: string;
  slideId?: string;
  description: string;
  suggestion?: string;
}

export interface ResidualCheck {
  slideId: string;
  issues: ResidualIssue[];
}
