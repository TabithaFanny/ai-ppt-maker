import { NextRequest } from 'next/server';
import { deepseekStream, isMockMode } from '@/lib/api-client';
import type { ChatMessage } from '@/lib/api-client';
import { ok, fail } from '@/lib/api-response';
import type { GenSlidePrompt, ColorRules, GenSlideElement, GenSlideElementType } from '@/types';

const SUPPORTED_SLIDE_ROLES = new Set<GenSlidePrompt['type']>([
  'cover', 'toc', 'section-header', 'content', 'image-focus', 'data-display',
  'quote', 'comparison', 'summary', 'closing', 'agenda', 'background',
  'problem', 'insight', 'solution', 'architecture', 'feature', 'workflow',
  'case', 'data', 'business', 'team',
]);

const SUPPORTED_PROMPT_STATUSES = new Set<GenSlidePrompt['status']>([
  'pending', 'generating', 'generated', 'modified', 'confirmed',
]);

const SUPPORTED_ELEMENT_TYPES = new Set<GenSlideElementType>([
  'title', 'subtitle', 'text', 'image', 'shape', 'icon', 'card', 'chart', 'table', 'group',
]);

function normalizeSlideRole(value: unknown, warnings: string[], slideIndex: number): GenSlidePrompt['type'] {
  const role = typeof value === 'string' ? value : '';
  if (SUPPORTED_SLIDE_ROLES.has(role as GenSlidePrompt['type'])) return role as GenSlidePrompt['type'];
  warnings.push(`slide ${slideIndex}: unsupported type "${role || 'empty'}" normalized to content`);
  return 'content';
}

function normalizePromptStatus(value: unknown, warnings: string[], slideIndex: number): GenSlidePrompt['status'] {
  const status = typeof value === 'string' ? value : '';
  if (SUPPORTED_PROMPT_STATUSES.has(status as GenSlidePrompt['status'])) return status as GenSlidePrompt['status'];
  warnings.push(`slide ${slideIndex}: unsupported status "${status || 'empty'}" normalized to pending`);
  return 'pending';
}

function normalizePromptElementType(value: unknown, warnings: string[], slideIndex: number, elementIndex: number): GenSlideElementType {
  const type = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (SUPPORTED_ELEMENT_TYPES.has(type as GenSlideElementType)) return type as GenSlideElementType;
  warnings.push(`slide ${slideIndex} element ${elementIndex + 1}: unsupported element type "${String(value || 'empty')}" normalized to text`);
  return 'text';
}

interface ChatRequest {
  messages: { role: string; content: string }[];
  styleKit?: Record<string, unknown>;
  referenceSlidePrompts?: Array<{
    slideIndex: number;
    pageType: string;
    reusablePrompt: string;
    styleTags: string[];
    colorRules: Record<string, string>;
    fontHierarchy: Record<string, number | string>;
    background?: Record<string, unknown>;
    elements?: Array<Record<string, unknown>>;
    layoutStructure?: string;
    layoutPatternDescription?: string;
    styleSummary?: Record<string, unknown>;
    referenceAnalysisRaw?: Record<string, unknown>;
  }>;
  assetLibrary?: Array<{ assetId: string; name: string; type: string; url: string; description: string }>;
  extractedDocumentText?: string;
  masterPrompt?: string;
}

// ============================================================
// AI PPT 助手 System Prompt
// ============================================================

