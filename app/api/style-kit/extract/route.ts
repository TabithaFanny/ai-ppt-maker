import { NextRequest } from 'next/server';
import { withRetry, visionCompletion, isMockMode } from '@/lib/api-client';
import { mockStyleKitExtractResponse } from '@/lib/ai-mock-data';
import { ok, fail } from '@/lib/api-response';

interface SlideInput {
  slideIndex: number;
  imageBase64?: string | null;
  slideXML?: string;
  textContent?: string;
  colorScheme?: Record<string, string>;
  fontInfo?: { titleFont?: string; bodyFont?: string };
}

interface ExtractStyleDNARequest {
  slides: SlideInput[];
  sourceFileId: string;
  sourceFileName?: string;
}

interface StyleDNAResult {
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

// Fallback: Extract StyleDNA from slide XML when no image is available
function extractStyleDNAFromXML(
  slideXML: string,
  colorScheme?: Record<string, string>,
  fontInfo?: { titleFont?: string; bodyFont?: string },
  textContent?: string
): Omit<StyleDNAResult, 'id' | 'slideIndex'> {
  let layoutType = 'single';
  if (slideXML.includes('type="center"')) {
    layoutType = 'centered';
  } else if (slideXML.includes('type="left"') && slideXML.includes('type="right"')) {
    layoutType = 'two-column';
  } else if (slideXML.includes('type="title"') && !slideXML.includes('type="body"')) {
    layoutType = 'hero';
  }

  let mood: StyleDNAResult['mood'] = 'professional';
  let moodDescription = 'Professional business style';
  if (textContent) {
    const lowerText = textContent.toLowerCase();
    if (lowerText.includes('创意') || lowerText.includes('creative') || lowerText.includes('design')) {
      mood = 'creative';
      moodDescription = 'Creative and artistic style';
    } else if (lowerText.includes('学术') || lowerText.includes('academic') || lowerText.includes('research')) {
      mood = 'academic';
      moodDescription = 'Academic and formal style';
    } else if (lowerText.includes('轻松') || lowerText.includes('casual') || lowerText.includes('life')) {
      mood = 'casual';
      moodDescription = 'Casual and relaxed style';
    }
  }

  return {
    palette: {
      primary: colorScheme?.primary || '#1a73e8',
      secondary: colorScheme?.secondary || '#34a853',
      accent: colorScheme?.accent || '#fbbc04',
      background: colorScheme?.background || '#ffffff',
      text: colorScheme?.text || '#202124',
    },
    typography: {
      titleFont: fontInfo?.titleFont || 'Arial',
      bodyFont: fontInfo?.bodyFont || 'Helvetica',
      titleSize: 44,
      subtitleSize: 28,
      bodySize: 18,
      captionSize: 14,
    },
    spacing: {
      slidePadding: 40,
      contentMargin: 20,
      elementGap: 12,
    },
    effects: {
      shadowEnabled: false,
      shadowType: 'none',
      borderRadius: 4,
      gradientEnabled: false,
    },
    mood,
    moodDescription,
    layoutType,
    visualPrompt: textContent
      ? `Text-based slide with content: ${textContent.slice(0, 100)}...`
      : 'Text-based slide with clean layout',
    styleTags: ['text-only', 'minimal', layoutType],
  };
}

async function extractStyleDNAFromImage(imageBase64: string): Promise<Omit<StyleDNAResult, 'id' | 'slideIndex'>> {
  const prompt = `Analyze this PPT slide image and extract its complete visual style DNA. Provide extremely detailed and specific information for style reconstruction.

**Color Palette**: Identify ALL colors with exact HEX codes:
- Primary color (dominant brand/titles)
- Secondary color (supporting elements)
- Accent color (highlights, CTAs)
- Background color (slide background)
- Text color(s) (headings, body text)

**Typography System**:
- Title font family and approximate size (pt)
- Subtitle font family and size
- Body font family and size
- Caption/footnote font and size
- Font weights used (light, regular, medium, bold)

**Spacing & Layout**:
- Overall slide padding (approximate px)
- Content margin from edges
- Gap between elements
- Layout type: hero, two-column, grid, centered, full-bleed, quote, data-chart, comparison, timeline, gallery

**Visual Effects**:
- Shadow presence and type (soft/hard/none)
- Border radius on elements (0-20px range)
- Gradient usage (yes/no and type)
- Any decorative elements or patterns

**Mood & Atmosphere**:
- Professional level (1-10, 10 being most formal)
- Creative level (1-10)
- Overall mood classification: professional | creative | academic | casual
- Brief description of visual atmosphere

**Layout Details**:
- Describe exact zone positions (top, bottom, left, right, center)
- Image placement and size
- Text alignment and hierarchy

Respond ONLY in English with this exact JSON format - no additional text:

\`\`\`json
{
  "palette": {
    "primary": "#HEXCODE",
    "secondary": "#HEXCODE",
    "accent": "#HEXCODE",
    "background": "#HEXCODE",
    "text": "#HEXCODE"
  },
  "typography": {
    "titleFont": "FontName",
    "bodyFont": "FontName",
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
    "shadowType": "soft",
    "borderRadius": 8,
    "gradientEnabled": false
  },
  "mood": "professional",
  "moodDescription": "Clean corporate style with strong data visualization focus",
  "layoutType": "two-column",
  "visualPrompt": "A professional business slide with left-aligned title...",
  "styleTags": ["business", "minimal", "data-driven", "clean"]
}
\`\`\``;

  const content = await visionCompletion(prompt, imageBase64);
  const text = content.replace(/```json\n?|\n?```/g, '').trim();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Failed to parse API response: ${text.slice(0, 200)}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    // AI_MOCK=true: 直接返回 mock 风格分析结果
    if (isMockMode()) {
      return ok(mockStyleKitExtractResponse);
    }

    const body = (await request.json()) as ExtractStyleDNARequest;
    const { slides, sourceFileId, sourceFileName } = body;

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return fail('slides array is required and cannot be empty', 400);
    }

