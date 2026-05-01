import { NextRequest } from 'next/server';
import { chatCompletion, withRetry } from '@/lib/claude';
import { validateAIOutput, DistillStyleKitResponseSchema } from '@/lib/schemas';
import { StyleDNA, LayoutPattern, SlideRole, DEFAULT_SLIDE_ROLE_DEFINITIONS, LayoutType } from '@/types';
import { ok, fail } from '@/lib/api-response';

interface SlideStyleDNA {
  id: string;
  slideIndex: number;
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
  layoutType: string;
  visualPrompt: string;
  styleTags: string[];
}

interface DistillStyleKitRequest {
  styleDNAResults: SlideStyleDNA[];
  sourceFileId: string;
  sourceFileName?: string;
  styleKitName?: string;
}

interface LayoutPatternResult {
  layoutType: LayoutType;
  frequency: number;
  bestFor: string[];
  layoutPrompt: string;
  applicableSlides: number[];
}

interface DistillResponse {
  name: string;
  mood: 'professional' | 'creative' | 'academic' | 'casual';
  moodDescription: string;

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

  layoutPatterns: LayoutPatternResult[];

  slideRoleDistribution: Record<SlideRole, number>;

  styleTags: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: DistillStyleKitRequest = await request.json();
    const { styleDNAResults, sourceFileId, sourceFileName, styleKitName } = body;

    if (!styleDNAResults || styleDNAResults.length === 0) {
      return fail('styleDNAResults is required and cannot be empty', 400);
    }

    if (!sourceFileId) {
      return fail('sourceFileId is required', 400);
    }

    const styleDNAContext = styleDNAResults
      .map((dna) =>
        `Slide ${dna.slideIndex}:
- Palette: primary=${dna.palette.primary}, secondary=${dna.palette.secondary}, accent=${dna.palette.accent}, bg=${dna.palette.background}, text=${dna.palette.text}
- Typography: title=${dna.typography.titleFont} ${dna.typography.titleSize}pt, body=${dna.typography.bodyFont} ${dna.typography.bodySize}pt
- Spacing: padding=${dna.spacing.slidePadding}px, margin=${dna.spacing.contentMargin}px, gap=${dna.spacing.elementGap}px
- Effects: shadow=${dna.effects.shadowEnabled ? dna.effects.shadowType : 'none'}, radius=${dna.effects.borderRadius}px, gradient=${dna.effects.gradientEnabled}
- Layout: ${dna.layoutType}
- Mood: ${dna.mood} - ${dna.moodDescription}
- Tags: ${dna.styleTags.join(', ')}
- Visual: ${dna.visualPrompt}`
      )
      .join('\n\n');

    const prompt = `你是 PPT 风格提炼专家。从多个 Slide 的 StyleDNA 分析结果中，提炼出一个完整的 StyleKit。

**任务**：
1. 分析所有 Slide 的 StyleDNA，找出共同的风格特征
2. 确定主导配色方案（最常见的颜色组合）
3. 确定字体系统（标题和正文的代表字体和尺寸）
4. 确定间距系统（取中位数或最常见值）
5. 确定视觉效果（阴影、圆角、渐变的主流设置）
6. 识别布局模式（哪些布局类型反复出现）
7. 判断整体风格倾向和专业程度

**输入** (${styleDNAResults.length} slides):
${styleDNAContext}

**输出要求**：
严格按照以下 JSON Schema 输出，不要添加任何注释或额外文字：
\`\`\`json
{
  "name": "风格包名称，如：商务蓝白简洁风格",
  "mood": "professional|creative|academic|casual 之一",
  "moodDescription": "一句话描述风格特点",
  "palette": {
    "primary": "#HEXCODE - 主导品牌色/标题色",
    "secondary": "#HEXCODE - 辅助色",
    "accent": "#HEXCODE - 强调色",
    "background": "#HEXCODE - 背景色",
    "text": "#HEXCODE - 正文色"
  },
  "typography": {
    "titleFont": "标题字体名称",
    "bodyFont": "正文字体名称",
    "titleSize": 44,
    "subtitleSize": 28,
    "bodySize": 18,
    "captionSize": 14
  },
  "spacing": {
    "slidePadding": 40,
    "contentMargin": 20,
    "elementGap": 12
  },
  "effects": {
    "shadowEnabled": true,
    "shadowType": "soft|hard|none",
    "borderRadius": 8,
    "gradientEnabled": false
  },
  "layoutPatterns": [
    {
      "layoutType": "hero|two-column|grid|centered|full-bleed|quote|data-chart|comparison|timeline|gallery",
      "frequency": 5,
      "bestFor": ["章节开头", "内容展示"],
      "layoutPrompt": "描述这种布局的典型结构，用于AI生成时参考",
      "applicableSlides": [1, 2, 5]
    }
  ],
  "slideRoleDistribution": {
    "cover": 1,
    "toc": 1,
    "section-header": 2,
    "content": 10,
    "image-focus": 2,
    "data-display": 3,
    "quote": 1,
    "comparison": 1,
    "summary": 1,
    "closing": 1
  },
  "styleTags": ["business", "minimal", "data-driven", "clean"]
}
\`\`\`

直接输出有效的 JSON，不要添加注释或其他文字。`;

    const result = await withRetry(async () => {
      const response = await chatCompletion(prompt);
      const text = response.replace(/```json\n?|\n?```/g, '').trim();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('AI 返回的内容不是有效 JSON');
      }
      const validation = validateAIOutput(DistillStyleKitResponseSchema, parsed, 'DistillStyleKit');
      if (!validation.success) {
        throw new Error(`AI 输出不符合 schema: ${validation.error}`);
      }
      return validation.data;
    }, 3, 'distillStyleKit');

    const styleKit = {
      id: `stylekit-${sourceFileId}-${Date.now()}`,
      name: styleKitName || result.name,
      sourceFileId,
      styleDNA: {
        id: `styledna-${sourceFileId}-${Date.now()}`,
        name: result.name,
        sourceFileId,
        palette: result.palette,
        typography: result.typography,
        spacing: result.spacing,
        effects: result.effects,
        mood: result.mood,
        moodDescription: result.moodDescription,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as StyleDNA,
      layoutPatterns: result.layoutPatterns.map((lp, idx) => ({
        id: `layout-${sourceFileId}-${idx}`,
        styleKitId: `stylekit-${sourceFileId}-${Date.now()}`,
        layoutType: lp.layoutType as LayoutType,
        structure: {
          zones: [],
          gridDefinition: undefined,
        },
        applicableSlides: (['content'] as SlideRole[]),
        bestFor: lp.bestFor,
        thumbnailBase64: undefined,
        layoutPrompt: lp.layoutPrompt,
      })) as LayoutPattern[],
      slideRoleDefinitions: [...DEFAULT_SLIDE_ROLE_DEFINITIONS],
      contentRules: [],
      scenarioAdapters: [],
      stats: {
        usageCount: 0,
        feedbackCount: 0,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return ok({
      styleKit,
      sourceFileName,
      analysisSummary: {
        totalSlides: styleDNAResults.length,
        mood: result.mood,
        styleTags: result.styleTags,
        layoutPatternsFound: result.layoutPatterns.length,
      },
    });
  } catch (error) {
    console.error('Distill StyleKit error:', error);
    return fail(error instanceof Error ? error.message : 'Failed to distill StyleKit');
  }
}
