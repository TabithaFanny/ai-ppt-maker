import { NextRequest } from 'next/server';
import { openaiVisionChat, isMockMode, deepseekWithFallback } from '@/lib/api-client';
import type { ChatMessage } from '@/lib/api-client';
import { ok } from '@/lib/api-response';

// Allow up to 5 minutes for vision analysis with enhanced prompt
export const maxDuration = 300;

interface AnalyzeSlideRequest {
  slideIndex: number;
  imageBase64?: string | null;
  textContent?: string;
  slideXML?: string;
  sourceFileId?: string;
  optionalContext?: string;
}

type AnalyzeSlideErrorCode =
  | 'INVALID_REQUEST'
  | 'MISSING_IMAGE_BASE64'
  | 'VISION_UNAUTHORIZED'
  | 'VISION_FORBIDDEN'
  | 'VISION_RATE_LIMITED'
  | 'VISION_TIMEOUT'
  | 'VISION_FETCH_FAILED'
  | 'VISION_JSON_PARSE_FAILED'
  | 'VISION_UNKNOWN_ERROR';

type AnalyzeSlideError = {
  code: AnalyzeSlideErrorCode;
  message: string;
  detail?: string;
  cause?: string;
  retryable: boolean;
};

const VISION_MAX_TOKENS = 12288;
const DEFAULT_VISION_REQUEST_TIMEOUT_MS = 180_000;
const DEFAULT_ANALYZE_ROUTE_TIMEOUT_MS = 300_000;

function readTimeoutEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 10_000) {
    console.warn(`[AnalyzeSlide] Invalid ${name}=${raw}, using ${fallback}ms`);
    return fallback;
  }
  return parsed;
}

const VISION_REQUEST_TIMEOUT_MS = readTimeoutEnv('VISION_REQUEST_TIMEOUT_MS', DEFAULT_VISION_REQUEST_TIMEOUT_MS);
const ANALYZE_ROUTE_TIMEOUT_MS = readTimeoutEnv('ANALYZE_ROUTE_TIMEOUT_MS', DEFAULT_ANALYZE_ROUTE_TIMEOUT_MS);

function failAnalyze(error: AnalyzeSlideError, status: number): Response {
  return Response.json({ ok: false, success: false, error }, { status });
}

