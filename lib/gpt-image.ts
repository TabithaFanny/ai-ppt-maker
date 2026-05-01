/**
 * GPT-Image-2 API client
 * Endpoint: https://main-new.codesuc.top/v1/images/generations
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

const API_BASE = 'https://main-new.codesuc.top/v1';

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

  const apiKey = process.env.OPENAI_API_KEY || process.env.GPT_IMAGE_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'OPENAI_API_KEY not configured' };
  }

  try {
    const response = await fetch(`${API_BASE}/images/generations`, {
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
      console.error('Images API error:', response.status, errorText);
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();

    // Handle response
    if (data.data && data.data[0]) {
      const imageData = data.data[0];
      if (response_format === 'b64_json') {
        return { success: true, base64: imageData.b64_json };
      }
      return { success: true, imageUrl: imageData.url };
    }

    return { success: false, error: 'Unknown response format' };
  } catch (error) {
    console.error('Image generation error:', error);
    return { success: false, error: 'Internal server error' };
  }
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