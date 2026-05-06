/**
 * AI Mock 数据
 * 集中管理所有 mock 数据，确保通过 Zod Schema
 * 业务主题：社区治理 AI 平台解决方案
 */

import type { SlideRole, LayoutType } from '@/types/stylekit';
import type { ContentBlock } from '@/types';

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

const PROJECT_ID = uuid();
const NOW = Date.now();
const ISO_NOW = new Date().toISOString();

// ====== 1. mock StyleConfig ======
export const mockStyleConfig = {
  overallStyle: 'business' as const,
  palette: { primary: '#1a73e8', secondary: '#34a853', accent: '#fbbc04', background: '#ffffff', text: '#202124' },
  typography: { titleFont: 'Arial', bodyFont: 'Helvetica', titleSize: 44, bodySize: 18 },
  layout: { type: 'single' as const, spacing: 24, padding: 48 },
  designPrinciples: ['一页一结论，信息层级清晰', '充足留白，减少视觉负担', '数据可视化优先于纯文字'],
};

// ====== 2. mock StyleKit extract slide ======
const skBase = {
  palette: { primary: '#1a56db', secondary: '#34a853', accent: '#f59e0b', background: '#ffffff', text: '#1f2937' },
  typography: { titleFont: 'Inter', bodyFont: 'Noto Sans SC', titleSize: 44, titleWeight: 700, subtitleSize: 28, bodySize: 18, captionSize: 12 },
  spacing: { slidePadding: 48, contentMargin: 32, elementGap: 16 },
  effects: { shadowEnabled: true, shadowType: 'soft' as const, borderRadius: 8, gradientEnabled: false },
  mood: 'professional' as const,
  moodDescription: '专业商务风格，以蓝色为主色调，强调数据可视化与信息层级',
  layoutType: 'two-column',
  visualPrompt: 'A professional business slide with clean layout, blue accent color',
  styleTags: ['business', 'minimal', 'data-driven', 'clean'],
};

export const mockStyleKitExtractResponse = {
  sourceFileId: 'mock-file-001',
  sourceFileName: '社区治理方案参考.pptx',
  totalSlides: 12,
  processedSlides: 7,
  styleDNAResults: [
    { id: uuid(), slideIndex: 1, ...skBase },
    { id: uuid(), slideIndex: 2, ...skBase, layoutType: 'hero' },
    { id: uuid(), slideIndex: 3, ...skBase, layoutType: 'grid' },
    { id: uuid(), slideIndex: 4, ...skBase },
    { id: uuid(), slideIndex: 5, ...skBase, layoutType: 'data-chart' },
    { id: uuid(), slideIndex: 6, ...skBase },
    { id: uuid(), slideIndex: 7, ...skBase },
  ],
  hadFailures: false,
  wasSampled: false,
};

// ====== 3. mock DistillStyleKit ======
export const mockStyleDistillResult = {
  name: '社区治理方案·商务蓝调',
  mood: 'professional' as const,
  moodDescription: '专业商务风格，以深蓝为主色调，强调数据可视化与信息层级',
  palette: { primary: '#1a56db', secondary: '#34a853', accent: '#f59e0b', background: '#ffffff', text: '#1f2937' },
  typography: { titleFont: 'Inter', bodyFont: 'Noto Sans SC', titleSize: 44, titleWeight: 700, subtitleSize: 28, bodySize: 18, captionSize: 12 },
  spacing: { slidePadding: 48, contentMargin: 32, elementGap: 16 },
  effects: { shadowEnabled: true, shadowType: 'soft' as const, borderRadius: 8, gradientEnabled: false },
  layoutPatterns: [
    { layoutType: 'two-column', frequency: 4, bestFor: ['content', 'table', 'comparison'], layoutPrompt: '双栏布局，左侧40%标题', applicableSlides: [1, 3, 5, 8] },
    { layoutType: 'hero', frequency: 2, bestFor: ['title', 'section-header'], layoutPrompt: '全屏标题区，居中布局', applicableSlides: [0, 6] },
    { layoutType: 'data-chart', frequency: 3, bestFor: ['data-display', 'chart'], layoutPrompt: '图表为主，左侧图表区', applicableSlides: [4, 7, 10] },
  ],
  slideRoleDistribution: { cover: 1, content: 8, 'data-display': 3, summary: 1, closing: 1 },
  styleTags: ['business', 'governance', 'data-driven', 'clean', 'professional'],
};

