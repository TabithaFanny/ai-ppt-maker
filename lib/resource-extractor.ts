import { join } from 'path';
import { readFile } from 'fs/promises';
import { StyleConfig } from '@/types';

// Asset types following PPT-Visual-Replica methodology
export type AssetType = 'icon' | 'background' | 'decoration' | 'chart' | 'device';

export interface ExtractedAsset {
  id: string;
  type: AssetType;
  category: string;
  imageData: string; // base64 or blob URL
  thumbnail: string;
  tags: string[];
  usageCount: number;
  sourceSlide: number;
  sourceFileId: string;
  extractedAt: number;
}

export interface ExtractionResult {
  fileId: string;
  assets: ExtractedAsset[];
  totalSlides: number;
  extractedAt: number;
}

// Classify asset type based on tags
function classifyAsset(tags: string[]): AssetType {
  const tagStr = tags.join(' ').toLowerCase();

  if (tagStr.includes('icon') || tagStr.includes('图标')) return 'icon';
  if (tagStr.includes('background') || tagStr.includes('背景')) return 'background';
  if (tagStr.includes('decoration') || tagStr.includes('装饰')) return 'decoration';
  if (tagStr.includes('chart') || tagStr.includes('图表')) return 'chart';
  if (tagStr.includes('device') || tagStr.includes('设备')) return 'device';

  return 'decoration';
}

// Analyze image and extract semantic tags using AI
async function analyzeImage(imageBase64: string, slideNumber: number): Promise<{
  type: AssetType;
  category: string;
  tags: string[];
}> {
  // Dynamic import to avoid issues when not needed
  const Anthropic = (await import('@anthropic-ai/sdk')).default;

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  });

  const prompt = `分析这张图片，提取以下信息：

1. **类型**：icon（图标）/background（背景）/decoration（装饰）/chart（图表）/device（设备）
2. **类别**：具体是什么，如 "箭头", "数据图表", "渐变背景", "手机Mockup" 等
3. **标签**：3-5个英文标签，用逗号分隔

**输出格式**（JSON）：
{
  "type": "icon|background|decoration|chart|device",
  "category": "具体类别名称",
  "tags": ["tag1", "tag2", "tag3"]
}

只输出JSON，不要其他文字。`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: imageBase64,
              },
            },
          ],
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response format');
    }

    const result = JSON.parse(content.text.replace(/```json\n?|\n?```/g, '').trim());
    return {
      type: result.type as AssetType,
      category: result.category || 'uncategorized',
      tags: result.tags || [],
    };
  } catch (error) {
    console.error('Image analysis failed:', error);
    return {
      type: 'decoration',
      category: '未分类',
      tags: ['decoration'],
    };
  }
}

// Main extraction function
export async function extractAssetsFromTemplate(
  fileId: string,
  _styleConfig?: StyleConfig
): Promise<ExtractionResult> {
  const uploadDir = join(process.cwd(), 'uploads');
  const filePath = join(uploadDir, fileId);

  let fileBuffer: ArrayBuffer;
  try {
    const files = await readFile(filePath);
    fileBuffer = files.buffer;
  } catch {
    throw new Error(`File not found: ${fileId}`);
  }

  // For now, we'll create a placeholder since actual PPT extraction requires
  // specialized libraries like pptxgenjs or officegen
  // In production, you would use a library to:
  // 1. Unzip PPTX file (it's a ZIP archive)
  // 2. Extract images from ppt/media/ folder
  // 3. Analyze each image for semantic tagging

  const placeholderAssets: ExtractedAsset[] = [];

  return {
    fileId,
    assets: placeholderAssets,
    totalSlides: 0,
    extractedAt: Date.now(),
  };
}

// Generate thumbnail (reduced size image)
export function generateThumbnail(imageData: string, maxWidth = 100): string {
  // For base64 images, this would typically involve canvas manipulation
  // For now, return the original as-is (browser will handle scaling)
  return imageData;
}

// Update asset usage statistics
export function trackAssetUsage(assetId: string): void {
  // This would update IndexedDB with usage count
  // Analytics tracking for asset effectiveness
}

// Get asset recommendations based on style
export function getAssetRecommendations(
  assets: ExtractedAsset[],
  styleConfig: StyleConfig
): ExtractedAsset[] {
  const styleColors = [
    styleConfig.palette.primary,
    styleConfig.palette.secondary,
    styleConfig.palette.accent,
  ];

  return assets
    .filter(asset => {
      // Filter assets that match the style's color palette
      // This is a simplified heuristic
      return true;
    })
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, 20);
}