function buildMockVisionAnalysis(slideIndex: number, sourceFileId?: string): Record<string, unknown> {
  return {
    slideType: '封面',
    source: { sourceFileId: sourceFileId || '', slideIndex, imageType: 'mock', language: 'zh-CN', confidenceOverall: 0.95 },
    layout: {
      structure: '左侧标题区、右侧几何装饰的商务封面布局',
      grid: '左70%右30%两栏',
      padding: { top: 8, right: 6, bottom: 8, left: 8 },
      alignment: '左对齐',
      visualFlow: '视线从左上标题进入，经副标题和分割线落到右侧装饰',
    },
    colorSystem: {
      primary: ['#1a56db'],
      secondary: ['#34a853'],
      accent: ['#f59e0b'],
      background: ['#ffffff'],
      gradientRules: '白底为主，蓝色作为标题与装饰强调色',
    },
    typography: {
      title: { fontFamily: 'Inter', fontSize: '44pt', fontWeight: 'bold', color: '#1a56db', lineHeight: 1.2 },
      subtitle: { fontFamily: 'Noto Sans SC', fontSize: '22pt', fontWeight: 'regular', color: '#6b7280' },
      body: { fontFamily: 'Noto Sans SC', fontSize: '18pt', fontWeight: 'regular', color: '#1f2937' },
      label: { fontFamily: 'Noto Sans SC', fontSize: '12pt', fontWeight: 'medium', color: '#64748b' },
    },
    visualElements: [
      { type: 'title', description: '左上角大号蓝色主标题，表达社区治理 AI 平台解决方案主题', style: '蓝色粗体大标题', positionHint: '左上区域', rect: { x: 8, y: 12, w: 70, h: 15 }, content: { text: '社区治理 AI 平台解决方案', imageDescription: '' }, elementStyle: { fontSize: 44, fontWeight: 'bold', color: '#1a56db', fill: '#ffffff', opacity: 1, textAlign: 'left', borderRadius: 0 }, purpose: '主标题，点明 PPT 主题', rebuildInstruction: '在左上放置 44pt 蓝色粗体标题，保持大留白。' },
      { type: 'subtitle', description: '主标题下方灰色副标题，补充说明 AI 驱动社区治理数字化转型', style: '灰色常规字重', positionHint: '标题下方', rect: { x: 8, y: 28, w: 55, h: 6 }, content: { text: '以 AI 技术驱动社区治理数字化转型', imageDescription: '' }, elementStyle: { fontSize: 22, fontWeight: 'regular', color: '#6b7280', fill: '#ffffff', opacity: 1, textAlign: 'left', borderRadius: 0 }, purpose: '副标题补充主题', rebuildInstruction: '在标题下方放置 22pt 灰色副标题。' },
      { type: 'decoration', description: '右上角低透明度蓝色几何装饰，平衡画面视觉重量', style: '浅蓝几何图形、低透明度', positionHint: '右上角', rect: { x: 78, y: 8, w: 18, h: 30 }, content: { text: '无文字', imageDescription: '蓝色几何抽象形状装饰' }, elementStyle: { fontSize: 0, fontWeight: 'regular', color: '#1a56db', fill: '#1a56db', opacity: 0.12, textAlign: 'left', borderRadius: 12 }, purpose: '装饰和平衡构图', rebuildInstruction: '在右上角加入低透明度蓝色几何装饰。' },
      { type: 'line', description: '标题下方短蓝色分割线，强化标题区域层级', style: '蓝色细线、半透明', positionHint: '标题与副标题下方', rect: { x: 8, y: 38, w: 30, h: 1 }, content: { text: '无文字', imageDescription: '' }, elementStyle: { fontSize: 0, fontWeight: 'regular', color: '#1a56db', fill: '#1a56db', opacity: 0.5, textAlign: 'left', borderRadius: 0 }, purpose: '分隔标题与正文区域', rebuildInstruction: '在标题区下方绘制短蓝色分割线。' },
    ],
    background: { type: 'solid', style: '纯白背景', lighting: '明亮通透', texture: '无纹理' },
    compositionRules: { mustFollow: ['左对齐', '大留白', '蓝色强调'], flexible: ['装饰形状可替换'], forbidden: ['不要深色背景', '不要乱码文字', '不要拥挤排版', '不要卡通风格', '不要模糊图标'] },
    semantic: { tone: ['专业', '清晰', '科技'], narrative: '用简洁封面建立方案主题', metaphor: '几何装饰象征数字化能力' },
    slideVisualPrompt: '生成一页专业商务 PPT 封面：纯白背景，左上角放置大号蓝色主标题“社区治理 AI 平台解决方案”，标题下方放灰色副标题“以 AI 技术驱动社区治理数字化转型”，再下方有短蓝色分割线。右上角加入低透明度蓝色几何抽象装饰，整体大留白、左对齐、信息层级清晰，风格专业、简洁、科技感。',
    elementRebuildPrompt: '按 16:9 画布重建：标题位于 x=8 y=12 w=70 h=15，44pt 蓝色粗体；副标题位于 x=8 y=28 w=55 h=6，22pt 灰色；分割线位于 x=8 y=38 w=30 h=1；右上装饰位于 x=78 y=8 w=18 h=30，蓝色低透明度。',
  };
}

function getVisionProviderInfo() {
  const hasBltKey = Boolean(process.env.BLT_API_KEY);
  return {
    provider: isMockMode() ? 'Mock' : hasBltKey ? 'BLT' : 'OpenAI',
    baseURL: hasBltKey
      ? process.env.BLT_API_BASE_URL || process.env.BLT_BASE_URL || 'https://api.bltcy.ai/v1'
      : process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  };
}

function getErrorCause(error: unknown): string | undefined {
  if (!(error instanceof Error) || !('cause' in error)) return undefined;
  const cause = (error as Error & { cause?: { code?: string; name?: string; message?: string } }).cause;
  return cause?.code || cause?.name || cause?.message;
}