// ====== 4. mock DeckPlan ======
function slidePlan(idx: number, role: SlideRole, title: string, conclusion: string, hint: LayoutType) {
  return {
    id: uuid(), index: idx, role, title, mainConclusion: conclusion,
    contentOutline: [
      { type: 'heading' as const, description: '标题', required: true },
      { type: 'paragraph' as const, description: '内容', required: true },
    ],
    layoutHint: hint,
  };
}

export const mockDeckPlan = {
  id: uuid(),
  projectId: PROJECT_ID,
  title: '社区治理 AI 平台解决方案',
  scenario: 'report' as const,
  audience: 'leader' as const,
  slidePlans: [
    slidePlan(0, 'cover', '社区治理 AI 平台解决方案', '以 AI 驱动社区治理数字化转型', 'hero'),
    slidePlan(1, 'toc', '汇报提纲', '本次汇报分为四个部分', 'centered'),
    slidePlan(2, 'section-header', '项目背景与机遇', '社区治理面临新的挑战与机遇', 'hero'),
    slidePlan(3, 'content', '当前社区治理痛点', '传统管理模式难以应对', 'two-column'),
    slidePlan(4, 'data-display', '社区服务数据概览', '服务需求持续增长', 'data-chart'),
    slidePlan(5, 'content', 'AI 赋能社区治理场景', '六大核心场景覆盖全链路', 'grid'),
    slidePlan(6, 'section-header', '解决方案设计', '以 AI Agent 为核心', 'hero'),
    slidePlan(7, 'content', '平台整体架构', '四层架构实现闭环', 'two-column'),
    slidePlan(8, 'data-display', '预期成果指标', '全面提升治理效率', 'data-chart'),
    slidePlan(9, 'summary', '总结与展望', 'AI 带来深远变革', 'centered'),
    slidePlan(10, 'closing', '感谢聆听', '期待携手共建智慧社区', 'hero'),
  ],
  metadata: { totalPages: 11, generatedAt: NOW },
};

// ====== 5. mock PPTJson ======
function mockSlideBlocks(title: string, conclusion: string, idx: number): ContentBlock[] {
  const blocks = [
    { id: uuid(), type: 'text', content: title, position: { x: 0.05, y: 0.05, width: 0.9, height: 0.15 }, style: { fontSize: 36, fontWeight: 'bold', color: '#1a56db', align: 'left' } },
  ];
  if (idx === 0 || idx === 9) {
    // title pages: just title and conclusion
    blocks.push({ id: uuid(), type: 'text', content: conclusion, position: { x: 0.1, y: 0.4, width: 0.8, height: 0.2 }, style: { fontSize: 24, fontWeight: 'normal', color: '#4b5563', align: 'center' } });
  } else {
    blocks.push({ id: uuid(), type: 'text', content: conclusion, position: { x: 0.05, y: 0.22, width: 0.9, height: 0.1 }, style: { fontSize: 20, fontWeight: 'normal', color: '#4b5563', align: 'left' } });
    blocks.push({ id: uuid(), type: 'list', content: '• 要点一：核心内容\n• 要点二：关键数据\n• 要点三：预期影响', position: { x: 0.05, y: 0.35, width: 0.9, height: 0.55 }, style: { fontSize: 16, fontWeight: 'normal', color: '#374151', align: 'left' } });
  }
  return blocks as ContentBlock[];
}

const slideMeta= [
  { layout: 'title' as const, title: '社区治理 AI 平台解决方案', conclusion: '以 AI 技术驱动社区治理数字化转型' },
  { layout: 'content' as const, title: '当前社区治理痛点', conclusion: '传统管理模式难以应对日益复杂的社会治理需求' },
  { layout: 'content' as const, title: 'AI 赋能社区治理场景', conclusion: '六大核心场景覆盖社区治理全链路' },
  { layout: 'image' as const, title: '平台整体架构', conclusion: '四层架构实现数据采集到决策辅助的闭环' },
  { layout: 'chart' as const, title: '社区服务数据概览', conclusion: '服务需求持续增长，AI 赋能空间巨大' },
  { layout: 'content' as const, title: '核心技术能力', conclusion: '自然语言处理与知识图谱驱动智能决策' },
  { layout: 'quote' as const, title: '设计理念', conclusion: '以人为本的智能治理' },
  { layout: 'chart' as const, title: '预期成果指标', conclusion: '全面提升社区治理效率与居民满意度' },
  { layout: 'content' as const, title: '实施路径规划', conclusion: '分三期推进，稳步实现全面落地' },
  { layout: 'title' as const, title: '总结与展望', conclusion: 'AI 技术将为社区治理带来深远变革' },
];

