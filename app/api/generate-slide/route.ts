import { NextRequest } from 'next/server';
import { deepseekWithFallback, withRetry, isMockMode } from '@/lib/api-client';
import type { ChatMessage } from '@/lib/api-client';
import { ok, fail } from '@/lib/api-response';

interface GenerateSlideRequest {
  slideIndex: number;
  referenceAnalysis?: Record<string, unknown>;
  deckGenerationBrief?: Record<string, unknown>;
  slidePlan?: {
    slideIndex: number;
    section: string;
    title: string;
    coreMessage: string;
    contentBlocks: unknown[];
    visualStrategy: string;
    layoutStrategy: string;
    matchedReferencePattern: string;
    speakerNoteIntent: string;
  };
  previousGeneratedSlides?: Array<Record<string, unknown>>;
}

// ============================================================
// Prompt 3 — 单页 PPT 生成引擎
// ============================================================

const GENERATE_SLIDE_PROMPT = `你是 AI PPT Generator 的「单页 PPT 生成引擎」。你的任务是根据参考页拆解结果和用户需求，生成一页新的 PPT JSON。

你的输出不是普通文案，也不是图片描述，而是可用于 Web 预览、PPTX 原生导出和后续微调的单页结构化 JSON。

你必须严格继承参考页的风格 DNA，同时根据用户的新内容生成新的页面。你必须做到：
1. 风格像参考页
2. 内容是用户的新主题
3. 页面结构清楚
4. 元素可编辑
5. 坐标可渲染
6. 文字可读
7. 不把整页做成一张截图
8. 输出可进入 pptxgenjs 或类似 PPTX 渲染器
9. 每个元素都有明确位置、层级、样式和复刻/生成说明
10. 必须包含单页 visualPrompt、imagePrompt、speakerNotes 和 validationChecklist

## 生成原则

1. 先判断当前页 pageFunction：cover/agenda/transition/background/problem/market_analysis/product_overview/feature_explanation/workflow/technology/business_model/progress/competition/team/future_plan/conclusion/appendix

2. 选择最合适的参考页布局：
   - 功能相同 → 高保真继承布局
   - 功能不同但风格相同 → 继承风格/背景/卡片/字体/装饰系统，重新组织模块
   - 用户要求"完全复刻" → 元素数量和位置尽量与参考页一致
   - 用户要求"只参考风格" → 只继承视觉 DNA，不强行继承页面结构

3. 根据内容容量调整页面：
   - 标题不要过长
   - 正文不要堆满
   - 每个卡片最多 2-4 条短句
   - 数据胶囊只放关键数字
   - 复杂解释优先图示化
   - 口播内容放 speakerNotes，不要全部上屏

4. 保证 PPTX 可编辑：
   - 标题是文本框
   - 正文是文本框
   - 卡片是 shape
   - 图标是 icon/svg placeholder
   - 图表是 chartSpec/shapeGroup
   - 背景可以是 shape/gradient/texture，但不允许整页截图
   - AI 图片只能作为局部插图或主视觉资产，不能替代整页

5. 保证中文投影可读：
   - 标题字号大（≥28pt）
   - 正文精简（≥16pt）
   - 颜色对比足够
   - 小字不能承担关键信息
   - 背景纹理必须弱化
   - 不使用 emoji
   - 不使用过度装饰

## 风格继承规则

从 referenceAnalysis 继承：
1. colorPalette：primary/secondary/accent/background/text/neutral
2. typography：标题字体气质、字号层级、字重、行距、对齐方式
3. backgroundSystem：渐变方向、纹理类型、波浪线、城市天际线、点阵地图、光点、科技线、留白
4. cardSystem：圆角、描边、阴影、透明度、标题条、内边距、数据胶囊
5. navigationSystem：顶部导航位置、章节高亮方式、其他章节弱化方式
6. visualLanguage：图标风格、图表风格、真实图片风格、mockup风格、流程图风格
7. negativeRules：mustAvoid 的内容继续禁止

## 元素生成规则

每个元素：
- id: 唯一标识
- type: background/background_gradient/logo/navigation/nav_item/page_title/subtitle/theme_statement/section_label/card/data_card/data_capsule/text_block/bullet_list/quote_card/timeline/flow_diagram/chart/table/icon/photo_placeholder/image_asset/device_mockup/map/connector_line/arrow/divider/decorative_shape/bottom_summary_bar/footer/page_number
- role: 元素作用
- layerIndex: 层级（0=背景, 10=正文, 20=前景装饰, 30=最前）
- boundingBox: {x, y, w, h} 0-1 相对坐标
- content: {text, visibleText, data, semanticMeaning}
- style: {fill, stroke, strokeWidth, opacity, borderRadius, shadow, font, fontSize, fontWeight, textColor, alignment, padding}
- interactionEditable: 是否可编辑
- pptxRenderType: textBox/shape/chart/image/icon/group
- generationInstruction: 如何生成/放置此元素
- sourceReference: {inheritedFromReferenceElementId, inheritanceType: "position"|"style"|"structure"|"mood"|"none"}

## 输出 JSON 结构

必须严格输出以下 JSON（合法 JSON，无注释，无尾逗号）：

{
  "schemaVersion": "ppt-single-slide-generation-v1",
  "slideMeta": {
    "deckId": "",
    "slideIndex": 0,
    "section": "",
    "pageFunction": "",
    "matchedReferenceSlideIndex": null,
    "generationMode": "style_adapted",
    "canvasRatio": "16:9",
    "language": "zh-CN"
  },
  "pageContent": {
    "pageTitle": "",
    "subtitle": "",
    "coreMessage": "",
    "contentModules": [
      {"moduleId": "", "moduleTitle": "", "keyPoint": "", "supportingText": "", "visualForm": "", "importance": "high"}
    ],
    "bottomConclusion": "",
    "speakerNotes": {"mainScript": "", "transitionFromPrevious": "", "transitionToNext": "", "oralOnlyDetails": [], "possibleQuestions": []}
  },
  "styleInheritance": {
    "inheritedStyleDNA": {
      "overallStyle": [],
      "visualMood": [],
      "colorPalette": [{"hex": "", "role": "", "usage": ""}],
      "typography": {"title": {}, "subtitle": {}, "body": {}},
      "backgroundSystem": {},
      "cardSystem": {},
      "navigationSystem": {},
      "decorationSystem": {},
      "negativeRules": []
    },
    "adaptedStyleRules": [],
    "styleStrictness": "high"
  },
  "layoutSpec": {
    "layoutName": "",
    "structureSummary": "",
    "safeMargins": {"top": 0.05, "right": 0.05, "bottom": 0.05, "left": 0.05},
    "gridSystem": "",
    "readingOrder": [],
    "modulePlacement": [
      {"moduleId": "", "position": "", "boundingBox": {"x": 0, "y": 0, "w": 0, "h": 0}, "alignment": ""}
    ]
  },
  "elements": [
    {
      "id": "",
      "type": "",
      "role": "",
      "layerIndex": 0,
      "boundingBox": {"x": 0, "y": 0, "w": 0, "h": 0},
      "positionDescription": "",
      "sizeDescription": "",
      "content": {"text": "", "visibleText": "", "data": [], "semanticMeaning": ""},
      "style": {"fill": "", "stroke": "", "opacity": 1, "fontSize": "", "fontWeight": "", "textColor": "", "alignment": ""},
      "interactionEditable": true,
      "pptxRenderType": "",
      "generationInstruction": "",
      "sourceReference": {"inheritedFromReferenceElementId": "", "inheritanceType": "style"}
    }
  ],
  "visualizationSpec": {"hasVisualization": false, "type": "", "title": "", "data": []},
  "imagePrompts": [],
  "prompts": {
    "singleSlideVisualPrompt": "",
    "elementBuildPrompt": "",
    "pptxRenderPrompt": "",
    "negativePrompt": ""
  },
  "pptxExportSpec": {
    "renderer": "pptxgenjs",
    "editableElements": true,
    "forbidFullSlideRasterization": true,
    "textAsTextBoxes": true,
    "cardsAsShapes": true,
    "speakerNotesIncluded": true,
    "exportWarnings": []
  },
  "qualityControl": {
    "readabilityScore": 0.8,
    "styleConsistencyScore": 0.8,
    "contentClarityScore": 0.8,
    "pptxEditabilityScore": 0.8,
    "riskFlags": [],
    "selfCheck": [
      {"item": "背景不替代整页", "result": "pass"},
      {"item": "所有文字可编辑", "result": "pass"},
      {"item": "字号适合投影", "result": "pass"}
    ]
  },
  "validationChecklist": [
    {"item": "页面比例 16:9", "passCondition": "元素坐标在0-1范围内", "importance": "high"},
    {"item": "关键文字可读", "passCondition": "正文≥16pt，标题≥28pt", "importance": "high"},
    {"item": "可导出PPTX", "passCondition": "元素有 pptxRenderType", "importance": "high"}
  ]
}

## 生成质量要求

1. 不要输出空 JSON
2. 不要只输出文字内容，必须输出布局、元素、坐标和样式
3. 不要只复述用户需求，必须把需求转成 PPT 页面结构
4. 不要把参考页内容原封不动复制到新 PPT
5. 不要添加虚假数据；如果需要数据但用户没有提供，使用 placeholder，在 riskFlags 标注
6. 不要生成过多文字。页面文字必须适合 PPT，而不是 Word
7. 不要出现参考页禁止的元素
8. 输出必须是合法 JSON，不能有注释，不能有尾逗号

## 特别提醒

- pageContent 是给人类看的页面总结
- elements 是给渲染引擎用的精确指令
- prompts.singleSlideVisualPrompt 是给图像生成模型用的完整视觉描述
- 每个元素的 boundingBox 必须精确（0-1 范围）
- 继承自参考页的元素在 sourceReference 中标注
- 所有文字必须用中文（除非是专有名词）`;

