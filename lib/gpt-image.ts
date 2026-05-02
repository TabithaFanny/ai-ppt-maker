/**
 * GPT-Image-2 API client
 * Primary: https://api.bltcy.ai/v1 (supports gpt-4o, dall-e-3, gpt-image-2)
 * Fallback: https://main-new.codesuc.top/v1 (gpt-image-2 only)
 */

export interface ImageGenerationOptions {
  prompt: string;
  model?: 'gpt-image-2' | 'dall-e-3' | 'dall-e-2';
  n?: number;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  response_format?: 'url' | 'b64_json';
  style?: 'vivid' | 'natural';
}

export interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  base64?: string;
  error?: string;
}

const API_BASE_PRIMARY = 'https://api.bltcy.ai/v1';
const API_BASE_FALLBACK = 'https://main-new.codesuc.top/v1';

const AI_MOCK = process.env.NEXT_PUBLIC_AI_MOCK === 'true' || process.env.AI_MOCK === 'true';

/**
 * Generate image using GPT-Image-2
 */
export async function generateImage(
  options: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  const {
    prompt,
    model = 'gpt-image-2',
    n = 1,
    size = '1024x1024',
    response_format = 'url',
  } = options;

  if (!prompt.trim()) {
    return { success: false, error: 'Prompt is required' };
  }

  // Mock 模式：返回占位图 URL
  if (AI_MOCK) {
    return {
      success: true,
      imageUrl: `https://placehold.co/${size.replace('x', 'x')}/1e40af/ffffff?text=AI+Mock+Image`,
    };
  }

  // 获取 API Key（优先 BLT relay key，其次 codesuc key）
  const apiKey = process.env.OPENAI_API_KEY || process.env.GPT_IMAGE_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'OPENAI_API_KEY not configured' };
  }

  // Primary: api.bltcy.ai
  const tryGenerate = async (baseUrl: string): Promise<ImageGenerationResult> => {
    try {
      const response = await fetch(`${baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt,
          n,
          size,
          response_format,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Image API] ${baseUrl} error:`, response.status, errorText);
        return { success: false, error: `API error: ${response.status}` };
      }

      const data = await response.json();

      if (data.data && data.data[0]) {
        const imageData = data.data[0];
        if (response_format === 'b64_json') {
          return { success: true, base64: imageData.b64_json };
        }
        return { success: true, imageUrl: imageData.url };
      }

      return { success: false, error: 'Unknown response format' };
    } catch (error) {
      console.error(`[Image API] ${baseUrl} error:`, error);
      return { success: false, error: 'Internal server error' };
    }
  };

  // 先试 BLT relay
  let result = await tryGenerate(API_BASE_PRIMARY);
  if (result.success) return result;

  // fallback 到 codesuc（仅 gpt-image-2）
  if (model === 'gpt-image-2' || !model) {
    result = await tryGenerate(API_BASE_FALLBACK);
  }

  return result;
}

/**
 * Generate image for a PPT slide based on content description
 */
export async function generateSlideImage(
  slideTitle: string,
  slideContent: string,
  styleConfig?: {
    primaryColor?: string;
    overallStyle?: string;
  }
): Promise<ImageGenerationResult> {
  // Build a descriptive prompt for the slide image
  const styleDescription = styleConfig?.overallStyle || 'business';
  const colorHint = styleConfig?.primaryColor
    ? `Color scheme: ${styleConfig.primaryColor}`
    : '';

  const prompt = `Professional ${styleDescription} presentation slide illustration. Topic: ${slideTitle}. ${colorHint}. Clean, modern, minimal design with abstract geometric shapes. No text overlay.`;

  return generateImage({
    prompt,
    size: '1792x1024',
  });
}

/**
 * Fetch image from URL and convert to base64
 */
export async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/png';

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('Failed to fetch image as base64:', error);
    return null;
  }
}

// Helper function
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));