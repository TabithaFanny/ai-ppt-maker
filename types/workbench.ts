import type { Slide } from './project';
import type { SlideRole } from './stylekit';

// ===== 元素级拆解类型 =====

export type ElementType =
  | 'title'
  | 'subtitle'
  | 'body'
  | 'bullet_list'
  | 'image'
  | 'icon'
  | 'shape'
  | 'chart'
  | 'table'
  | 'decoration'
  | 'page_number'
  | 'line'
  | 'logo'
  | 'card'
  | 'progress_bar';

export type BackgroundType = 'solid' | 'gradient' | 'image' | 'pattern';

export interface ElementBackground {
  type: BackgroundType;
  colors: string[];
  description: string;
}

export interface VisualElement {
  type: ElementType;
  rect: { x: number; y: number; w: number; h: number };
  content: {
    text?: string;
    imageDescription?: string;
    chartType?: string;
  };
  style?: {
    fontSize?: number;
    fontWeight?: string;
    color?: string;
    backgroundColor?: string;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    borderRadius?: number;
    opacity?: number;
  };
  purpose: string;
}

export interface ElementDecomposition {
  slideIndex: number;
  background: ElementBackground;
  elements: VisualElement[];
  layoutPattern: string;
  reusablePrompt: string;
}

// ===== 左一：参考 PPT 页面 =====

export interface ReferenceSlide {
  id: string;
  slideIndex: number;
  thumbnailBase64: string;
  title: string;
  extractedText: string;
  slideXML?: string;
  layoutType: string;
}

// ===== 左二：参考页反推 Prompt =====

export interface RefSlidePrompt {
  slideIndex: number;

  // 基础信息
  pageType: string;
  visualDescription: string;
  layoutStructure: string;
  colorRules: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fontHierarchy: {
    titleSize: number;
    bodySize: number;
    titleWeight: string;
  };
  reusablePrompt: string;
  styleTags: string[];

  // 元素级拆解
  background?: ElementBackground;
  elements?: VisualElement[];
  layoutPatternDescription?: string;
  styleSummary?: {
    allColors: string[];
    fontSystem: string;
    spacing: string;
    effects: string[];
  };

  // v2: 原始 referenceAnalysis JSON（Prompt 1 完整输出）
  referenceAnalysisRaw?: Record<string, unknown>;
}

// ===== 全局母版（从参考 PPT 跨页提取的共性） =====

export interface MasterTemplate {
  // 共同配色
  colorSystem: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  // 共同背景
  background: {
    type: BackgroundType;
    colors: string[];
    description: string;
  } | null;
  // 共同装饰元素（出现在 50%+ 页面上的元素）
  sharedDecorations: Array<{
    type: ElementType;
    description: string;
    position: 'top' | 'bottom' | 'left' | 'right' | 'corner' | 'full';
    appearsOnPercent: number;
  }>;
  // Logo 信息
  logo: {
    found: boolean;
    description: string;
    position: string;
  } | null;
  // 字体系统
  typography: {
    titleSize: number;
    bodySize: number;
    titleWeight: string;
    fontSystem: string;
  };
  // 风格标签（出现频率最高的）
  styleTags: string[];
  // 综合可复用母版 prompt
  masterPrompt: string;
  // 元数据
  sourceSlideCount: number;
  extractedAt: number;
}

// ===== GenSlidePrompt 元素级类型 =====

export interface ElementPosition {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  w: number; // percentage 0-100
  h: number; // percentage 0-100
}

export interface ElementStyle {
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  borderRadius?: number;
  opacity?: number;
  [key: string]: unknown;
}

export type GenSlideElementType =
  | 'title'
  | 'subtitle'
  | 'text'
  | 'image'
  | 'shape'
  | 'icon'
  | 'card'
  | 'chart'
  | 'table'
  | 'group';

export interface GenSlideElement {
  type: GenSlideElementType;
  content: string;
  position: ElementPosition;
  style?: ElementStyle;
  description?: string;
}

export interface ColorRules {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  accent?: string;
}

// ===== 右一：新 PPT 每页 Prompt =====