// ============================================================
// Helpers
// ============================================================

function cleanJsonResponse(text: string): string {
  let cleaned = text;
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) cleaned = codeBlockMatch[1].trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return cleaned.trim();
}

function buildGenerationContext(body: GenerateSlideRequest): string {
  const parts: string[] = [];

  // 1. Reference analysis (handle both v1 nested and v2 flat formats)
  if (body.referenceAnalysis) {
    const ref = body.referenceAnalysis as Record<string, unknown>;

    // v2 flat format: has slideType/layout/colorSystem/typography/semantic
    if (ref.slideType !== undefined && ref.layout) {
      const layout = (ref.layout as Record<string, unknown>) || {};
      const colorSys = (ref.colorSystem as Record<string, unknown>) || {};
      const typ = (ref.typography as Record<string, unknown>) || {};
      const sem = (ref.semantic as Record<string, unknown>) || {};
      const bg = (ref.background as Record<string, unknown>) || {};
      const compRules = (ref.compositionRules as Record<string, unknown>) || {};

      const getHex = (arr: unknown): string[] => {
        if (Array.isArray(arr)) {
          return arr.map((c) => typeof c === 'string' ? c : (c as Record<string, unknown>)?.hex as string || '').filter(Boolean);
        }
        return [];
      };

      parts.push(`## 参考页风格 DNA

### 页面类型: ${ref.slideType}
### 布局: ${layout.structure} | grid=${layout.grid} | alignment=${layout.alignment}

### 配色系统
primary=[${getHex(colorSys.primary).join(',')}]
secondary=[${getHex(colorSys.secondary).join(',')}]
accent=[${getHex(colorSys.accent).join(',')}]
background=[${getHex(colorSys.background).join(',')}]

### 渐变规则: ${colorSys.gradientRules || ''}

### 字体层级
标题: ${JSON.stringify(typ.title || {})}
副标题: ${JSON.stringify(typ.subtitle || {})}
正文: ${JSON.stringify(typ.body || {})}

### 背景: ${bg.type} | ${bg.style} | ${bg.lighting}

### 语义: tone=${JSON.stringify(sem.tone||[])} | narrative=${sem.narrative||''} | metaphor=${sem.metaphor||''}

### 必须遵循
${JSON.stringify(compRules.mustFollow || [])}

### 禁止项
${JSON.stringify(compRules.forbidden || [])}

### slideVisualPrompt（来自 Prompt 1）
${ref.slideVisualPrompt || ''}

### elementRebuildPrompt
${ref.elementRebuildPrompt || ''}`);
    } else {
      // v1 nested format: has styleAnalysis/pageIdentity/prompts/adaptationRules
      const style = (ref.styleAnalysis as Record<string, unknown>) || {};
      const palette = (style.colorPalette as Array<Record<string, unknown>>) || [];
      const pages = (ref.pageIdentity as Record<string, unknown>) || {};
      const prompts = (ref.prompts as Record<string, unknown>) || {};
      const rules = (ref.adaptationRules as Record<string, unknown>) || {};

      parts.push(`## 参考页风格 DNA

### 当前页信息
- 页面类型: ${pages.detectedPageType || '内容页'}
- 核心信息: ${pages.coreMessage || ''}

### 配色
${palette.map((c) => `- ${c.role}: ${c.hex} (${c.usage || ''})`).join('\n')}

### 排版
${JSON.stringify(style.typography)}

### 布局
${JSON.stringify(style.layoutSystem)}

### 形状语言
${JSON.stringify(style.shapeLanguage)}

### 装饰系统
${JSON.stringify(style.decorationSystem)}

### 必须保留
${JSON.stringify(rules.mustPreserve || [])}

### 必须禁止
${JSON.stringify(rules.mustAvoid || [])}

### 复刻 Prompt
${(prompts.universalStylePrompt as string || '').slice(0, 500)}`);
    }
  }

  // 2. Deck generation brief (handle both v1 and v2 formats)
  if (body.deckGenerationBrief) {
    // v2 format: has globalStylePrompt + styleControl + generationConstraints
    if (typeof (body.deckGenerationBrief as Record<string, unknown>).globalStylePrompt === 'string') {
      const briefV2 = body.deckGenerationBrief as Record<string, unknown>;
      const styleCtrl = (briefV2.styleControl || {}) as Record<string, unknown>;
      const genConstr = (briefV2.generationConstraints || {}) as Record<string, unknown>;

      parts.push(`## 全局生成指令（来自 Prompt 2 母 prompt）

### globalStylePrompt
${briefV2.globalStylePrompt as string}

### 样式控制
- 布局偏好: ${styleCtrl.layoutPreference || ''}
- 色彩偏好: ${styleCtrl.colorPreference || ''}
- 视觉风格: ${styleCtrl.visualStyle || ''}
- 密度: ${styleCtrl.density || ''}

### 必须遵循
${JSON.stringify(genConstr.mustFollow || [])}

### 灵活项
${JSON.stringify(genConstr.flexible || [])}

### 禁止项
${JSON.stringify(genConstr.forbidden || [])}`);
    } else {
      // v1 format: has generationBrief.userRequirements.stylePreference
      const genBrief = (body.deckGenerationBrief.generationBrief || body.deckGenerationBrief) as Record<string, unknown>;
      const requirements = (body.deckGenerationBrief as Record<string, unknown>).userRequirements as Record<string, unknown> || {};
      const stylePref = (requirements.stylePreference || {}) as Record<string, unknown>;
      const genRules = (genBrief.globalGenerationRules || {}) as Record<string, unknown>;

      parts.push(`## 生成指令

### 样式严格度: ${stylePref.styleStrictness || 'high'}
### 情绪偏好: ${JSON.stringify(stylePref.preferredMood || [])}
### 禁止情绪: ${JSON.stringify(stylePref.forbiddenMood || [])}

### 全局样式规则
${JSON.stringify(genRules.styleRules || [])}

### 全局布局规则
${JSON.stringify(genRules.layoutRules || [])}

### 全局禁止规则
${JSON.stringify(genRules.negativeRules || [])}`);
    }
  }

  // 3. Current slide plan
  if (body.slidePlan) {
    parts.push(`## 当前页规划

### 页码: ${body.slidePlan.slideIndex}
### 章节: ${body.slidePlan.section}
### 标题: ${body.slidePlan.title}
### 核心结论: ${body.slidePlan.coreMessage}
### 内容模块: ${JSON.stringify(body.slidePlan.contentBlocks)}
### 视觉策略: ${body.slidePlan.visualStrategy}
### 布局策略: ${body.slidePlan.layoutStrategy}
### 参考布局匹配: ${body.slidePlan.matchedReferencePattern}
### 口播意图: ${body.slidePlan.speakerNoteIntent}`);
  }

  // 4. Previous slides context
  if (body.previousGeneratedSlides?.length) {
    parts.push(`## 已生成的前面页面（保持一致性）

${body.previousGeneratedSlides.map((s, i) => {
  const meta = (s.slideMeta || {}) as Record<string, unknown>;
  return `- Slide ${i + 1}: ${meta.pageFunction} — "${(s.pageContent as Record<string,unknown>)?.pageTitle || ''}"`;
}).join('\n')}`);
  }

  return parts.join('\n\n');
}