export const mockPPTJson = {
  metadata: { projectId: PROJECT_ID, title: '社区治理 AI 平台解决方案', category: 'report', audience: 'leader', createdAt: ISO_NOW },
  designSystem: { palette: { primary: '#1a56db', secondary: '#34a853', accent: '#f59e0b', background: '#ffffff', text: '#1f2937' }, typography: { titleFont: 'Inter', bodyFont: 'Noto Sans SC', titleSize: 44, bodySize: 18 } },
  roles: { designer: 'AI PPT Generator Mock', contentStrategist: 'AI PPT Generator Mock', visualDirector: 'AI PPT Generator Mock' },
  slides: slideMeta.map((s, i) => ({
    id: uuid(), layout: s.layout, title: s.title, mainConclusion: s.conclusion,
    content: mockSlideBlocks(s.title, s.conclusion, i),
    speakerNotes: `第 ${i + 1} 页：${s.title}，核心要点：${s.conclusion}`,
  })),
};

// ====== 6. mock EditPatch ======
export const mockEditPatch = {
  operation: 'update_text' as const,
  slideId: 'mock-slide-id',
  elementId: 'mock-element-id',
  oldValue: '当前社区治理痛点',
  newValue: '社区治理面临的核心挑战',
  description: '优化标题措辞',
};

export const mockEditPatchBatch = [
  { operation: 'update_text' as const, slideId: 'mock-slide-id', elementId: 'mock-id-1', oldValue: '旧标题', newValue: '新标题', description: '修改标题' },
  { operation: 'update_text' as const, slideId: 'mock-slide-id', elementId: 'mock-id-2', oldValue: '旧结论', newValue: '新结论', description: '修改结论' },
];

// ====== 7. mock rewrite patch (Phase D2) ======
export const mockRewritePatches: Record<string, typeof mockEditPatch> = {
  professional: {
    ...mockEditPatch, newValue: '[专业版] 社区治理面临的核心挑战与应对策略',
    description: '专业语气改写标题',
  },
  concise: {
    ...mockEditPatch, newValue: '社区治理核心挑战',
    description: '简洁语气缩写标题',
  },
  persuasive: {
    ...mockEditPatch, newValue: '重塑社区治理：挑战即机遇',
    description: '有说服力语气改写标题',
  },
  defense: {
    ...mockEditPatch, newValue: '社区治理核心挑战分析与创新应对方案',
    description: '答辩语气改写标题',
  },
};

// ====== 8. mock element decomposition ======