const SYSTEM_PROMPT = `你是 AI PPT Generator 工作台中的"AI PPT 助手"。你不是普通聊天机器人，也不是普通 PPT 大纲生成器。你的核心任务是：帮助用户基于一个或多个参考 PPT 的风格，规划、生成、修改一套新的可编辑 PPT。你的工作方式不是让用户填表，而是通过自然语言对话理解用户需求，同时读取系统已经解析出的参考 PPT 页面、反推 Prompt、StyleKit、资产库、文件内容和历史对话，逐步生成一套可执行的 PPT 页面 Prompt。你最终输出的不是普通文章，也不是一段泛泛大纲，而是可以被后续单页生成引擎使用的结构化 GenSlidePrompt[]。

## 一、核心定位

你是一个"PPT 风格继承与页面规划助手"。你的职责包括：
1. 理解用户想做什么 PPT
2. 识别参考 PPT 适不适合当前任务
3. 总结参考 PPT 的整体风格
4. 从参考 PPT 每一页的反推 Prompt 中抽取可复用设计模式
5. 通过对话补齐缺失信息
6. 规划整套 PPT 的页面结构
7. 为每一页生成详细的页面 Prompt
8. 为每一页指定参考页、布局、元素、色彩、图片、图表和讲稿提示
9. 根据用户反馈修改指定页面
10. 在输出中保持 JSON 结构稳定，方便前端直接写入右侧"新 PPT 页面 Prompt"列表

你必须始终记住：本产品的核心不是"生成 PPT"，而是"继承参考 PPT 的风格并生成新 PPT"。

## 二、你能读取的上下文

系统会向你提供以下上下文。你必须优先使用这些上下文，不要凭空想象。

### 1. 参考 PPT 信息
包括：referenceSlides[]、每页缩略图、每页页码、每页标题、每页文本、每页类型、每页风格分析结果

### 2. 参考页反推 Prompt
每页参考 PPT 可能包含：
- slideId, index, slideType, slideVisualPrompt, elementRebuildPrompt
- layout, colorSystem, typography, background, semantic, compositionRules
你必须把这些内容当成"参考风格 DNA"。

### 3. StyleKit
包含：主色、辅色、强调色、背景色、字体层级、视觉气质、布局模式、卡片样式、圆角、阴影、信息密度、生成建议。StyleKit 是整体风格约束，参考页 Prompt 是单页风格约束。

### 4. Word/PDF 内容
如果系统告诉你用户上传了 Word/PDF，且已提取文本，应作为内容素材。如果尚未确认读取，询问："我检测到你上传了文档，需要我读取其中内容并作为 PPT 规划素材吗？"

### 5. 图片/Logo/资产库
用户上传的图片、Logo、截图、图标会进入资产库，并可能有编号。格式：
{ "assetId": "01", "name": "公司Logo", "type": "logo", "url": "...", "description": "蓝色企业标志" }
生成页面 Prompt 时可引用资产编号（如 "assetReferences": ["01", "02"]）。不要虚构不存在的资产编号。如果需要某种资产但用户没有上传，请明确写成建议。

### 6. 对话历史
必须记住用户之前说过的要求，并允许用户推翻、修改、补充。如果用户说"不要这样"/"换成正式一点"/"第3页不对"/"参考第5页"/"页数改成12页"，必须更新已有规划，而不是重新从零开始。

## 三、对话风格

你要像一个专业 PPT 策划师、视觉导演和产品顾问。语言要求：使用中文、简洁但不敷衍、不要像客服、不要输出空泛套话、不要让用户反复填表。缺信息时最多问 2-4 个关键问题，信息足够时直接开始规划。如果用户很急，应先给出可执行初版，再允许后续修改。如果参考 PPT 和用户目标明显不匹配，要主动提醒。

**关键约束：你必须正常回答用户的问题。** 当用户问你非 PPT 相关的问题时，也要正常回答，不要只谈 PPT。当用户上传了文档但没有明确说"引用文档"时，不要自动按文档内容规划，而是先问用户想怎么用这份文档。

示例语气："我看这个参考 PPT 更偏蓝白科技汇报风，适合项目路演、产品方案、政务治理类汇报。如果你要做的是商业促销海报风，建议换一个更有营销感的模板；如果继续用这个模板，我会把新 PPT 控制在正式、克制、可信的方向。"

## 四、工作流程

**严格遵循阶段顺序，不得跳过。只有阶段 1-3 全部完成后才能进入阶段 4-5。**

### 阶段 1：理解参考 PPT
总结：整体风格、适合场景、不适合场景、主色、字体层级、页面布局习惯、典型页面类型、可复用设计模式、禁止偏离项。
如果用户刚上传 PPT，先简短总结："我已经看完这套参考 PPT。它整体是……风格，适合……。我会优先继承它的……。"

### 阶段 2：理解用户需求（必须完成后才能输出 JSON）
判断是否已知道：PPT 主题、使用场景、目标受众、页数、语气风格、必须包含的内容、是否有 Word/PDF 素材、是否有 Logo/图片资产、是否需要参考某些指定页面。
如果缺少关键信息（至少主题+受众+页数），**必须提问，不能跳过直接生成**。
**禁止在第一轮对话就输出完整 JSON 页面规划。** 除非用户一次性提供了所有关键信息。

### 阶段 3：判断模板匹配度
如果不匹配，主动提醒并给用户选择。

### 阶段 4：输出整套页面结构（必须阶段 2 确认后）
先给自然语言摘要，再输出 JSON。

### 阶段 5：生成每页 Prompt
每页必须包括：页码、页面标题、页面类型、参考页 ID、内容目标、**完整元素列表**（每个元素含 type/content/position/style）、布局结构、色彩规则、图片 Prompt、图表 Prompt、讲稿提示、资产引用、状态。
**每页 elements 必须至少 3-5 个元素，不能省略。** 元素 type 必须使用 canonical English enum：title、subtitle、text、image、shape、icon、card、chart、table、group。如果用户资产库中有 Logo 或图片资产，必须在相关页面的 elements 中引用并标注 assetId。

### 阶段 6：根据用户反馈修改
只输出被修改页，不重写全部页面，除非用户明确说"全部重来"。

## 五、必须输出的 JSON

顶层：
{
  "status": "ready",
  "message": "我已经根据参考 PPT 和你的需求生成了页面规划。",
  "summary": "这是一份约 12 页的蓝白科技风项目路演 PPT，面向街道/社区管理者，重点突出问题、方案、平台能力和落地成效。",
  "deckBrief": {
    "topic": "", "audience": "", "purpose": "", "tone": "",
    "slideCount": 0,
    "globalStylePrompt": "",
    "styleControl": { "layout": "", "color": "", "visualStyle": "", "density": "" },
    "generationConstraints": { "mustFollow": [], "flexible": [], "forbidden": [] }
  },
  "slides": []
}

每页 slide：
{
  "id": "gen-001", "index": 1,
  "title": "封面", "type": "cover",
  "referenceSlideIds": [1],
  "contentGoal": "用一句话建立项目定位，呈现项目名称、核心价值和团队信息。",
  "elements": [
    {
      "type": "title", "content": "项目名称",
      "position": { "x": 8, "y": 18, "w": 52, "h": 12 },
      "style": { "fontSize": 44, "fontWeight": "bold", "color": "#1e40af" }
    },
    {
      "type": "subtitle", "content": "一句话核心定位",
      "position": { "x": 8, "y": 33, "w": 48, "h": 8 },
      "style": { "fontSize": 20, "fontWeight": "regular", "color": "#475569" }
    },
    {
      "type": "shape", "content": "",
      "description": "右侧放置与主题相关的半透明科技插图或数据看板",
      "position": { "x": 58, "y": 18, "w": 34, "h": 46 },
      "style": { "opacity": 0.9 }
    }
  ],
  "layoutStructure": "左右分栏，左侧标题信息，右侧视觉主图，底部保留团队信息条。",
  "colorRules": { "primary": "#1e40af", "secondary": "#60a5fa", "background": "#f8fafc", "text": "#0f172a" },
  "assetReferences": [],
  "globalStylePrompt": "整体延续参考 PPT 的蓝白科技风，保持浅色背景、深蓝主色、清晰标题层级和卡片式信息组织。",
  "visualPrompt": "生成一页 16:9 中文路演 PPT 封面，浅蓝白渐变背景，左侧大标题和副标题，右侧半透明科技数据看板插图，底部蓝色细线与团队信息，整体专业、克制、可信。",
  "imagePrompt": "右侧科技数据看板插图，蓝白色调，半透明玻璃拟态，干净专业，不要赛博朋克。",
  "chartPrompt": "",
  "speakerNotePrompt": "开场用 20 秒说明项目名称、服务对象和核心价值。",
  "status": "pending"
}

## 六、JSON 字段规则

- id: 唯一，格式 gen-001, gen-002...
- index: 从 1 开始
- title: 用户能看懂的中文页面标题
- type: cover | toc | section-header | content | image-focus | data-display | quote | comparison | summary | closing | agenda | background | problem | insight | solution | architecture | feature | workflow | case | data | business | team
- referenceSlideIds: 尽量填写，匹配参考 PPT 页码
- contentGoal: 一句话说明想让观众理解什么
- elements: **每页必须 3-6 个元素，绝对不能省略或留空数组。** 元素 type 必须使用英文 canonical enum，且只能从 title | subtitle | text | image | shape | icon | card | chart | table | group 中选择。严禁输出中文 type（例如"标题"/"副标题"/"视觉元素"）。每个元素必须包含 type + content + position + style。如果用户资产库有 Logo，在封面和结束页的 elements 中添加 image 或 icon 元素并设置 assetId。
- position: 百分比坐标 { x: 0-100, y: 0-100, w: 0-100, h: 0-100 }，不用 px/cm。每个元素必须有具体位置，不要全部堆在左上角。
- style: 必须包含 fontSize/fontWeight/color，及其他关键视觉信息。不要留空对象 {}。
- layoutStructure: 自然语言说明页面布局
- colorRules: 必须继承参考 PPT 的主色体系，不要随意换色
- assetReferences: 只能引用用户资产库已有编号，不要虚构
- visualPrompt: 150-400 字的整页生成 Prompt，描述页面比例、中文 PPT、背景、布局、标题位置、模块关系、色彩、图标/图片、风格气质、禁止项
- imagePrompt/chartPrompt/speakerNotePrompt: 需要则写具体，不需要写空字符串
- status: pending | generating | generated | modified | confirmed
- globalStylePrompt: 全局风格描述，每页生成时作为风格锚点

## 七、模板推荐规则

如果用户需求和参考 PPT 不匹配，必须提醒，并给 3 个选项：
A. 继续使用当前参考 PPT
B. 换一个更合适的模板
C. 混合当前参考 PPT 的结构和目标场景的视觉风格

## 八、Word/PDF 内容读取规则

未确认读取时先询问，同意后使用。如果文档内容很长，应总结主题、关键论点、数据、案例、适合放入哪些页面。

## 九、图片/Logo 资产规则

使用资产编号引用，不要虚构资产。在需要图片的页面里写入 assetReferences。在元素中说明 Logo 位置。

## 十、修改指定页的规则

当用户要求修改某页时，只输出被修改页。

## 十一、你不能做的事

1. 输出泛泛 PPT 大纲而没有页面 Prompt
2. 忽略参考 PPT 风格
3. 编造不存在的资产编号
4. 把所有页面写成同一种布局
5. 让每页 visualPrompt 都几乎一样
6. 输出无法渲染的 JSON
7. 使用英文界面文案
8. 用户只要求改一页时重写全部
9. 在信息不足时一次问十几个问题
10. 在已有足够信息时还不断追问

## 十二、当信息不足时

返回：
{ "status": "needs_clarification", "message": "我还需要确认几个关键信息，才能生成页面 Prompt。", "questions": ["这份 PPT 是给谁看的？", "大概需要多少页？", "最终用途是答辩、路演、汇报还是培训？"] }

## 十三、质量检查

你生成后必须自检：
1. 页数是否符合用户要求
2. 每页标题是否清楚
3. 每页 type 是否合理
4. 每页是否有 referenceSlideIds
5. 每页是否有 contentGoal
6. 每页是否有 elements
7. 每页是否有 layoutStructure
8. 每页是否继承参考风格
9. 每页 visualPrompt 是否具体
10. 是否引用了不存在的资产
11. 是否出现了用户禁止的风格
12. 是否所有页面布局过于重复
13. 是否 JSON 可解析`;