// ============================================================
// POST Handler
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateSlideRequest;

    if (!body.slidePlan && !body.referenceAnalysis) {
      return fail('slidePlan or referenceAnalysis is required', 400);
    }

    if (isMockMode()) {
      return ok({
        slideMeta: {
          deckId: 'mock-deck',
          slideIndex: body.slidePlan?.slideIndex || body.slideIndex || 1,
          section: body.slidePlan?.section || '',
          pageFunction: 'content',
          generationMode: 'style_adapted',
          canvasRatio: '16:9',
          language: 'zh-CN',
        },
        pageContent: {
          pageTitle: body.slidePlan?.title || 'Mock Slide',
          coreMessage: body.slidePlan?.coreMessage || 'Mock content',
          speakerNotes: { mainScript: 'Mock speaker notes' },
        },
        elements: [],
        prompts: { singleSlideVisualPrompt: 'Mock visual prompt' },
      });
    }

    const context = buildGenerationContext(body);

    const messages: ChatMessage[] = [
      { role: 'system', content: GENERATE_SLIDE_PROMPT + '\n\n' + context },
      {
        role: 'user',
        content: `请生成第 ${body.slidePlan?.slideIndex || body.slideIndex} 页「${body.slidePlan?.title || '未命名'}」的完整 PPT JSON。

页面功能: ${body.slidePlan?.section || 'content'}
核心结论: ${body.slidePlan?.coreMessage || ''}
内容模块: ${JSON.stringify(body.slidePlan?.contentBlocks || [])}

请输出完整的 singleSlideGeneration JSON。`,
      },
    ];

    const result = await withRetry(async () => {
      const response = await deepseekWithFallback(messages, { reasoning: false, maxTokens: 16384 });
      return response.content;
    }, 2, 'generate-slide');

    const cleaned = cleanJsonResponse(result);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      throw new Error(`generate-slide JSON parse failed. Raw: ${result.slice(0, 300)}`);
    }

    return ok(parsed);
  } catch (error) {
    console.error('[GenerateSlide] error:', error);
    return fail(error instanceof Error ? error.message : '单页生成失败');
  }
}
