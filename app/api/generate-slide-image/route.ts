import { NextRequest } from 'next/server';
import { generateSlideImage } from '@/lib/gpt-image';
import { Slide, StyleConfig, StyleKit } from '@/types';
import { resolveStyleConfig } from '@/lib/style-bridge';
import { ok, fail } from '@/lib/api-response';

export interface GenerateSlideImageRequest {
  slide: Slide;
  styleConfig?: StyleConfig;
  styleKit?: StyleKit;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateSlideImageRequest;
    const { slide, styleConfig, styleKit } = body;
    const resolvedStyleConfig = resolveStyleConfig({ styleConfig, styleKit });

    if (!slide || !slide.title) {
      return fail('Slide title is required', 400);
    }

    const contentSummary = slide.content
      .filter((block) => block.type === 'text' || block.type === 'list')
      .map((block) => block.content)
      .join(' ')
      .slice(0, 200);

    const result = await generateSlideImage(
      slide.title,
      contentSummary,
      {
        primaryColor: resolvedStyleConfig?.palette?.primary,
        overallStyle: resolvedStyleConfig?.overallStyle,
      }
    );

    if (!result.success) {
      return fail(result.error || 'Image generation failed');
    }

    return ok({
      imageUrl: result.imageUrl,
      base64: result.base64,
    });
  } catch (error) {
    console.error('Generate slide image error:', error);
    return fail('Internal server error');
  }
}