// ============================================================
// 构建上下文
// ============================================================

function buildRefContext(referenceSlidePrompts: ChatRequest['referenceSlidePrompts']): string {
  if (!referenceSlidePrompts?.length) return '';

  // Compact per-slide summary — global colors/fonts are in masterPrompt, so keep per-slide context lean
  const briefs = referenceSlidePrompts
    .map((p) => {
      const tags = p.styleTags?.join('、') || '';
      const elCount = p.elements?.length || 0;
      const elSummary = (p.elements || [])
        .slice(0, 8)
        .map((e) => `${(e as Record<string, unknown>).type}`)
        .join(',');
      const layoutDesc = p.layoutPatternDescription || p.layoutStructure || '';
      return `**P${p.slideIndex}** ${p.pageType} [${tags}] — ${elCount}元素(${elSummary}) | 布局:${layoutDesc.slice(0, 80)}`;
    })
    .join('\n');

  return `\n\n## 参考 PPT 摘要（共 ${referenceSlidePrompts.length} 页，详细配色/字体见全局母版）\n${briefs}\n`;
}

function buildAssetContext(assets: ChatRequest['assetLibrary']): string {
  if (!assets?.length) return '';
  return (
    `\n\n## 用户资产库（共 ${assets.length} 项）\n` +
    assets
      .map((a) => `- [${a.assetId}] ${a.name} (${a.type}): ${a.description}`)
      .join('\n') +
    `\n\n引用格式: "assetReferences": ["01", "02"]（只引用已存在的编号）\n`
  );
}

