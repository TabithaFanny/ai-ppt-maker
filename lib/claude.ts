import { StyleConfig, StyleKit, UserInput, DeckPlan } from '@/types';
import type { PPTXAnalysis } from './pptx-parser';
import { resolveStyleConfig } from './style-bridge';
import { withRetry, chatCompletion } from './api-client';
import { StyleConfigSchema, PPTJsonSchema, DeckPlanSchema, validateAIOutput } from './schemas';

export { withRetry, chatCompletion } from './api-client';

export const analyzeStyle = async (
  imageBase64: string | null,
  textContent?: string,
  pptxAnalysis?: PPTXAnalysis
) => {
  let textAnalysisContext = '';
  if (textContent || pptxAnalysis) {
    const slideCount = pptxAnalysis?.totalSlides || 0;
    const imageCount = pptxAnalysis?.imageCount || 0;
    const preview = textContent?.slice(0, 2000) || '';

    textAnalysisContext = `

**PPT 内容分析**：
- 总页数：${slideCount}
- 图片数量：${imageCount}
- 内容预览：${preview}${textContent && textContent.length > 2000 ? '...' : ''}
`;
  }

  const prompt = `分析此 PPT 模板的设计 DNA，提取以下维度：

1. **整体风格**：business（商务）/tech（科技）/creative（创意）/academic（学术）
2. **色彩方案**：主色、辅色、强调色、背景色、文字色（必须为 HEX 格式）
3. **字体系统**：标题/正文字体名称及大小（pt）
4. **布局模式**：single（单栏）/double（双栏）/full（全屏）/centered（居中），间距和内边距（px）
5. **设计原则**：如"一页一结论"、"视觉层级清晰"、"留白充足"等
${textAnalysisContext}

**输出要求**：
- 严格按照以下 JSON Schema 输出
- 不要添加任何注释或额外文字
- 颜色必须为 6 位 HEX 格式（如 #1a73e8）

\`\`\`json
{
  "overallStyle": "business",
  "palette": {
    "primary": "#1a73e8",
    "secondary": "#34a853",
    "accent": "#fbbc04",
    "background": "#ffffff",
    "text": "#202124"
  },
  "typography": {
    "titleFont": "Arial",
    "bodyFont": "Helvetica",
    "titleSize": 44,
    "bodySize": 18
  },
  "layout": {
    "type": "single",
    "spacing": 20,
    "padding": 40
  },
  "designPrinciples": ["一页一结论", "视觉层级清晰", "留白充足"]
}
\`\`\``;

  return withRetry(async () => {
    const response = await chatCompletion(prompt);
    const text = response.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(text);
    const validation = validateAIOutput(StyleConfigSchema, parsed, 'analyzeStyle');
    if (!validation.success) {
      throw new Error(validation.error);
    }
    return validation.data;
  }, 3, 'analyzeStyle');
};

export const translateRequirements = async (
  styleInput: StyleConfig | StyleKit,
  userInput: UserInput
) => {
  const styleConfig =
    'styleDNA' in styleInput ? resolveStyleConfig({ styleKit: styleInput }) : styleInput;
  if (!styleConfig) {
    throw new Error('Style configuration is required');
  }

  const prompt = `你是 PPT 内容策划专家。基于以下信息生成 PPT 结构：

**模板风格**：
${JSON.stringify(styleConfig, null, 2)}

**用户需求**：
- 主题：${userInput.topic}
- 关键要点：${userInput.keyPoints?.join('、') || '无'}
- 页数要求：${userInput.pageCount || '自动'}
- 特殊要求：${userInput.specialRequirements || '无'}

**任务要求**：
1. 内容必须 100% 基于用户需求，不要添加无关内容
2. 继承模板的视觉风格（色彩、字体、布局），但根据新主题调整
3. 每页遵循"一页一结论"原则
4. 结构清晰：标题页 → 目录 → 内容页 → 总结页

**输出格式**（自然语言描述）：
第1页：标题页 - [主题]
第2页：目录 - 列出 [N] 个关键要点
第3页：[要点1] - [详细内容描述]
...
第N页：总结 - [核心结论]

直接输出描述，不要添加额外说明。`;

  return withRetry(async () => {
    const response = await chatCompletion(prompt);
    return response;
  }, 3, 'translateRequirements');
};

