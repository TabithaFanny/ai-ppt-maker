// StyleKit 系统类型 — 风格基因、布局模式、页面角色、内容规则、场景适配

// ----------- StyleDNA (风格基因) -----------

export interface StyleDNA {
  id: string;
  name: string;
  sourceFileId: string;

  palette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };

  typography: {
    titleFont: string;
    bodyFont: string;
    titleSize: number;
    subtitleSize: number;
    bodySize: number;
    captionSize: number;
  };

  spacing: {
    slidePadding: number;
    contentMargin: number;
    elementGap: number;
  };

  effects: {
    shadowEnabled: boolean;
    shadowType: 'soft' | 'hard' | 'none';
    borderRadius: number;
    gradientEnabled: boolean;
  };

  mood: 'professional' | 'creative' | 'academic' | 'casual';
  moodDescription: string;

  createdAt: number;
  updatedAt: number;
}

// ----------- LayoutPattern (布局模式) -----------

export type LayoutType =
  | 'hero'
  | 'two-column'
  | 'grid'
  | 'centered'
  | 'full-bleed'
  | 'quote'
  | 'data-chart'
  | 'comparison'
  | 'timeline'
  | 'gallery';

export interface LayoutZone {
  id: string;
  name: string;
  position: { x: number; y: number; width: number; height: number };
  contentType: 'image' | 'text' | 'chart' | 'icon' | 'decoration';
  preferredAspectRatio?: number;
}

export interface GridDefinition {
  columns: number;
  rows: number;
  gap: number;
  columnWidth?: number;
  rowHeight?: number;
}

export interface LayoutPattern {
  id: string;
  styleKitId: string;

  layoutType: LayoutType;

  structure: {
    zones: LayoutZone[];
    gridDefinition?: GridDefinition;
  };

  applicableSlides: SlideRole[];
  bestFor: string[];

  thumbnailBase64?: string;

  layoutPrompt: string;
}

// ----------- SlideRole (页面角色) -----------

export type SlideRole =
  | 'cover'
  | 'toc'
  | 'section-header'
  | 'content'
  | 'image-focus'
  | 'data-display'
  | 'quote'
  | 'comparison'
  | 'summary'
  | 'closing'
  // 新增：AI PPT 助手支持的角色
  | 'agenda'
  | 'background'
  | 'problem'
  | 'insight'
  | 'solution'
  | 'architecture'
  | 'feature'
  | 'workflow'
  | 'case'
  | 'data'
  | 'business'
  | 'team';

export interface ContentElement {
  type: 'heading' | 'paragraph' | 'bullet-list' | 'image' | 'chart' | 'icon' | 'decoration' | 'caption';
  required: boolean;
}

export interface SlideRoleDefinition {
  role: SlideRole;

  contentStructure: {
    required: ContentElement[];
    optional: ContentElement[];
    maxElements: number;
  };

  recommendedLayouts: LayoutType[];

  generationHints: string[];

  priority: number;
}

// ----------- ContentRules (内容规则) -----------

export interface ContentBlockRule {
  id: string;
  type: 'heading' | 'paragraph' | 'bullet-list' | 'image' | 'chart' | 'icon' | 'decoration';
  position: { zone: string; order: number };
  style: {
    fontSize?: number;
    fontWeight?: 'normal' | 'bold';
    color?: string;
    align?: 'left' | 'center' | 'right';
  };
  contentRules?: {
    maxLength?: number;
    maxLines?: number;
    prefix?: string;
  };
}

export interface ContentRules {
  slideRole: SlideRole;
  styleKitId: string;

  blocks: ContentBlockRule[];

  layoutRules: {
    respectWhitespace: boolean;
    maintainVisualHierarchy: boolean;
    allowOverflow: boolean;
  };
}

// ----------- ScenarioAdapter (场景适配器) -----------

export type Scenario =
  | 'course'
  | 'defense'
  | 'pitch'
  | 'report'
  | 'proposal'
  | 'training'
  | 'meeting'
  | 'academic';

export interface ScenarioAdapter {
  id: string;
  scenario: Scenario;

  recommendedStyleKitIds: string[];

  slideStructure: {
    order: SlideRole[];
    pageCountRange: { min: number; max: number };
  };

  adjustments: {
    emphasis: string[];
    layoutPreference: 'compact' | 'standard' | 'expanded';
    toneAdjustment: string;
  };

  additionalPromptHints: string[];
}

// ----------- StyleKit (完整风格包) -----------

export interface StyleKit {
  id: string;
  name: string;
  sourceFileId: string;

  styleDNA: StyleDNA;

  layoutPatterns: LayoutPattern[];

  slideRoleDefinitions: SlideRoleDefinition[];

  contentRules: ContentRules[];

  scenarioAdapters: ScenarioAdapter[];

  stats: {
    usageCount: number;
    averageRating?: number;
    feedbackCount: number;
  };

  createdAt: number;
  updatedAt: number;
}

// ----------- 工具函数 -----------