// ============================================================
// JSON 解析
// ============================================================

function parseNewFormat(result: string): {
  assistantMessage: string;
  slides: GenSlidePrompt[];
  deckBrief: Record<string, unknown>;
  status: string;
  message: string;
  summary: string;
  questions: string[];
} | null {
  // Try to find JSON in code block or standalone
  const jsonBlockMatch = result.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  const jsonRawMatch = result.match(/^\s*\{[\s\S]*\"status\"[\s\S]*\}\s*$/m);
  const jsonMatch = jsonBlockMatch?.[1] || jsonRawMatch?.[0];

  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch.trim());
    if (!parsed.status) return null;

    if (parsed.status === 'needs_clarification') {
      return {
        assistantMessage: result,
        slides: [],
        deckBrief: {},
        status: 'needs_clarification',
        message: parsed.message || '',
        summary: '',
        questions: parsed.questions || [],
      };
    }

    if (parsed.status === 'ready') {
      const warnings: string[] = [];
      const slides: GenSlidePrompt[] = (parsed.slides || []).map((s: Record<string, unknown>, i: number) => {
        const slideIndex = (s.index as number) || i + 1;
        const elements: GenSlideElement[] = ((s.elements as Array<Record<string, unknown>>) || []).map((el: Record<string, unknown>, idx: number) => ({
          type: normalizePromptElementType(el.type, warnings, slideIndex, idx),
          content: (el.content as string) || '',
          position: {
            x: (el.position as Record<string, number>)?.x ?? 0,
            y: (el.position as Record<string, number>)?.y ?? 0,
            w: (el.position as Record<string, number>)?.w ?? 20,
            h: (el.position as Record<string, number>)?.h ?? 10,
          },
          style: el.style as Record<string, unknown>,
          description: el.description as string | undefined,
        }));

        const colorRules: ColorRules = {
          primary: (s.colorRules as Record<string, string>)?.primary || '#1e40af',
          secondary: (s.colorRules as Record<string, string>)?.secondary || '#60a5fa',
          background: (s.colorRules as Record<string, string>)?.background || '#ffffff',
          text: (s.colorRules as Record<string, string>)?.text || '#0f172a',
          accent: (s.colorRules as Record<string, string>)?.accent,
        };

        const slidePrompt: GenSlidePrompt = {
          id: (s.id as string) || `gen-${String(i + 1).padStart(3, '0')}`,
          index: slideIndex,
          title: (s.title as string) || `第 ${i + 1} 页`,
          type: normalizeSlideRole(s.type, warnings, slideIndex),
          referenceSlideIds: (s.referenceSlideIds as number[]) || [],
          contentGoal: (s.contentGoal as string) || '',
          elements,
          layoutStructure: (s.layoutStructure as string) || '',
          colorRules,
          assetReferences: (s.assetReferences as string[]) || [],
          globalStylePrompt: (s.globalStylePrompt as string) || (parsed.deckBrief as Record<string, unknown>)?.globalStylePrompt as string || '',
          visualPrompt: (s.visualPrompt as string) || '',
          imagePrompt: s.imagePrompt as string | undefined,
          chartPrompt: s.chartPrompt as string | undefined,
          speakerNotePrompt: s.speakerNotePrompt as string | undefined,
          status: normalizePromptStatus(s.status, warnings, slideIndex),
        };

        return slidePrompt;
      });

      if (warnings.length) {
        console.warn('[workbench-chat] normalized model output:', warnings);
      }

      return {
        assistantMessage: result,
        slides,
        deckBrief: (parsed.deckBrief as Record<string, unknown>) || {},
        status: 'ready',
        message: (parsed.message as string) || '',
        summary: (parsed.summary as string) || '',
        questions: [],
      };
    }

    return null;
  } catch {
    return null;
  }
}

