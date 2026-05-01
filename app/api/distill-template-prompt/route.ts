import { NextRequest } from 'next/server';
import { chatCompletion, withRetry } from '@/lib/claude';
import { ok, fail } from '@/lib/api-response';

interface SlidePrompt {
  slideIndex: number;
  visualPrompt: string;
  styleTags: string[];
  colorPalette: string[];
}

interface Typography {
  titleFont: string;
  bodyFont: string;
  titleSize: number;
  bodySize: number;
}

interface DistillRequest {
  slidePrompts: SlidePrompt[];
  colorPalette?: string[];
  typography?: Typography;
}

interface DistillResponse {
  universalPrompt: string;
  overallStyle: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: DistillRequest = await request.json();
    const { slidePrompts, colorPalette, typography } = body;

    if (!slidePrompts || slidePrompts.length === 0) {
      return fail('slidePrompts is required and cannot be empty', 400);
    }

    const slidePromptsContext = slidePrompts
      .map(
        (slide) =>
          `Slide ${slide.slideIndex}:\n- Visual: ${slide.visualPrompt}\n- Tags: ${slide.styleTags.join(', ')}\n- Colors: ${slide.colorPalette.join(', ')}`
      )
      .join('\n\n');

    const colorContext = colorPalette
      ? `Global color palette: ${colorPalette.join(', ')}`
      : '';

    const typographyContext = typography
      ? `Global typography:\n- Title: ${typography.titleFont} ${typography.titleSize}pt\n- Body: ${typography.bodyFont} ${typography.bodySize}pt`
      : '';

    const prompt = `你是 PPT 风格提炼专家。从多个 Slide 的视觉描述中，提炼出一个通用的风格 Prompt。

**任务**：
1. 分析所有 Slide 的 visualPrompt，找出共同的风格特征
2. 识别反复出现的设计元素、氛围、构图方式
3. 综合 colorPalette 和 typography（如果有）作为全局约束
4. 生成一个 universalPrompt，能够指导生成符合该风格的新 Slide

**输入**：
${slidePromptsContext}

${colorContext ? `- ${colorContext}` : ''}
${typographyContext ? `- ${typographyContext}` : ''}

**输出要求**：
严格按照以下 JSON Schema 输出，不要添加任何注释或额外文字：
\`\`\`json
{
  "universalPrompt": "一个综合性的风格描述Prompt，用于指导生成统一风格的PPT Slide",
  "overallStyle": "business|tech|creative|academic 之一，根据共同特征判断"
}
\`\`\`

**风格判断标准**：
- business（商务）：简洁专业、结构清晰、数据驱动
- tech（科技）：现代感、技术感、创新元素
- creative（创意）：艺术感、独特视觉、打破常规
- academic（学术）：严谨规范、理论支撑、层次分明

直接输出有效的 JSON，不要添加注释或其他文字。`;

    const result = await withRetry(async () => {
      const response = await chatCompletion(prompt);
      const text = response.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(text) as DistillResponse;
    }, 3, 'distillTemplatePrompt');

    return ok(result);
  } catch (error) {
    console.error('Distill template prompt failed:', error);
    return fail(error instanceof Error ? error.message : 'Failed to distill template prompt');
  }
}