export interface GenSlidePrompt {
  id: string;
  index: number;
  title: string;
  type: SlideRole;
  referenceSlideIds: number[];
  contentGoal: string;
  // 新增：元素级拆解
  elements: GenSlideElement[];
  layoutStructure: string;
  colorRules: ColorRules;
  // 新增：资产引用 & 全局风格锚点
  assetReferences: string[];
  globalStylePrompt: string;
  // 原有字段
  visualPrompt: string;
  imagePrompt?: string;
  chartPrompt?: string;
  speakerNotePrompt?: string;
  status: 'pending' | 'generating' | 'generated' | 'modified' | 'confirmed';
}

// ===== 右二：生成结果 =====

export interface GenSlideResult {
  slideId: string;
  slideIndex: number;
  pptJsonSlide: Slide;
  renderSpec?: unknown;
  previewImage?: string;
  status: 'generating' | 'generated' | 'editing' | 'confirmed';
  version?: number;
  previousVersions?: GenSlideResultSnapshot[];
  tweakNote?: string;
}

export interface GenSlideResultSnapshot {
  slideId: string;
  version: number;
  previewImage?: string;
  pptJsonSlide: Slide;
  tweakNote?: string;
  createdAt: number;
}

// ===== 中间：AI 对话消息 =====

export interface WorkbenchMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    deckPlanUpdate?: boolean;
    newSlidePrompts?: number[];
    suggestedFollowups?: string[];
    // AI PPT 助手 v2 响应字段
    aiStatus?: 'ready' | 'needs_clarification' | 'generating' | 'error';
    deckBrief?: {
      topic: string;
      audience: string;
      purpose: string;
      tone: string;
      slideCount: number;
      globalStylePrompt: string;
      styleControl?: {
        layout: string;
        color: string;
        visualStyle: string;
        density: string;
      };
      generationConstraints?: {
        mustFollow: string[];
        flexible: string[];
        forbidden: string[];
      };
    };
    slides?: GenSlidePrompt[];
    summary?: string;
    message?: string;
    questions?: string[];
  };
}

// ===== AI PPT 助手 v2 JSON 输出类型 =====

/** Prompt 1 输出：参考页视觉解析 */
export interface ReferenceAnalysis {
  schemaVersion: string;
  source: { sourceFileId: string; slideIndex: number; confidenceOverall: number };
  pageIdentity: { detectedPageType: string; presentationType: string; pageTitle: string; coreMessage: string; canvasRatio: string };
  styleAnalysis: {
    overallStyle: string[];
    visualMood: string[];
    designKeywords: string[];
    colorPalette: Array<{ hex: string; role: string; usage: string; approximateAreaRatio: string }>;
    typography: Record<string, { fontFamilyGuess?: string; fontSizeEstimate?: string; fontWeight?: string; color?: string; alignment?: string }>;
    layoutSystem: { canvasRatio: string; safeMargins: { top: number; right: number; bottom: number; left: number }; gridSystem: string; densityLevel: string };
    shapeLanguage: string[];
    imageStyle: { hasImage: boolean; imageTypes: string[]; regenerationStrategy: string };
    decorationSystem: Record<string, unknown[]>;
  };
  globalPersistentElements: Array<{ id: string; type: string; description: string; repeatAcrossDeckLikelihood: string; editable: boolean }>;
  layoutPattern: { name: string; structureSummary: string; moduleMap: Array<Record<string, unknown>>; readingOrder: string[] };
  elements: Array<{
    id: string; type: string; role: string; layerIndex: number;
    boundingBox: { x: number; y: number; w: number; h: number };
    content: Record<string, unknown>;
    style: Record<string, unknown>;
    interactionEditable: boolean;
    pptxRenderType: string;
    reproductionInstruction: string;
    confidence: number;
  }>;
  visualization?: Record<string, unknown>;
  prompts: { universalStylePrompt: string; slideVisualPrompt: string; elementRebuildPrompt: string; negativePrompt: string };
  adaptationRules: { suitableForScenes: string[]; mustPreserve: string[]; canModify: string[]; mustAvoid: string[]; contentCapacity: Record<string, number> };
  qualityEvaluation: { strengths: string[]; risks: string[]; readabilityScore: number; reproducibilityScore: number };
  validationChecklist: Array<{ item: string; passCondition: string; importance: string }>;
}