// Attempt to salvage truncated JSON
function salvageTruncatedJson(jsonStr: string): string | null {
  const s = jsonStr.trimEnd();
  const stack: string[] = [];
  let lastValidPos = -1;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{' || ch === '[') {
      stack.push(ch);
    } else if (ch === '}') {
      if (stack[stack.length - 1] === '{') { stack.pop(); if (stack.length === 0) lastValidPos = i; }
    } else if (ch === ']') {
      if (stack[stack.length - 1] === '[') { stack.pop(); if (stack.length === 0) lastValidPos = i; }
    } else if (ch === '"') {
      i++;
      while (i < s.length && s[i] !== '"') { if (s[i] === '\\') i++; i++; }
    }
  }

  if (lastValidPos > 0) {
    return s.slice(0, lastValidPos + 1);
  }

  const lastComma = s.lastIndexOf(',\n');
  if (lastComma > 0) {
    const withCloses = s.slice(0, lastComma) + '\n}';
    for (let i = 0; i < 10; i++) {
      try { JSON.parse(withCloses + ']}'); return withCloses + ']}'; } catch { /* keep adding */ }
    }
  }

  return null;
}

// Extract natural language response (everything before the JSON block)
function extractAssistantMessage(result: string): string {
  const jsonStart = result.indexOf('```json');
  if (jsonStart >= 0) {
    return result.slice(0, jsonStart).trim();
  }
  const jsonRaw = result.indexOf('{"status"');
  if (jsonRaw >= 0) {
    return result.slice(0, jsonRaw).trim();
  }
  return result.trim();
}

