// 核心项目类型 — UserInput, Project, StyleConfig, PPTJson, Slide, UploadedFile
// 分析报告类型 — StyleReport, ColorGroup, TypographyAnalysis, LayoutAnalysis, PageRhythmAnalysis
// 生成进度类型 — GenerationProgress, ImageCandidate
// Prompt 资产管理类型 — SlideVisualPrompt, TemplatePrompt, ScenePrompt, UserPrompt, PromptLibrary
// 反馈系统类型 — UserModification, LearnedAdjustment, GenerationFeedback
// 异步任务类型 — AnalysisJob, SlideImage, JobStatus

import type { SlideRole, LayoutPattern, StyleDNA, SlideRoleDefinition, ContentRules, ScenarioAdapter } from './stylekit';
import type { SlideElement, ContentBlock } from './elements';
import type { DeckPlan } from './generation';

// ============ 分析报告类型 ============

export interface ColorGroup {
  hex: string;
  name: string;
  role: 'primary' | 'secondary' | 'accent' | 'background' | 'text' | 'neutral';
}

export interface TypographyAnalysis {
  titleFont: string;
  bodyFont: string;
  titleSize: number;
  bodySize: number;
  lineHeight: number;
  fontWeight: {
    title: string;
    body: string;
  };
}

export interface LayoutAnalysis {
  type: 'single' | 'double' | 'full' | 'centered' | 'grid' | 'cards';
  gridColumns?: number;
  hasSidebar?: boolean;
  hasHeader?: boolean;
  alignment: 'left' | 'center' | 'right';
}

export interface PageRhythmAnalysis {
  avgElementsPerSlide: number;
  visualDensity: 'light' | 'medium' | 'dense';
  whitespaceRatio: number;
}

export interface StyleReport {
  palette: ColorGroup[];
  typography: TypographyAnalysis;
  layoutDNA: LayoutAnalysis;
  pageRhythm: PageRhythmAnalysis;
  confidence: number;
}

// ============ 生成进度类型 ============

export interface GenerationProgress {
  stage: 'idle' | 'reading' | 'extracting' | 'outlining' | 'splitting' | 'complete' | 'error';
  progress: number;
  message: string;
}

export interface ImageCandidate {
  id: string;
  url: string;
  styleTag: 'business' | 'tech' | 'minimal' | 'vibrant';
  description?: string;
}

// ============ 场景/受众类型 ============

export type ScenarioType = 'course' | 'defense' | 'pitch' | 'report' | 'proposal' | 'training' | 'research';
export type AudienceType = 'teacher' | 'judge' | 'client' | 'leader' | 'student' | 'investor' | 'team';
export type VisualPreference = 'strong_consistency' | 'reference_based' | 'style_only';
export type PageRecommendation = 'light' | 'standard' | 'full';

// ============ 核心类型 ============

export interface UserInput {
  topic: string;
  description?: string;
  keyPoints: string[];
  pageCount: number;
  specialRequirements?: string;
  template?: 'product' | 'academic' | 'business';
  scenario?: ScenarioType;
  audience?: AudienceType;
  visualPreference?: VisualPreference;
  pageRecommendation?: PageRecommendation;
}

export interface Project {
  id: string;
  userId?: string;
  title: string;
  status: 'draft' | 'analyzing' | 'generating' | 'completed';
  templateFileId?: string;
  styleKitId?: string;
  styleKitVersion?: number;
  styleKitSource?: 'uploaded-template' | 'library-selected' | 'ai-matched';
  styleConfig?: StyleConfig;
  styleReport?: StyleReport;
  userInput?: UserInput;
  deckPlan?: DeckPlan;
  pptJson?: PPTJson;
  generationProgress?: GenerationProgress;
  imageCandidates?: ImageCandidate[];
  selectedSlideIndex?: number;
  createdAt: number;
  updatedAt: number;
}

export interface StyleConfig {
  overallStyle: 'business' | 'tech' | 'creative' | 'academic';
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
    bodySize: number;
  };
  layout: {
    type: 'single' | 'double' | 'full' | 'centered';
    spacing: number;
    padding: number;
  };
  designPrinciples: string[];
}