export const mockElementDecomposeResponse = {
  decompositions: [
    {
      slideIndex: 1,
      background: {
        type: 'solid' as const,
        colors: ['#ffffff'],
        description: '纯白背景，右上角有淡蓝色几何装饰',
      },
      elements: [
        {
          type: 'title' as const,
          rect: { x: 8, y: 12, w: 70, h: 15 },
          content: { text: '社区治理 AI 平台解决方案' },
          style: { fontSize: 44, fontWeight: 'bold', color: '#1a56db', textAlign: 'left' as const },
          purpose: '主标题，点明 PPT 主题',
        },
        {
          type: 'subtitle' as const,
          rect: { x: 8, y: 28, w: 55, h: 6 },
          content: { text: '以 AI 技术驱动社区治理数字化转型' },
          style: { fontSize: 22, fontWeight: 'normal', color: '#6b7280', textAlign: 'left' as const },
          purpose: '副标题，为标题提供补充说明',
        },
        {
          type: 'decoration' as const,
          rect: { x: 78, y: 8, w: 18, h: 30 },
          content: { imageDescription: '蓝色几何抽象形状装饰' },
          style: { opacity: 0.12, color: '#1a56db' },
          purpose: '右侧装饰元素，平衡画面视觉重量',
        },
        {
          type: 'line' as const,
          rect: { x: 8, y: 38, w: 30, h: 1 },
          content: {},
          style: { color: '#1a56db', opacity: 0.5 },
          purpose: '标题下方分割线，分隔标题与正文区域',
        },
        {
          type: 'shape' as const,
          rect: { x: 8, y: 88, w: 12, h: 3 },
          content: {},
          style: { backgroundColor: '#f59e0b', borderRadius: 4, opacity: 0.7 },
          purpose: '底部品牌色块装饰',
        },
      ],
      layoutPattern: '左对齐标题区，右侧几何装饰，标题下方短分割线，底部品牌色块点缀，整体大留白',
      reusablePrompt: '生成一页 PPT 封面：纯白背景，大标题"社区治理 AI 平台解决方案"（44pt bold #1a56db）位于左上角，副标题在其下方（22pt #6b7280），右上角有淡蓝色几何装饰图形，标题下方有短分割线，底部有品牌色块点缀。风格：专业、简洁、科技感。',
    },
    {
      slideIndex: 2,
      background: {
        type: 'solid' as const,
        colors: ['#ffffff'],
        description: '纯白背景',
      },
      elements: [
        {
          type: 'title' as const,
          rect: { x: 8, y: 8, w: 84, h: 10 },
          content: { text: '当前社区治理痛点' },
          style: { fontSize: 36, fontWeight: 'bold', color: '#1a56db', textAlign: 'left' as const },
          purpose: '页面标题',
        },
        {
          type: 'body' as const,
          rect: { x: 8, y: 20, w: 84, h: 8 },
          content: { text: '传统管理模式难以应对日益复杂的社会治理需求' },
          style: { fontSize: 18, fontWeight: 'normal', color: '#4b5563', textAlign: 'left' as const },
          purpose: '页面核心论点/结论',
        },
        {
          type: 'bullet_list' as const,
          rect: { x: 8, y: 32, w: 50, h: 55 },
          content: { text: '• 信息孤岛严重，数据分散在多个系统\n• 人工处理效率低，响应时间超过48小时\n• 缺乏预测能力，只能被动应对\n• 居民参与度不足，满意度持续下降' },
          style: { fontSize: 16, fontWeight: 'normal', color: '#374151', textAlign: 'left' as const },
          purpose: '痛点详细列表，逐条说明问题',
        },
        {
          type: 'image' as const,
          rect: { x: 60, y: 35, w: 35, h: 45 },
          content: { imageDescription: '社区治理流程图或数据可视化图表' },
          style: { borderRadius: 8 },
          purpose: '右侧配图，可视化展示痛点数据',
        },
        {
          type: 'page_number' as const,
          rect: { x: 92, y: 92, w: 5, h: 4 },
          content: { text: '2' },
          style: { fontSize: 10, color: '#9ca3af', textAlign: 'right' as const },
          purpose: '页码标注',
        },
      ],
      layoutPattern: '双栏布局：左侧标题+结论+项目符号列表（占50%），右侧数据图表配图（占35%），整体留白充足',
      reusablePrompt: '生成一页内容页：双栏布局，左侧标题区和项目符号列表，右侧配一张数据相关插图。标题用36pt bold #1a56db，正文用18pt #4b5563，列表用16pt #374151。卡片式配图圆角8px。风格：商务、简洁、数据驱动。',
    },
    {
      slideIndex: 3,
      background: {
        type: 'solid' as const,
        colors: ['#f8fafc'],
        description: '浅灰蓝色背景，微妙区分内容区域',
      },
      elements: [
        {
          type: 'title' as const,
          rect: { x: 8, y: 8, w: 84, h: 10 },
          content: { text: 'AI 赋能社区治理场景' },
          style: { fontSize: 36, fontWeight: 'bold', color: '#1a56db', textAlign: 'left' as const },
          purpose: '页面标题',
        },
        {
          type: 'body' as const,
          rect: { x: 8, y: 20, w: 84, h: 6 },
          content: { text: '六大核心场景覆盖社区治理全链路' },
          style: { fontSize: 18, fontWeight: 'normal', color: '#4b5563', textAlign: 'left' as const },
          purpose: '页面结论',
        },
        {
          type: 'shape' as const,
          rect: { x: 8, y: 30, w: 26, h: 18 },
          content: { text: '智能客服' },
          style: { backgroundColor: '#eff6ff', borderRadius: 8 },
          purpose: '场景卡片1：智能客服',
        },
        {
          type: 'shape' as const,
          rect: { x: 37, y: 30, w: 26, h: 18 },
          content: { text: '风险预警' },
          style: { backgroundColor: '#fef3c7', borderRadius: 8 },
          purpose: '场景卡片2：风险预警',
        },
        {
          type: 'shape' as const,
          rect: { x: 66, y: 30, w: 26, h: 18 },
          content: { text: '舆情分析' },
          style: { backgroundColor: '#ecfdf5', borderRadius: 8 },
          purpose: '场景卡片3：舆情分析',
        },
        {
          type: 'shape' as const,
          rect: { x: 8, y: 52, w: 26, h: 18 },
          content: { text: '资源调度' },
          style: { backgroundColor: '#fef2f2', borderRadius: 8 },
          purpose: '场景卡片4：资源调度',
        },
        {
          type: 'shape' as const,
          rect: { x: 37, y: 52, w: 26, h: 18 },
          content: { text: '决策辅助' },
          style: { backgroundColor: '#f5f3ff', borderRadius: 8 },
          purpose: '场景卡片5：决策辅助',
        },
        {
          type: 'shape' as const,
          rect: { x: 66, y: 52, w: 26, h: 18 },
          content: { text: '便民服务' },
          style: { backgroundColor: '#f0fdf4', borderRadius: 8 },
          purpose: '场景卡片6：便民服务',
        },
      ],
      layoutPattern: '3x2 网格布局：顶部标题+结论，下方6个等大场景卡片均匀分布在3列2行网格中，每个卡片有不同底色区分场景类型',
      reusablePrompt: '生成一页网格布局的内容页：3x2 六宫格排列场景卡片，每个卡片圆角8px，不同浅色背景区分（蓝、黄、绿、红、紫、翠），卡片内居中显示场景名称。顶部标题36pt bold。风格：现代、信息图风格、色彩丰富但不杂乱。',
    },
  ],
};