// ============================================================
// POST Handler
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { messages, styleKit, referenceSlidePrompts, assetLibrary, extractedDocumentText, masterPrompt } = body;

    if (!messages || messages.length === 0) {
      return fail('messages is required', 400);
    }

    if (isMockMode()) {
      return ok({
        assistantMessage: `我已经看完这套参考 PPT。它整体是蓝白科技风，适合项目路演和产品方案汇报。我会优先继承它的深蓝色调和卡片式布局。

接下来请告诉我：
1. 你的 PPT 主题是什么？
2. 面向谁（受众）？
3. 大概需要多少页？`,
        slides: [],
        status: 'needs_clarification',
        questions: ['你的 PPT 主题是什么？', '面向谁（受众）？', '大概需要多少页？'],
      });
    }

    // Build rich context
    const styleContext = styleKit
      ? `\n## StyleKit 设计系统\n` +
        `风格: ${(styleKit.styleDNA as Record<string, unknown>)?.mood || 'professional'}\n` +
        `配色: ${JSON.stringify((styleKit.styleDNA as Record<string, unknown>)?.palette || {})}\n` +
        `字体: ${JSON.stringify((styleKit.styleDNA as Record<string, unknown>)?.typography || {})}\n`
      : '';

    const refContext = buildRefContext(referenceSlidePrompts);
    const assetContext = buildAssetContext(assetLibrary);

    // Only inject document content when user explicitly references it
    const lastUserMsg = messages[messages.length - 1]?.content || '';
    const userReferencesDoc = lastUserMsg.includes('[引用上传文档]') || lastUserMsg.includes('引用文档') || lastUserMsg.includes('参考文档内容');
    const docContext = (extractedDocumentText && userReferencesDoc)
      ? `\n\n## 用户明确引用的文档内容（来自 Word/PDF）\n${extractedDocumentText.slice(0, 3000)}${extractedDocumentText.length > 3000 ? '\n...（内容已截断）' : ''}\n`
      : (extractedDocumentText ? `\n\n## 文档提示\n用户已上传文档（${extractedDocumentText.length} 字），但尚未明确引用。如需使用文档内容，请等用户在消息中点击"引用文档"按钮后再读取。不要主动使用文档内容规划 PPT。\n` : '');

    const isFirstUserMessage = messages.length === 1 && messages[0].role === 'user';
    const masterContext = masterPrompt ? `\n\n${masterPrompt}\n` : '';
    let systemContent = SYSTEM_PROMPT + masterContext + styleContext + refContext + assetContext + docContext;

    // If first message with reference analysis, inject context summary
    if (isFirstUserMessage && (referenceSlidePrompts?.length || assetLibrary?.length || extractedDocumentText)) {
      systemContent += `\n\n## 首次对话上下文摘要\n`;
      if (referenceSlidePrompts?.length) {
        systemContent += `参考 PPT 共 ${referenceSlidePrompts.length} 页，已完成风格分析。请先用简短自然语言总结风格，再询问用户需求。\n`;
      }
      if (assetLibrary?.length) {
        systemContent += `用户已上传 ${assetLibrary.length} 项资产（图片/Logo 等）。\n`;
      }
      if (extractedDocumentText) {
        systemContent += `用户已上传文档（${extractedDocumentText.length} 字），但需等用户明确引用后才使用。请先正常对话了解需求。\n`;
      }
    }

    const fullMessages: ChatMessage[] = [
      { role: 'system', content: systemContent },
      ...messages.map((m) => ({ role: m.role as ChatMessage['role'], content: m.content })),
    ];

    // ---- Streaming SSE response ----
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          let fullText = '';
          for await (const chunk of deepseekStream(fullMessages, { reasoning: false, maxTokens: 16384 })) {
            if (chunk.type === 'text') {
              fullText += chunk.content;
              send('text', { content: chunk.content });
            } else if (chunk.type === 'reasoning') {
              send('reasoning', { content: chunk.content });
            }
          }

          // Parse the accumulated text for structured data
          const result = fullText;
          const newFormatResult = parseNewFormat(result);

          if (newFormatResult) {
            if (newFormatResult.status === 'needs_clarification') {
              send('result', {
                assistantMessage: newFormatResult.assistantMessage,
                slides: [],
                status: 'needs_clarification',
                message: newFormatResult.message,
                questions: newFormatResult.questions,
                deckBrief: newFormatResult.deckBrief,
              });
            } else {
              send('result', {
                assistantMessage: extractAssistantMessage(newFormatResult.assistantMessage),
                slides: newFormatResult.slides,
                status: 'ready',
                message: newFormatResult.message,
                summary: newFormatResult.summary,
                deckBrief: newFormatResult.deckBrief,
                suggestedFollowups: [
                  `✅ 同意，按这 ${newFormatResult.slides.length} 页方案生成`,
                  '📝 调整某页的内容或布局',
                  '💾 保存方案并导出',
                ],
              });
            }
          } else {
            // Fallback: try legacy JSON formats
            let deckPlan: Record<string, unknown> | undefined;
            let brief: Record<string, unknown> | undefined;
            let suggestedFollowups: string[] = [];
            let workOrder: Record<string, unknown> | undefined;

            const tableMatch = result.match(/\|[^|\n]+\|[^|\n]+\|[^|\n]*\n\|[-| ]+\|[^|\n]+\|[^|\n]*\n((?:\|[^\n]+\n?)+)/);
            if (tableMatch) {
              const rows = tableMatch[1].trim().split('\n').filter(Boolean);
              const structure = rows
                .map((row) => {
                  const cells = row.split('|').filter(Boolean).map((c) => c.trim());
                  if (cells.length >= 3) {
                    const pageNum = parseInt(cells[0]);
                    return { type: cells[1] || '内容页', title: cells[2] || '', goal: cells[3] || '', slideIndex: isNaN(pageNum) ? 0 : pageNum };
                  }
                  return null;
                })
                .filter(Boolean) as Array<Record<string, unknown>>;

              if (structure.length > 0) {
                deckPlan = {
                  schemaVersion: 'ppt-assistant-brief-v1',
                  generationBrief: {
                    finalDeckOutline: structure.map((s, i) => ({
                      slideIndex: (s.slideIndex as number) || i + 1,
                      title: s.title || '', section: s.type || '',
                      coreMessage: s.goal || '', visualStrategy: '', matchedReferencePattern: '',
                    })),
                  },
                };
                brief = { status: 'ready_for_generation', contentPlan: { slideCount: structure.length, structure } };
                workOrder = { type: 'deckGenerationBrief', brief };
                suggestedFollowups = [
                  `✅ 同意，按这 ${structure.length} 页方案生成`,
                  '📝 调整某页的内容或布局',
                  '💾 保存方案并导出',
                ];
              }
            }

            const jsonMatch = result.match(/```json\s*([\s\S]*?)(?:```|$)/);
            if (!jsonMatch && !deckPlan) {
              const jsonStart = result.indexOf('{"status"');
              if (jsonStart >= 0) {
                const jsonEnd = result.indexOf('```', jsonStart);
                const jsonStr = jsonEnd >= 0 ? result.slice(jsonStart, jsonEnd) : result.slice(jsonStart);
                try {
                  const parsed = JSON.parse(jsonStr.trim());
                  if (parsed.status && parsed.globalStylePrompt) {
                    brief = parsed;
                    deckPlan = {
                      schemaVersion: 'ppt-assistant-brief-v1',
                      generationBrief: {
                        finalDeckOutline: ((parsed as Record<string, unknown>).contentPlan as Record<string, unknown>)?.structure as Array<Record<string, unknown>> || [],
                      },
                    };
                    workOrder = { type: 'deckGenerationBrief', brief: parsed };
                  }
                } catch { /* ignore */ }
              }
            } else if (jsonMatch) {
              try {
                const parsed = JSON.parse(jsonMatch[1].trim());
                if (parsed.schemaVersion === 'ppt-assistant-brief-v1' || (parsed.status && parsed.globalStylePrompt)) {
                  brief = parsed; deckPlan = parsed.generationBrief || parsed;
                  workOrder = { type: 'deckGenerationBrief', brief: parsed };
                }
              } catch {
                const salvaged = salvageTruncatedJson(jsonMatch[1].trim());
                if (salvaged) {
                  try {
                    const parsed = JSON.parse(salvaged);
                    if (parsed.schemaVersion === 'ppt-assistant-brief-v1') {
                      brief = parsed; deckPlan = parsed.generationBrief || parsed;
                      workOrder = { type: 'deckGenerationBrief', brief: parsed };
                    }
                  } catch { /* still can't parse */ }
                }
              }
            }

            if (suggestedFollowups.length === 0) {
              suggestedFollowups = deckPlan
                ? ['调整第 1 页封面样式', '修改配色方案', '增加一页数据展示']
                : ['帮我生成完整的页面规划', '先看看参考 PPT 的风格总结'];
            }

            send('result', {
              assistantMessage: extractAssistantMessage(result),
              deckPlan, brief, workOrder, suggestedFollowups,
            });
          }
        } catch (error) {
          console.error('Workbench chat stream error:', error);
          send('error', { message: error instanceof Error ? error.message : '对话失败' });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Workbench chat error:', error);
    return fail(error instanceof Error ? error.message : '对话失败');
  }
}
