import { NextRequest } from 'next/server';
import { generateImage } from '@/lib/gpt-image';
import { ok, fail } from '@/lib/api-response';

export interface GenerateImageRequest {
  prompt: string;
  model?: 'gpt-image-2' | 'dall-e-3' | 'dall-e-2';
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  response_format?: 'url' | 'b64_json';
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateImageRequest;
    const { prompt, model = 'gpt-image-2', size = '1792x1024', response_format = 'url' } = body;

    if (!prompt || prompt.trim().length === 0) {
      return fail('Prompt is required', 400);
    }

    const result = await generateImage({
      prompt,
      model,
      size,
      response_format,
    });

    if (!result.success) {
      return fail(result.error || 'Image generation failed');
    }

    return ok({
      imageUrl: result.imageUrl,
      base64: result.base64,
    });
  } catch (error) {
    console.error('Generate image error:', error);
    return fail('Internal server error');
  }
}