function classifyVisionError(error: unknown): AnalyzeSlideError {
  const detail = error instanceof Error ? error.message : String(error);
  const cause = getErrorCause(error);
  if (/401|Unauthorized|API Key 无效|未配置/i.test(detail)) {
    return { code: 'VISION_UNAUTHORIZED', message: '视觉分析失败：BLT/OpenAI API Key 无效、过期或未配置。', detail, cause, retryable: false };
  }
  if (/403|访问被拒绝/i.test(detail)) {
    return { code: 'VISION_FORBIDDEN', message: '视觉分析失败：当前 API Key 无权访问视觉模型。', detail, cause, retryable: false };
  }
  if (/429|频率|rate limit|quota/i.test(detail)) {
    return { code: 'VISION_RATE_LIMITED', message: '视觉分析失败：请求频率或额度受限，请稍后重试。', detail, cause, retryable: true };
  }
  if (/AbortError|abort|timeout|timed out|超时/i.test(detail) || cause === 'UND_ERR_ABORTED') {
    return {
      code: 'VISION_TIMEOUT',
      message: `视觉分析失败：请求超时（${Math.round(VISION_REQUEST_TIMEOUT_MS / 1000)}秒）。可稍后重试，或在部署环境调大 VISION_REQUEST_TIMEOUT_MS。`,
      detail,
      cause,
      retryable: true,
    };
  }
  if (/JSON parse|returned non-object/i.test(detail)) {
    return { code: 'VISION_JSON_PARSE_FAILED', message: '视觉分析失败：模型返回内容不是有效 JSON。', detail, cause, retryable: true };
  }
  if (/fetch failed|ECONNRESET|ETIMEDOUT|UND_ERR/i.test(detail) || cause) {
    return { code: 'VISION_FETCH_FAILED', message: '视觉分析失败：Vision 服务连接失败。', detail, cause, retryable: true };
  }
  return { code: 'VISION_UNKNOWN_ERROR', message: '视觉分析失败：未知错误。', detail, cause, retryable: true };
}

function logVisionEvent(event: string, fields: Record<string, unknown>) {
  const { provider, baseURL } = getVisionProviderInfo();
  console.log('[AnalyzeSlide]', JSON.stringify({ event, provider, baseURL, ...fields }));
}

// ============================================================
// Prompt 1 — PPT 视觉解析引擎 (Reference Analyzer)
// ============================================================

