import { NextRequest } from 'next/server';
import { withRetry, visionCompletion } from '@/lib/api-client';
import { ok, fail } from '@/lib/api-response';

interface SlideInput {
  slideIndex: number;
  imageBase64: string;
}

interface ReverseVisualPromptRequest {
  slides: SlideInput[];
}

interface SlidePrompt {
  slideIndex: number;
  visualPrompt: string;
  styleTags: string[];
  colorPalette: string[];
}

async function reverseImageToPrompt(imageBase64: string): Promise<{ visualPrompt: string; styleTags: string[]; colorPalette: string[] }> {
  const prompt = `Describe this PPT slide image in detail for visual style reconstruction. Focus on:

1. **Color Scheme**: Identify the main colors (primary, secondary, accent, background, text colors) - provide HEX codes
2. **Layout Structure**: Describe the arrangement of elements (header, body, footer, sidebar positions)
3. **Typography Hierarchy**: Note title, subtitle, body text sizes and weights
4. **Visual Elements**: Icons, images, charts, decorative elements, geometric shapes
5. **Overall Atmosphere**: Professional business, creative, tech, minimal, luxury, etc.

Respond ONLY in English with this exact JSON format - no additional text:

\`\`\`json
{
  "visualPrompt": "A professional business slide with a clean left-aligned header...",
  "styleTags": ["business", "minimal", "clean"],
  "colorPalette": ["#1a73e8", "#ffffff", "#202124", "#34a853", "#fbbc04"]
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
    const body = (await request.json()) as ReverseVisualPromptRequest;
    const { slides } = body;

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return fail('slides array is required and cannot be empty', 400);
    }

    for (const slide of slides) {
      if (typeof slide.slideIndex !== 'number' || !slide.imageBase64) {
        return fail('Each slide must have slideIndex (number) and imageBase64 (string)', 400);
      }
    }

    const slidePrompts: SlidePrompt[] = await withRetry(async () => {
      const results: SlidePrompt[] = [];

      for (const slide of slides) {
        console.log(`[ReverseVisualPrompt] Processing slide ${slide.slideIndex}`);
        const result = await reverseImageToPrompt(slide.imageBase64);
        results.push({
          slideIndex: slide.slideIndex,
          visualPrompt: result.visualPrompt,
          styleTags: result.styleTags,
          colorPalette: result.colorPalette,
        });
      }

      return results;
    }, 3, 'reverseImageToPrompt');

    return ok({ slidePrompts });
  } catch (error) {
    console.error('Reverse visual prompt error:', error);
    return fail(error instanceof Error ? error.message : 'Internal server error');
  }
}