export interface PPTJson {
  metadata: {
    projectId: string;
    title: string;
    category: string;
    audience: string;
    createdAt: string;
  };
  designSystem: {
    palette: StyleConfig['palette'];
    typography: StyleConfig['typography'];
  };
  roles: {
    designer: string;
    contentStrategist: string;
    visualDirector: string;
  };
  slides: Slide[];
}

export interface Slide {
  id: string;
  layout: 'title' | 'content' | 'image' | 'chart' | 'quote';
  title: string;
  mainConclusion: string;
  content: ContentBlock[];
  speakerNotes?: string;
}

export interface UploadedFile {
  id: string;
  projectId: string;
  type: 'pdf' | 'ppt' | 'pptx';
  url: string;
  name: string;
  size: number;
  thumbnails?: string[];
  uploadedAt: number;
}

// ============ Prompt 资产管理类型 ============

export interface SlideVisualPrompt {
  slideIndex: number;
  imageBase64: string;
  visualPrompt: string;
  styleTags: string[];
  colorPalette: string[];
  layout: 'single' | 'double' | 'full' | 'centered';
  generatedAt: number;
}

export interface TemplatePrompt {
  id: string;
  name: string;
  sourceFileId: string;
  sourceStyleKitId?: string;
  overallStyle: 'business' | 'tech' | 'creative' | 'academic';
  colorPalette: ColorGroup[];
  typography: {
    titleFont: string;
    bodyFont: string;
    titleSize: number;
    bodySize: number;
  };
  universalPrompt: string;
  slidePrompts: SlideVisualPrompt[];
  usageCount: number;
  lastUsedAt?: number;
  userOptimizedPrompt?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ScenePrompt {
  scene: 'course' | 'defense' | 'pitch' | 'report' | 'proposal' | 'training' | 'research';
  templateId: string;
  sceneAdjustedPrompt: string;
  emphasis: string[];
  layoutPreference: 'compact' | 'standard' | 'expanded';
  recommendedPageCount: number;
}

export interface UserPrompt {
  id: string;
  name: string;
  content: string;
  category: 'style' | 'layout' | 'illustration' | 'icon' | 'decoration';
  tags: string[];
  source: 'manual' | 'extracted' | 'optimized';
  usageCount: number;
  successCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface PromptLibrary {
  templates: TemplatePrompt[];
  scenePrompts: ScenePrompt[];
  userPrompts: UserPrompt[];
}

// ============ 反馈系统类型 ============

export interface UserModification {
  modifiedBlocks: SlideElement[];
  timestamp: number;
}

export interface LearnedAdjustment {
  pattern: string;
  confidence: number;
  applied: boolean;
}

export interface GenerationFeedback {
  id: string;
  projectId: string;
  styleKitId: string;

  rating: 1 | 2 | 3 | 4 | 5;

  feedback: {
    overall: string;
    styleAccuracy: number;
    layoutFit: number;
    contentQuality: number;
    issues: string[];
    strengths: string[];
  };

  userModifications?: UserModification[];

  learnedAdjustments?: LearnedAdjustment[];

  createdAt: number;
}

// ============ 异步任务类型 ============

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface AnalysisJob {
  id: string;
  fileId: string;
  status: JobStatus;
  pipelineVersion?: string;

  progress: {
    currentStep: string;
    processedSlides: number;
    totalSlides: number;
    estimatedTimeRemaining?: number;
  };

  result?: {
    styleKit?: StyleKit;
    slideImages?: SlideImage[];
    styleDNAResults?: Array<{
      id: string;
      slideIndex: number;
      palette: StyleDNA['palette'];
      typography: StyleDNA['typography'];
      spacing: StyleDNA['spacing'];
      effects: StyleDNA['effects'];
      mood: StyleDNA['mood'];
      moodDescription: string;
      layoutType: string;
      visualPrompt: string;
      styleTags: string[];
    }>;
    layoutPatterns?: LayoutPattern[];
  };

  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };

  createdAt: number;
  updatedAt: number;
}

export interface SlideImage {
  slideIndex: number;
  imageBase64: string;
  width: number;
  height: number;
}

/** 持久化的项目配图 */
export interface ProjectImage {
  id: string;
  projectId: string;
  slideId: string;
  slideIndex: number;
  imageUrl: string;
  prompt?: string;
  createdAt: number;
}

// 重新导出 StyleKit (来自 stylekit.ts，在 AnalysisJob.result 中使用)
import type { StyleKit } from './stylekit';
export type { StyleKit };
