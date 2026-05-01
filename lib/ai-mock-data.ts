/**
 * AI Mock 数据
 * 集中管理所有 mock 数据，确保通过 Zod Schema
 * 业务主题：社区治理 AI 平台解决方案
 */

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
  typography: { titleFont: 'Inter', bodyFont: 'Noto Sans SC', titleSize: 44, subtitleSize: 28, bodySize: 18, captionSize: 12 },
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
  typography: { titleFont: 'Inter', bodyFont: 'Noto Sans SC', titleSize: 44, subtitleSize: 28, bodySize: 18, captionSize: 12 },
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
function slidePlan(idx: number, role: string, title: string, conclusion: string, hint: string) {
  return {
    id: uuid(), index: idx, role: role as any, title, mainConclusion: conclusion,
    contentOutline: [
      { type: 'heading' as const, description: '标题', required: true },
      { type: 'paragraph' as const, description: '内容', required: true },
    ],
    layoutHint: hint as any,
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
function mockSlideBlocks(title: string, conclusion: string, idx: number) {
  const blocks: any[] = [
    { id: uuid(), type: 'text', content: title, position: { x: 0.05, y: 0.05, width: 0.9, height: 0.15 }, style: { fontSize: 36, fontWeight: 'bold', color: '#1a56db', align: 'left' } },
  ];
  if (idx === 0 || idx === 9) {
    // title pages: just title and conclusion
    blocks.push({ id: uuid(), type: 'text', content: conclusion, position: { x: 0.1, y: 0.4, width: 0.8, height: 0.2 }, style: { fontSize: 24, fontWeight: 'normal', color: '#4b5563', align: 'center' } });
  } else {
    blocks.push({ id: uuid(), type: 'text', content: conclusion, position: { x: 0.05, y: 0.22, width: 0.9, height: 0.1 }, style: { fontSize: 20, fontWeight: 'normal', color: '#4b5563', align: 'left' } });
    blocks.push({ id: uuid(), type: 'list', content: '• 要点一：核心内容\n• 要点二：关键数据\n• 要点三：预期影响', position: { x: 0.05, y: 0.35, width: 0.9, height: 0.55 }, style: { fontSize: 16, fontWeight: 'normal', color: '#374151', align: 'left' } });
  }
  return blocks;
}

const slideMeta = [
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

// ====== 7. mock image ======
export const mockSlideImageResult = { success: true, imageUrl: 'https://placehold.co/1792x1024/1a56db/ffffff?text=AI+Mock+Preview' };