export const generatePPTJson = async (description: string, styleConfig: StyleConfig) => {
  const resolvedStyleConfig = resolveStyleConfig({ styleConfig });
  if (!resolvedStyleConfig) {
    throw new Error('Style configuration is required');
  }

  const prompt = `你是 JSON 数据工程师。将 PPT 描述转化为结构化 JSON。

**输入描述**：
${description}

**风格配置**：
${JSON.stringify(resolvedStyleConfig, null, 2)}

**JSON Schema**（严格遵守）：
\`\`\`json
{
  "metadata": {
    "projectId": "string (UUID)",
    "title": "string",
    "category": "string",
    "audience": "string",
    "createdAt": "ISO 8601 date string"
  },
  "designSystem": {
    "palette": { "primary": "#hex", "secondary": "#hex", "accent": "#hex", "background": "#hex", "text": "#hex" },
    "typography": { "titleFont": "string", "bodyFont": "string", "titleSize": number, "bodySize": number }
  },
  "roles": {
    "designer": "string",
    "contentStrategist": "string",
    "visualDirector": "string"
  },
  "slides": [
    {
      "id": "string (UUID)",
      "layout": "title|content|image|chart|quote",
      "title": "string",
      "mainConclusion": "string (一句话核心结论)",
      "content": [
        {
          "id": "string (UUID)",
          "type": "text|image|chart|list",
          "content": "string",
          "position": { "x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1 },
          "style": { "fontSize": number, "fontWeight": "normal|bold", "color": "#hex", "align": "left|center|right" }
        }
      ]
    }
  ]
}
\`\`\`

**验证规则**：
- 所有 ID 必须为 UUID 格式
- position 的 x/y/width/height 必须在 0-1 之间
- 颜色必须为 6 位 HEX 格式
- 每页必须有 mainConclusion
- layout 和 type 必须为枚举值之一

直接输出有效的 JSON，不要添加注释或其他文字。`;

  return withRetry(async () => {
    const response = await chatCompletion(prompt);
    const text = response.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(text);
    const validation = validateAIOutput(PPTJsonSchema, parsed, 'generatePPTJson');
    if (!validation.success) {
      throw new Error(validation.error);
    }
    return validation.data;
  }, 3, 'generatePPTJson');
};

/**
 * Phase 1: 生成 DeckPlan — AI 先规划「讲什么」，再解析为具体页面
 */
export const generateDeckPlan = async (
  userInput: UserInput,
  styleKit: StyleKit
): Promise<DeckPlan> => {
  const slideRoles = styleKit.slideRoleDefinitions
    .map(d => `- ${d.role}: ${d.generationHints.join('，')}`)
    .join('\n');

  const layoutPatterns = styleKit.layoutPatterns
    .map(lp => `- ${lp.layoutType}: ${lp.bestFor.join('，')}`)
    .join('\n');

  const prompt = `你是 PPT 内容规划专家。根据用户需求和模板风格，规划一个完整的 PPT 大纲。

**用户需求**：
- 主题：${userInput.topic}
- 描述：${userInput.description || '无'}
- 关键要点：${userInput.keyPoints?.join('、') || '无'}
- 页数：${userInput.pageCount || '自动'}
- 场景：${userInput.scenario || '通用'}
- 受众：${userInput.audience || '通用'}
- 特殊要求：${userInput.specialRequirements || '无'}

**模板风格**：
- 情绪：${styleKit.styleDNA.mood} — ${styleKit.styleDNA.moodDescription}
- 配色：主色 ${styleKit.styleDNA.palette.primary}

**可用页面角色**：
${slideRoles}

**可用布局模式**：
${layoutPatterns || '- hero, two-column, grid, centered (默认)'}

**规划要求**：
1. 第一页必须是 cover（封面），最后一页必须是 closing（结束页）
2. 根据场景和页数合理分配角色（如 pitch 场景需要 cover → toc → content → summary → closing）
3. 每页的 mainConclusion 必须是一句话核心结论
4. contentOutline 描述每页需要什么类型的元素
5. 总页数不超过 ${userInput.pageCount || 15} 页

**JSON Schema**（严格遵守）：
\`\`\`json
{
  "id": "UUID",
  "projectId": "UUID",
  "title": "PPT 标题",
  "scenario": "${userInput.scenario || 'report'}",
  "audience": "${userInput.audience || 'general'}",
  "slidePlans": [
    {
      "id": "UUID",
      "index": 0,
      "role": "cover",
      "title": "页面标题",
      "mainConclusion": "一句话核心结论",
      "contentOutline": [
        { "type": "heading", "description": "大标题", "required": true },
        { "type": "paragraph", "description": "副标题", "required": false }
      ],
      "layoutHint": "hero"
    }
  ],
  "metadata": {
    "totalPages": 8,
    "generatedAt": 1234567890
  }
}
\`\`\`

直接输出有效的 JSON，不要添加注释或其他文字。`;

  return withRetry(async () => {
    const response = await chatCompletion(prompt);
    const text = response.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(text);
    const validation = validateAIOutput(DeckPlanSchema, parsed, 'generateDeckPlan');
    if (!validation.success) {
      throw new Error(validation.error);
    }
    return validation.data;
  }, 3, 'generateDeckPlan');
};