    if (!sourceFileId) {
      return fail('sourceFileId is required', 400);
    }

    for (const slide of slides) {
      if (typeof slide.slideIndex !== 'number') {
        return fail('Each slide must have slideIndex (number)', 400);
      }
    }

    // 抽样策略：>30页时只分析封面、中间抽样页、结尾
    let slidesToProcess = slides;
    const SLIDE_SAMPLE_THRESHOLD = 30;
    if (slides.length > SLIDE_SAMPLE_THRESHOLD) {
      const sampled: typeof slides = [];
      const total = slides.length;
      // 封面
      if (total > 0) sampled.push(slides[0]);
      // 中间抽样
      const step = Math.floor(total / 5);
      for (let i = step; i < total - 1; i += step) {
        if (slides[i] && !sampled.find(s => s.slideIndex === slides[i].slideIndex)) {
          sampled.push(slides[i]);
        }
      }
      // 结尾
      if (total > 1 && !sampled.find(s => s.slideIndex === slides[total - 1].slideIndex)) {
        sampled.push(slides[total - 1]);
      }
      slidesToProcess = sampled;
      console.log(`[StyleKit Extract] Sampled ${sampled.length}/${total} slides for analysis`);
    }

    const MAX_TIMEOUT_MS = 60_000;

    const styleDNAResults: StyleDNAResult[] = [];
    let hadFailures = false;

    for (const slide of slidesToProcess) {
      console.log(`[StyleKit Extract] Processing slide ${slide.slideIndex}`);
      try {
        let result: Omit<StyleDNAResult, 'id' | 'slideIndex'>;

        if (slide.imageBase64) {
          // Timeout per slide
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Per-slide timeout')), MAX_TIMEOUT_MS)
          );
          const extractPromise = extractStyleDNAFromImage(slide.imageBase64);
          result = await Promise.race([extractPromise, timeoutPromise]);
        } else {
          console.log(`[StyleKit Extract] No image for slide ${slide.slideIndex}, using XML fallback`);
          result = extractStyleDNAFromXML(
            slide.slideXML || '',
            slide.colorScheme,
            slide.fontInfo,
            slide.textContent
          );
        }

        styleDNAResults.push({
          id: `${sourceFileId}-slide-${slide.slideIndex}`,
          slideIndex: slide.slideIndex,
          ...result,
        });
      } catch (err) {
        hadFailures = true;
        console.warn(`[StyleKit Extract] Slide ${slide.slideIndex} failed, skipping:`, err);
        // 跳过失败页，继续处理下一页
      }
    }

    if (styleDNAResults.length === 0) {
      return fail('All slides failed to extract style DNA', 500);
    }

    return ok({
      sourceFileId,
      sourceFileName,
      totalSlides: slides.length,
      processedSlides: styleDNAResults.length,
      styleDNAResults,
      hadFailures,
      wasSampled: slides.length > SLIDE_SAMPLE_THRESHOLD,
    });
  } catch (error) {
    console.error('StyleKit extract error:', error);
    return fail(error instanceof Error ? error.message : 'Internal server error');
  }
}