const ANALYZE_SLIDE_PROMPT = `你是 PPT 视觉反向工程引擎。你的任务是把一张 PPT 截图拆成「稳定、可解析、可复刻」的工程规格。

## 绝对规则（违反任何一条都是失败）

1. 只输出合法 JSON 对象，不要 Markdown 代码块、不要解释文字、不要注释、不要尾逗号。
2. 所有说明字段用中文，但 JSON key 和 type enum 必须保持英文。
3. content.text 必须逐字抄写截图中的原文；没有文字写"无文字"。
4. 每页拆出 6-16 个 visualElements，优先保留：标题、正文、图片、卡片、图标、关键形状、页码。
5. rect 使用 16:9 画布百分比坐标 0-100，必须估算真实位置，不能全 0。
6. 输出必须短而完整，宁可少写描述，也不要让 JSON 被截断。

## 你必须像这样拆解（示例）

如果截图是挑战杯答辩封面，你应该拆出类似这些元素：
- logo：左上角彩色旋转箭头式比赛logo，红蓝绿三色环绕，rect={x:2,y:2,w:6,h:6}
- body：logo右侧两行深蓝色文字"第15届 '挑战杯' / 中国大学生创业计划竞赛"，黑体14pt深蓝色
- title：大号蓝色渐变书法字"智微社工"，带高光墨迹飞白笔触，rect={x:5,y:25,w:45,h:18}
- line：标题下方细蓝色横线装饰，中间放口号文字
- subtitle：口号"服务更进一步，关怀更近一程"，蓝色黑体居中
- shape：深蓝到亮蓝渐变圆角胶囊副标题条，白色加粗文字"基于AI前置识别的社区社工智能分流与闭环服务平台"
- card：四条横向圆角信息胶囊（团队名称、项目方向等），白色半透明底、浅蓝描边
- image：右侧年轻女性社区社工坐在服务中心咨询桌前的真实场景照片
- decoration：左右交界处淡蓝色数据网格线、光点、对话气泡轮廓
- decoration：底部横贯全宽蓝色流线波浪科技纹理，带城市天际线剪影

**注意：以上只是示例格式，你必须根据实际截图内容来拆解。**

## 输出 JSON 结构

严格输出以下 JSON（合法JSON，无注释，无尾逗号，所有字段必须存在）：

{
  "slideType": "封面/目录/内容页/章节页/数据页/结束页/产品页/流程页/团队页/对比页",
  "layout": {
    "structure": "详细中文描述，如'左右分区布局：左侧占55%放项目标题与四条信息胶囊，右侧占45%放社区社工真实工作场景主视觉图'",
    "grid": "栏数和比例，如'左55%右45%两栏'",
    "padding": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
    "alignment": "对齐方式",
    "visualFlow": "中文描述视觉动线，如'视线从左上logo→主标题→副标题→信息条→右侧人物'"
  },
  "colorSystem": {
    "primary": ["#hex"],
    "secondary": ["#hex"],
    "accent": ["#hex"],
    "background": ["#hex"],
    "gradientRules": "如'背景浅蓝白渐变，主色科技蓝#1e40af，辅色湖蓝#0ea5e9，强调色亮蓝#3b82f6'"
  },
  "typography": {
    "title": { "fontFamily": "", "fontSize": "36pt", "fontWeight": "bold", "color": "#hex", "lineHeight": 1.2 },
    "subtitle": { "fontFamily": "", "fontSize": "20pt", "fontWeight": "regular", "color": "#hex" },
    "body": { "fontFamily": "", "fontSize": "14pt", "fontWeight": "regular", "color": "#hex" },
    "label": { "fontFamily": "", "fontSize": "10pt", "fontWeight": "medium", "color": "#hex" }
  },
  "visualElements": [
    {
      "type": "title|subtitle|body|bullet_list|image|icon|shape|chart|table|decoration|page_number|line|logo|card|progress_bar",
      "description": "20-80字中文，描述元素外观、内容和位置",
      "style": "中文概括样式，如'白底、蓝色描边、圆角12px'",
      "positionHint": "中文位置描述：如'左上角，距顶2%距左2%'",
      "rect": { "x": 0, "y": 0, "w": 0, "h": 0 },
      "content": {
        "text": "逐字抄写原文！多行用换行符分隔。如果没有文字写'无文字'",
        "imageDescription": "如是图片则用30-100字描述画面；否则写空字符串"
      },
      "elementStyle": {
        "fontSize": 36,
        "fontWeight": "bold",
        "color": "#1e40af",
        "fill": "#ffffff",
        "opacity": 1,
        "textAlign": "left",
        "borderRadius": 0
      },
      "purpose": "中文功能说明",
      "rebuildInstruction": "20-80字中文重建规格，包含字号/颜色/位置/容器样式"
    }
  ],
  "background": {
    "type": "solid|gradient|image|pattern",
    "style": "详细描述：如'浅蓝(#eef4ff)到白色(#ffffff)的从上到下线性渐变'",
    "lighting": "如'整体明亮通透，无暗角'",
    "texture": "如'叠加淡化世界地图点阵纹理、社区治理网络线、柔和光点'"
  },
  "compositionRules": {
    "mustFollow": ["必须遵守的构图规则，至少3条"],
    "flexible": ["可灵活调整的部分"],
    "forbidden": ["必须列出5条以上禁止项，如'不要深黑背景','不要卡通插画','不要emoji','不要乱码文字','不要模糊词汇'"]
  },
  "semantic": {
    "tone": ["情绪标签3-5个，如'专业','科技','可信','温暖'"],
    "narrative": "叙事逻辑描述",
    "metaphor": "视觉隐喻描述"
  },
  "slideVisualPrompt": "120-260字中文完整复刻Prompt",
  "elementRebuildPrompt": "80-180字中文逐元素重建规格说明"
}

---

## visualElements 拆解规范（最核心）

**像 OCR 一样逐字读取截图中的所有文字。**

拆解层次：
1. **母版层**：logo、赛事名称、导航栏、页码、项目标识 —— 每个都要单独列
2. **标题层**：主标题、英文副标题、标题下横线装饰、主题判断句
3. **内容层**：卡片、图表、列表、数据胶囊、时间轴节点、流程步骤
4. **视觉层**：人物照片、场景图、设备mockup、图标
5. **装饰层**：底部波浪、渐变色块、网格线、光效、城市剪影
6. **交互层**：导航栏高亮状态、按钮、标签胶囊

每个元素的 description 控制在 20-80 字，包含：
- 元素长什么样（颜色、形状、字体风格）
- 元素里写了什么（原文抄写）
- 元素在页面中的位置关系（在谁的下方/右侧/内部）

每个元素的 rebuildInstruction 控制在 20-80 字，像工程规格书一样写：
- 精确字号、字重、颜色hex
- 精确位置（距左x%、距顶y%、宽w%、高h%）
- 容器样式（圆角、描边、阴影、透明度）
- 与相邻元素的间距关系

## slideVisualPrompt 要求（120-260字）

必须像以下格式一样详细：

"设计一页16:9横版PPT[页面类型]页。整体风格为[风格描述]。

页面采用[布局结构]布局：[详细描述每个区域占比和内容]。

整体配色：[列出所有颜色和使用场景]。

[区域1名称]：[详细描述该区域所有元素、样式、内容]。

[区域2名称]：[详细描述该区域所有元素、样式、内容]。

[装饰和背景]：[详细描述]。

整体要求：[列出5条以上具体要求和禁止项]。"

禁止：模糊词（高级感/美观/合理布局/适当装饰）
必须：每个颜色给hex值，每个字号给pt值，每个位置给百分比

## elementRebuildPrompt 要求（80-180字）

按区域逐元素列出重建规格，格式：

"[区域名]：
- [元素名]：[实际内容原文] → [字号]pt[字重][颜色hex]，[位置描述]，[容器样式]
- [元素名]：[实际内容原文] → [字号]pt[字重][颜色hex]，[位置描述]，[容器样式]
..."

禁止行为：
- 不要用英文写 description/purpose（必须中文）
- 不要写泛指词"Main Title""Text Block""Header"
- 不要遗漏页面上任何可见文字
- 不要输出非JSON内容
- content.text 绝对不能为空（没有文字写"无文字"）
- rect 不能全部为 0
- description 不能空
- rebuildInstruction 不能空
- slideVisualPrompt 不能空
- forbidden 列表不能少于 5 条

所有字段必须存在，不确定也要输出最合理的估计值。`;