export const DEFAULT_SLIDE_ROLE_DEFINITIONS: SlideRoleDefinition[] = [
  {
    role: 'cover',
    contentStructure: {
      required: [{ type: 'heading', required: true }],
      optional: [
        { type: 'paragraph', required: false },
        { type: 'decoration', required: false },
      ],
      maxElements: 4,
    },
    recommendedLayouts: ['hero', 'centered', 'full-bleed'],
    generationHints: ['大标题突出主题', '使用品牌色或主色调', '简洁有力，留白充足'],
    priority: 1,
  },
  {
    role: 'toc',
    contentStructure: {
      required: [{ type: 'heading', required: true }],
      optional: [
        { type: 'bullet-list', required: false },
        { type: 'decoration', required: false },
      ],
      maxElements: 8,
    },
    recommendedLayouts: ['grid', 'two-column'],
    generationHints: ['目录项清晰有条理', '使用编号或图标区分', '布局整齐对称'],
    priority: 2,
  },
  {
    role: 'section-header',
    contentStructure: {
      required: [{ type: 'heading', required: true }],
      optional: [
        { type: 'paragraph', required: false },
        { type: 'decoration', required: false },
      ],
      maxElements: 3,
    },
    recommendedLayouts: ['hero', 'centered'],
    generationHints: ['章节标题醒目', '可配合小节编号', '视觉冲击要强'],
    priority: 3,
  },
  {
    role: 'content',
    contentStructure: {
      required: [
        { type: 'heading', required: true },
        { type: 'paragraph', required: true },
      ],
      optional: [
        { type: 'bullet-list', required: false },
        { type: 'image', required: false },
        { type: 'chart', required: false },
        { type: 'icon', required: false },
      ],
      maxElements: 6,
    },
    recommendedLayouts: ['two-column', 'grid', 'hero'],
    generationHints: ['信息层次分明', '图文配合适当', '重点内容突出'],
    priority: 5,
  },
  {
    role: 'image-focus',
    contentStructure: {
      required: [{ type: 'image', required: true }],
      optional: [
        { type: 'heading', required: false },
        { type: 'caption', required: false },
      ],
      maxElements: 3,
    },
    recommendedLayouts: ['full-bleed', 'gallery', 'hero'],
    generationHints: ['图片质量要高', '图片占据主要空间', '说明文字简洁'],
    priority: 5,
  },
  {
    role: 'data-display',
    contentStructure: {
      required: [
        { type: 'heading', required: true },
        { type: 'chart', required: true },
      ],
      optional: [
        { type: 'paragraph', required: false },
        { type: 'bullet-list', required: false },
      ],
      maxElements: 5,
    },
    recommendedLayouts: ['data-chart', 'grid', 'two-column'],
    generationHints: ['数据可视化清晰', '图表占据核心位置', '配合数据说明'],
    priority: 5,
  },
  {
    role: 'quote',
    contentStructure: {
      required: [{ type: 'paragraph', required: true }],
      optional: [
        { type: 'heading', required: false },
        { type: 'decoration', required: false },
      ],
      maxElements: 3,
    },
    recommendedLayouts: ['quote', 'centered'],
    generationHints: ['引言内容突出', '字体选用有气质', '留白充足，氛围感强'],
    priority: 6,
  },
  {
    role: 'comparison',
    contentStructure: {
      required: [
        { type: 'heading', required: true },
        { type: 'bullet-list', required: true },
      ],
      optional: [
        { type: 'chart', required: false },
        { type: 'decoration', required: false },
      ],
      maxElements: 6,
    },
    recommendedLayouts: ['comparison', 'two-column', 'grid'],
    generationHints: ['对比项清晰排列', '视觉上容易对比', '差异点突出'],
    priority: 5,
  },
  {
    role: 'summary',
    contentStructure: {
      required: [{ type: 'heading', required: true }],
      optional: [
        { type: 'bullet-list', required: false },
        { type: 'paragraph', required: false },
      ],
      maxElements: 5,
    },
    recommendedLayouts: ['centered', 'grid', 'two-column'],
    generationHints: ['总结要点精炼', '层次分明易读', '可配合关键数据'],
    priority: 8,
  },
  {
    role: 'closing',
    contentStructure: {
      required: [{ type: 'heading', required: true }],
      optional: [
        { type: 'paragraph', required: false },
        { type: 'decoration', required: false },
      ],
      maxElements: 3,
    },
    recommendedLayouts: ['centered', 'hero'],
    generationHints: ['结束语有力', '可加感谢语', '联系方式清晰'],
    priority: 9,
  },
];

export function createEmptyStyleDNA(id: string, name: string, sourceFileId: string): StyleDNA {
  const now = Date.now();
  return {
    id,
    name,
    sourceFileId,
    palette: {
      primary: '#1a73e8',
      secondary: '#34a853',
      accent: '#fbbc04',
      background: '#ffffff',
      text: '#202124',
    },
    typography: {
      titleFont: 'Arial',
      bodyFont: 'Helvetica',
      titleSize: 44,
      subtitleSize: 28,
      bodySize: 18,
      captionSize: 14,
    },
    spacing: {
      slidePadding: 40,
      contentMargin: 20,
      elementGap: 12,
    },
    effects: {
      shadowEnabled: true,
      shadowType: 'soft',
      borderRadius: 8,
      gradientEnabled: false,
    },
    mood: 'professional',
    moodDescription: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function createEmptyStyleKit(
  id: string,
  name: string,
  sourceFileId: string,
  styleDNA: StyleDNA
): StyleKit {
  const now = Date.now();
  return {
    id,
    name,
    sourceFileId,
    styleDNA,
    layoutPatterns: [],
    slideRoleDefinitions: [...DEFAULT_SLIDE_ROLE_DEFINITIONS],
    contentRules: [],
    scenarioAdapters: [],
    stats: {
      usageCount: 0,
      feedbackCount: 0,
    },
    createdAt: now,
    updatedAt: now,
  };
}