// ===== AI PPT 助手 v2 输出结构 =====

export interface DeckBrief {
  topic: string;
  audience: string;
  purpose: string;
  tone: string;
  slideCount: number;
  globalStylePrompt: string;
  styleControl: {
    layout: string;
    color: string;
    visualStyle: string;
    density: string;
  };
  generationConstraints: {
    mustFollow: string[];
    flexible: string[];
    forbidden: string[];
  };
}

/** Prompt 2 输出：用户需求 → Deck 生成指令 */
export interface DeckGenerationBrief {
  schemaVersion: string;
  conversationState: {
    status: 'collecting' | 'ready_for_generation' | 'needs_user_confirmation' | 'blocked';
    progress: number;
    lastUserIntent: string;
    nextAction: string;
    workspaceMode: boolean;
  };
  referenceUnderstanding: {
    globalStyleDNA: Record<string, unknown>;
    reusableElements: string[];
    layoutPatterns: string[];
    mustPreserveFromReference: string[];
    mustAvoidFromReference: string[];
  };
  userRequirements: {
    basicInfo: Record<string, unknown>;
    generationGoal: { primaryGoal: string; coreMessage: string; tone: string };
    deckStructure: { totalSlides: number | null; generationScope: string; plannedSlides: Array<Record<string, unknown>> };
    stylePreference: { styleStrictness: string; preferredMood: string[]; forbiddenMood: string[]; densityPreference: string };
    visualRequirements: Record<string, boolean>;
    outputRequirements: Record<string, boolean | string>;
  };
  generationBrief: {
    briefId: string;
    scene: string;
    recommendedPageCount: number | null;
    finalDeckOutline: Array<{
      slideIndex: number;
      section: string;
      title: string;
      coreMessage: string;
      contentBlocks: unknown[];
      visualStrategy: string;
      layoutStrategy: string;
      matchedReferencePattern: string;
    }>;
    globalGenerationRules: Record<string, string[]>;
    handoffToSlideGenerator: { ready: boolean; singleSlideGenerationMode: string };
  };
  missingFields: Array<{ field: string; importance: string; fallbackValue: string }>;
  recommendedQuestions: Array<{ question: string; whyItMatters: string }>;
  assistantMessageForUser: { summary: string; whatIUnderstood: string[]; needUserReply: boolean };
}

/** Prompt 3 输出：单页生成结果 */
export interface SingleSlideGenOutput {
  schemaVersion: string;
  slideMeta: { deckId: string; slideIndex: number; section: string; pageFunction: string; generationMode: string; canvasRatio: string };
  pageContent: {
    pageTitle: string;
    subtitle: string;
    coreMessage: string;
    contentModules: Array<Record<string, unknown>>;
    bottomConclusion: string;
    speakerNotes: { mainScript: string; transitionFromPrevious: string; transitionToNext: string; possibleQuestions: string[] };
  };
  styleInheritance: { inheritedStyleDNA: Record<string, unknown>; styleStrictness: string; adaptedStyleRules: string[] };
  layoutSpec: { layoutName: string; structureSummary: string; safeMargins: Record<string, number>; readingOrder: string[]; modulePlacement: Array<Record<string, unknown>> };
  elements: Array<{
    id: string; type: string; role: string; layerIndex: number;
    boundingBox: { x: number; y: number; w: number; h: number };
    content: Record<string, unknown>;
    style: Record<string, unknown>;
    interactionEditable: boolean;
    pptxRenderType: string;
    generationInstruction: string;
    sourceReference?: { inheritedFromReferenceElementId: string; inheritanceType: string };
  }>;
  visualizationSpec?: Record<string, unknown>;
  imagePrompts?: Array<Record<string, unknown>>;
  prompts: { singleSlideVisualPrompt: string; elementBuildPrompt: string; pptxRenderPrompt: string; negativePrompt: string };
  pptxExportSpec: Record<string, unknown>;
  qualityControl: { readabilityScore: number; styleConsistencyScore: number; riskFlags: string[] };
  validationChecklist: Array<{ item: string; passCondition: string; importance: string }>;
}

// ===== 工作台布局状态 =====

export interface WorkbenchLayoutState {
  selectedRefSlideIndex: number;
  selectedNewSlideIndex: number;
}
