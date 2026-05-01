import { NextRequest } from 'next/server';
import { withRetry, visionCompletion } from '@/lib/api-client';
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

    const styleDNAResults: StyleDNAResult[] = await withRetry(async () => {
      const results: StyleDNAResult[] = [];

      for (const slide of slides) {
        console.log(`[StyleKit Extract] Processing slide ${slide.slideIndex}`);
        let result: Omit<StyleDNAResult, 'id' | 'slideIndex'>;

        if (slide.imageBase64) {
          result = await extractStyleDNAFromImage(slide.imageBase64);
        } else {
          console.log(`[StyleKit Extract] No image for slide ${slide.slideIndex}, using XML fallback`);
          result = extractStyleDNAFromXML(
            slide.slideXML || '',
            slide.colorScheme,
            slide.fontInfo,
            slide.textContent
          );
        }

        results.push({
          id: `${sourceFileId}-slide-${slide.slideIndex}`,
          slideIndex: slide.slideIndex,
          ...result,
        });
      }

      return results;
    }, 3, 'extractStyleDNA');

    return ok({
      sourceFileId,
      sourceFileName,
      totalSlides: slides.length,
      styleDNAResults,
    });
  } catch (error) {
    console.error('StyleKit extract error:', error);
    return fail(error instanceof Error ? error.message : 'Internal server error');
  }
}