// ====== 9. mock analyze-slide (unified endpoint) ======

export const mockAnalyzeSlideResponse = {
  slideIndex: 1,
  pageType: '封面',
  mood: 'professional' as const,
  styleTags: ['business', 'tech', 'clean', 'minimal'],
  background: {
    type: 'solid' as const,
    colors: ['#ffffff'],
    description: '纯白背景，右上角有淡蓝色几何装饰',
  },
  elements: [
    {
      type: 'title' as const,
      rect: { x: 8, y: 12, w: 70, h: 15 },
      content: { text: '社区治理 AI 平台解决方案' },
      style: { fontSize: 44, fontWeight: 'bold', color: '#1a56db', textAlign: 'left' as const },
      purpose: '主标题，点明 PPT 主题',
    },
    {
      type: 'subtitle' as const,
      rect: { x: 8, y: 28, w: 55, h: 6 },
      content: { text: '以 AI 技术驱动社区治理数字化转型' },
      style: { fontSize: 22, fontWeight: 'normal', color: '#6b7280', textAlign: 'left' as const },
      purpose: '副标题，为标题提供补充说明',
    },
    {
      type: 'decoration' as const,
      rect: { x: 78, y: 8, w: 18, h: 30 },
      content: { imageDescription: '蓝色几何抽象形状装饰' },
      style: { opacity: 0.12, color: '#1a56db' },
      purpose: '右侧装饰元素，平衡画面视觉重量',
    },
    {
      type: 'line' as const,
      rect: { x: 8, y: 38, w: 30, h: 1 },
      content: {},
      style: { color: '#1a56db', opacity: 0.5 },
      purpose: '标题下方分割线，分隔标题与正文区域',
    },
  ],
  layoutPattern: '左对齐标题区，右侧几何装饰，标题下方短分割线，整体大留白',
  reusablePrompt: '生成一页 PPT 封面：纯白背景(#ffffff)，大标题位于左上角(x:8%, y:12%, w:70%, h:15%)，44pt bold #1a56db，副标题位于标题下方(x:8%, y:28%, w:55%, h:6%)，22pt #6b7280，右上角有淡蓝色几何装饰图形(opacity:0.12)，标题下方有短分割线(#1a56db, opacity:0.5, w:30%)。风格：专业、简洁、科技感。排版：大留白，左对齐，信息层级清晰。',
  palette: {
    primary: '#1a56db',
    secondary: '#34a853',
    accent: '#f59e0b',
    background: '#ffffff',
    text: '#1f2937',
  },
  typography: {
    titleFont: 'Inter',
    bodyFont: 'Noto Sans SC',
    titleSize: 44,
    titleWeight: 700,
    bodySize: 18,
  },
  spacing: {
    slidePadding: 48,
    elementGap: 16,
  },
  effects: {
    shadowEnabled: false,
    shadowType: 'none' as const,
    borderRadius: 0,
    gradientEnabled: false,
  },
};

// ====== 10. mock image ======
export const mockSlideImageResult = { success: true, imageUrl: 'https://placehold.co/1792x1024/1a56db/ffffff?text=AI+Mock+Preview' };