const ANALYZE_SLIDE_RETRY_PROMPT = `${ANALYZE_SLIDE_PROMPT}

## 重试补充规则

上一次输出不完整。请重新观察图片并输出完整 JSON：
- visualElements 至少 6 个。
- slideVisualPrompt 必须填写 120-220 字。
- elementRebuildPrompt 必须填写 80-160 字。
- 不要省略 compositionRules、semantic、background。
- 如果页面很简单，也要把背景、主标题、副标题、图片区、装饰线、页码/标签分别列为元素。`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getVisualElementsCount(result: Record<string, unknown>): number {
  const elements = result.visualElements;
  return Array.isArray(elements) ? elements.length : 0;
}

function isUsableVisionResult(result: Record<string, unknown>): boolean {
  return getVisualElementsCount(result) >= 6
    && typeof result.slideVisualPrompt === 'string'
    && result.slideVisualPrompt.trim().length >= 40;
}

// ============================================================
// JSON 清洗
// ============================================================

function cleanJsonResponse(text: string): string {
  let cleaned = text;

  // Remove markdown code blocks (handle both closed and UNCLOSED blocks)
  const closedBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (closedBlockMatch) {
    cleaned = closedBlockMatch[1].trim();
  } else {
    // Handle truncated/unclosed code block: ```json\n{...  (no closing ```)
    const openBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*)/);
    if (openBlockMatch) {
      cleaned = openBlockMatch[1].trim();
    }
  }

  // Remove any text before first { or after last }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  } else if (firstBrace >= 0) {
    // No closing brace found — truncated JSON, take from first brace
    cleaned = cleaned.slice(firstBrace);
  }

  // Try to repair truncated JSON (e.g. max_tokens hit)
  cleaned = cleaned.trim();
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // Aggressive truncation repair:
    // 1. If we're inside a string (odd number of unescaped quotes), close it
    // 2. Remove trailing incomplete key-value pairs
    // 3. Close all unclosed brackets/braces

    // First, try to find a safe truncation point by scanning
    let braces = 0;
    let brackets = 0;
    let inString = false;
    let escape = false;
    let lastSafePos = -1;

    for (let i = 0; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') braces++;
      else if (ch === '}') { braces--; if (braces === 0 && brackets === 0) lastSafePos = i; }
      else if (ch === '[') brackets++;
      else if (ch === ']') { brackets--; if (braces === 0 && brackets === 0) lastSafePos = i; }
    }

    // If we found a complete top-level object, use it
    if (lastSafePos > 0) {
      const candidate = cleaned.slice(0, lastSafePos + 1);
      try {
        JSON.parse(candidate);
        return candidate;
      } catch { /* continue to aggressive repair */ }
    }

    // Aggressive repair: close the string if open, remove trailing garbage, close brackets
    if (inString) {
      // We're inside a string at EOF — find last complete line and close there
      const lastNewline = cleaned.lastIndexOf('\n');
      const lastQuote = cleaned.lastIndexOf('"');
      if (lastNewline > lastQuote) {
        cleaned = cleaned.slice(0, lastNewline) + '"';
      } else {
        cleaned += '"';
      }
    }

    // Remove trailing incomplete key:value or array items
    cleaned = cleaned.replace(/,\s*"[^"]*"\s*:\s*"[^"]*$/, '');
    cleaned = cleaned.replace(/,\s*"[^"]*"\s*:\s*$/, '');
    cleaned = cleaned.replace(/,\s*"[^"]*$/, '');
    cleaned = cleaned.replace(/,\s*$/, '');
    cleaned = cleaned.replace(/:\s*$/, ': null');

    // Recount and close brackets
    braces = 0;
    brackets = 0;
    inString = false;
    escape = false;
    for (const ch of cleaned) {
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') braces++;
      else if (ch === '}') braces--;
      else if (ch === '[') brackets++;
      else if (ch === ']') brackets--;
    }
    while (brackets > 0) { cleaned += ']'; brackets--; }
    while (braces > 0) { cleaned += '}'; braces--; }

    // Final validation
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch {
      // Last resort: return what we have (caller will handle the error)
      return cleaned;
    }
  }
}

// ============================================================
// 视觉分析：GPT-4o vision
// ============================================================

async function compressImageForVision(base64: string): Promise<string> {
  try {
    const sharp = (await import('sharp')).default;
    const raw = base64.includes(',') ? base64.split(',')[1] : base64;
    const buf = Buffer.from(raw, 'base64');
    const compressed = await sharp(buf)
      .resize(896, undefined, { withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toBuffer();
    const result = 'data:image/jpeg;base64,' + compressed.toString('base64');
    console.log(`[AnalyzeSlide] Image compressed: ${base64.length} → ${result.length} chars`);
    return result;
  } catch (e) {
    console.warn('[AnalyzeSlide] sharp compression failed, using original:', (e as Error).message);
    return base64;
  }
}

async function callVisionAnalysisPrompt(
  prompt: string,
  imageBase64: string,
  signal: AbortSignal | undefined,
  attempt: 'primary' | 'retry',
): Promise<Record<string, unknown>> {
  const startedAt = Date.now();
  logVisionEvent('vision_request_start', {
    attempt,
    imageBase64Length: imageBase64.length,
    compressedImageBytesEstimate: Math.round((imageBase64.length * 3) / 4),
    maxTokens: VISION_MAX_TOKENS,
    timeoutMs: VISION_REQUEST_TIMEOUT_MS,
    startedAt,
  });
  const content = await openaiVisionChat(prompt, imageBase64, {
    maxTokens: VISION_MAX_TOKENS,
    signal,
    timeoutMs: VISION_REQUEST_TIMEOUT_MS,
  });
  logVisionEvent('vision_response_received', {
    attempt,
    durationMs: Date.now() - startedAt,
    responseLength: content.length,
  });

  const cleaned = cleanJsonResponse(content);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    console.error(`[AnalyzeSlide] JSON parse failed after cleanup. Cleaned length: ${cleaned.length}, Raw length: ${content.length}`);
    console.error(`[AnalyzeSlide] Last 100 chars of cleaned: ${cleaned.slice(-100)}`);
    throw new Error(`analyze-slide JSON parse failed. Raw (first 300 chars): ${content.slice(0, 300)}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`analyze-slide returned non-object: ${typeof parsed}`);
  }

  return parsed as Record<string, unknown>;
}

async function analyzeWithVision(imageBase64: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const compressed = await compressImageForVision(imageBase64);
  const primary = await callVisionAnalysisPrompt(ANALYZE_SLIDE_PROMPT, compressed, signal, 'primary');
  if (isUsableVisionResult(primary)) return primary;

  logVisionEvent('vision_result_incomplete', {
    elements: getVisualElementsCount(primary),
    slideVisualPromptLength: typeof primary.slideVisualPrompt === 'string' ? primary.slideVisualPrompt.length : 0,
  });

  const retry = await callVisionAnalysisPrompt(ANALYZE_SLIDE_RETRY_PROMPT, compressed, signal, 'retry');
  if (isUsableVisionResult(retry)) return retry;

  throw new Error(`analyze-slide returned incomplete result: elements=${getVisualElementsCount(retry)}, slideVisualPromptLength=${isRecord(retry) && typeof retry.slideVisualPrompt === 'string' ? retry.slideVisualPrompt.length : 0}`);
}

// ============================================================
// 文本回退：无图片时用 DeepSeek + XML 文本做基础分析
// ============================================================

function buildTextFallbackPrompt(slideIndex: number, textContent: string, slideXML: string): ChatMessage[] {
  // Extract font info from XML
  const fontMatches = slideXML.match(/<a:latin typeface="([^"]+)"/g) || [];
  const fonts = [...new Set(fontMatches.map((m) => m.match(/typeface="([^"]+)"/)?.[1]).filter(Boolean))];

  // Detect page type
  let pageType = '内容页';
  if (slideXML.includes('type="title"') && !slideXML.includes('type="body"')) pageType = '封面';
  else if (slideXML.includes('type="center"')) pageType = '章节页';

  return [
    {
      role: 'system',
      content: `${ANALYZE_SLIDE_PROMPT}

注意：当前没有图片，只有从 PPTX XML 中提取的文本。请基于文本内容进行最大程度推断，输出完整 JSON。
对于颜色、布局、元素位置等视觉信息，使用你认为最合理的默认值，并在 confidenceOverall 中设置为较低值（0.3-0.5）。
在 styleAnalysis 中标注 designKeywords 包含 "text-only-fallback"。
所有字段必须存在，不要省略任何字段。`,
    },
    {
      role: 'user',
      content: `Slide Index: ${slideIndex}
Page Type Hint: ${pageType}
Fonts detected: ${fonts.join(', ') || 'Unknown'}

Extracted text content from slide XML:
${textContent.slice(0, 2000)}

请输出完整的 referenceAnalysis JSON。`,
    },
  ];
}

async function analyzeFromText(
  slideIndex: number,
  textContent: string,
  slideXML: string
): Promise<Record<string, unknown>> {
  const messages = buildTextFallbackPrompt(slideIndex, textContent, slideXML);

  try {
    const result = await deepseekWithFallback(messages, { reasoning: false, maxTokens: 16384 });
    const cleaned = cleanJsonResponse(result.content);

    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      if (!obj.source) obj.source = {};
      (obj.source as Record<string, unknown>).slideIndex = slideIndex;
      return obj;
    }
    throw new Error('Parsed result is not an object');
  } catch (err) {
    console.error('[AnalyzeSlide] Text fallback failed:', err);
    // Return minimal valid structure
    return buildMinimalFallback(slideIndex, textContent);
  }
}

function isVisionConfigError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  // When multiple URLs are tried, errors are joined with "；"
  // Only treat as config error if ALL sub-errors are auth/config related
  const parts = message.split('；').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return false;
  const configPattern = /未配置|Unauthorized|401|403/i;
  return parts.every(part => configPattern.test(part));
}

function getVisionFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/401|Unauthorized|API Key 无效|未配置/i.test(message)) {
    return '视觉分析失败：BLT/OpenAI API Key 无效、过期或未配置。请检查 BLT_API_KEY 与 BLT_API_BASE_URL 后重试。';
  }
  if (/403|访问被拒绝/i.test(message)) {
    return '视觉分析失败：当前 API Key 无权访问视觉模型，请检查账号权限或模型权限。';
  }
  if (/429|频率|rate limit|quota/i.test(message)) {
    return '视觉分析失败：请求频率或额度受限。请降低并发、稍后重试，或检查账户余额。';
  }
  if (/abort|timeout|timed out|超时/i.test(message)) {
    return '视觉分析失败：请求超时。该页图片可能较复杂，建议稍后单页重试。';
  }
  if (/JSON parse|returned non-object/i.test(message)) {
    return '视觉分析失败：模型返回内容不是有效 JSON。建议单页重试，或降低该页复杂度后重试。';
  }
  return `视觉分析失败：${message.slice(0, 240) || '未知错误'}。已停止文本猜测回退，避免生成假性拆解。`;
}

function hasEnoughTextFallbackContext(textContent: string, slideXML: string): boolean {
  const normalizedText = textContent.replace(/\s+/g, '');
  const normalizedXml = slideXML.replace(/\s+/g, '');
  return normalizedText.length >= 20 || normalizedXml.length >= 500;
}

function buildMinimalFallback(slideIndex: number, textContent: string): Record<string, unknown> {
  return {
    schemaVersion: 'ppt-reference-analysis-v1',
    source: { sourceFileId: '', slideIndex, imageType: 'text-fallback', language: 'zh-CN', confidenceOverall: 0.2 },
    pageIdentity: { detectedPageType: '内容页', presentationType: 'general', pageFunction: 'content', pageTitle: '', coreMessage: '', canvasRatio: '16:9' },
    styleAnalysis: {
      overallStyle: ['minimalist'],
      visualMood: ['专业'],
      designKeywords: ['text-only-fallback'],
      colorPalette: [{ hex: '#1e40af', role: 'primary', usage: '标题', approximateAreaRatio: '5%', emotionalEffect: '专业', replaceability: '可替换' }],
      typography: {
        title: { fontFamilyGuess: '微软雅黑', fontWeight: 'bold', fontSizeEstimate: '36pt', color: '#1e40af', alignment: 'left' },
        subtitle: { fontFamilyGuess: '微软雅黑', fontWeight: 'normal', fontSizeEstimate: '20pt', color: '#374151', alignment: 'left' },
        body: { fontFamilyGuess: '微软雅黑', fontWeight: 'normal', fontSizeEstimate: '16pt', color: '#1f2937', alignment: 'left' },
        caption: { fontFamilyGuess: '微软雅黑', fontWeight: 'normal', fontSizeEstimate: '12pt', color: '#6b7280', alignment: 'left' },
      },
      layoutSystem: { canvasRatio: '16:9', safeMargins: { top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 }, gridSystem: 'single-column', dominantAxis: 'vertical', densityLevel: 'low', whitespaceLevel: 'high' },
      shapeLanguage: [],
      imageStyle: { hasImage: false, imageTypes: [], regenerationStrategy: 'none' },
      decorationSystem: { backgroundLayers: [], texture: [], lines: [], glow: [], shadow: [], borders: [], ornaments: [] },
    },
    globalPersistentElements: [],
    layoutPattern: { name: 'text-only', structureSummary: '纯文本页面', moduleMap: [], readingOrder: [], adaptationPotential: '低' },
    elements: textContent ? [{
      id: 'text-body',
      type: 'body_text',
      role: '正文',
      layerIndex: 0,
      boundingBox: { x: 0.05, y: 0.08, w: 0.9, h: 0.84 },
      content: { text: textContent.slice(0, 500) },
      style: { fontSize: '16pt', fontWeight: 'normal', textColor: '#1f2937', alignment: 'left' },
      interactionEditable: true,
      pptxRenderType: 'textBox',
      reproductionInstruction: '创建文本框放入正文',
      confidence: 0.5,
    }] : [],
    prompts: {
      universalStylePrompt: '',
      slideVisualPrompt: textContent ? `生成一页内容页，包含以下文字：${textContent.slice(0, 200)}` : '',
      elementRebuildPrompt: '',
      negativePrompt: '',
    },
    adaptationRules: { suitableForScenes: [], mustPreserve: [], canModify: ['文本内容'], mustAvoid: ['整页截图'], contentCapacity: { titleMaxChars: 20, bodyMaxChars: 200, maxCards: 4 } },
    validationChecklist: [{ item: '文字可读', passCondition: '所有文字≥14pt', importance: 'high' }],
  };
}

// ============================================================
// POST Handler
// ============================================================

export async function POST(request: NextRequest) {
  const requestStartedAt = Date.now();
  try {
    const body = (await request.json()) as AnalyzeSlideRequest;
    const { slideIndex, imageBase64, sourceFileId } = body;

    if (typeof slideIndex !== 'number') {
      return failAnalyze({
        code: 'INVALID_REQUEST',
        message: 'slideIndex (number) is required',
        retryable: false,
      }, 400);
    }

    // Mock mode
    if (isMockMode()) {
      logVisionEvent('mock_response', { slideIndex, durationMs: Date.now() - requestStartedAt });
      return ok(buildMockVisionAnalysis(slideIndex, sourceFileId));
    }

    if (!imageBase64 || typeof imageBase64 !== 'string' || !imageBase64.trim()) {
      logVisionEvent('missing_image', { slideIndex, durationMs: Date.now() - requestStartedAt });
      return failAnalyze({
        code: 'MISSING_IMAGE_BASE64',
        message: '当前页面缺少图像，无法进行视觉分析',
        retryable: false,
      }, 400);
    }

    // Vision analysis with GPT-4o
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ANALYZE_ROUTE_TIMEOUT_MS);

    try {
      try {
        const result = await analyzeWithVision(imageBase64, controller.signal);
        if (!result.source) result.source = {};
        (result.source as Record<string, unknown>).slideIndex = slideIndex;
        if (sourceFileId) (result.source as Record<string, unknown>).sourceFileId = sourceFileId;
        logVisionEvent('analysis_success', { slideIndex, durationMs: Date.now() - requestStartedAt });
        return ok(result);
      } catch (visionError) {
        const error = classifyVisionError(visionError);
        logVisionEvent('analysis_failed', {
          slideIndex,
          durationMs: Date.now() - requestStartedAt,
          errorCode: error.code,
          errorCause: error.cause,
          errorDetail: error.detail?.slice(0, 300),
        });
        const status = error.code === 'VISION_UNAUTHORIZED' ? 401
          : error.code === 'VISION_FORBIDDEN' ? 403
            : error.code === 'VISION_RATE_LIMITED' ? 429
              : error.code === 'VISION_TIMEOUT' ? 504
                : 502;
        return failAnalyze(error, status);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    const classified = classifyVisionError(error);
    logVisionEvent('request_failed', {
      durationMs: Date.now() - requestStartedAt,
      errorCode: classified.code,
      errorCause: classified.cause,
      errorDetail: classified.detail?.slice(0, 300),
    });
    return failAnalyze(classified, 500);
  }
}
