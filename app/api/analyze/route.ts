import { NextRequest } from 'next/server';
import { join } from 'path';
import { stat } from 'fs/promises';
import { analyzeStyle } from '@/lib/claude';
import { parsePPTX, extractAllImages, extractImageForAnalysis } from '@/lib/pptx-parser';
import { ok, fail } from '@/lib/api-response';

async function findFileWithId(uploadDir: string, fileId: string): Promise<string | null> {
  const extensions = ['', '.pptx', '.ppt', '.pdf'];

  for (const ext of extensions) {
    const filePath = join(uploadDir, `${fileId}${ext}`);
    try {
      await stat(filePath);
      return filePath;
    } catch {
      // Try next extension
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { fileId } = await request.json();

    if (!fileId) {
      return fail('缺少 fileId', 400);
    }

    const uploadDir = join(process.cwd(), 'uploads');
    const filePath = await findFileWithId(uploadDir, fileId);

    if (!filePath) {
      return fail('文件不存在', 404);
    }

    const analysis = await parsePPTX(filePath);
    const textContent = analysis.allText;

    let imageBase64: string | null = null;
    if (analysis.totalSlides > 0) {
      imageBase64 = await extractImageForAnalysis(filePath, 1);
    }

    if (!imageBase64) {
      const allImages = await extractAllImages(filePath);
      if (allImages.length > 0) {
        imageBase64 = allImages[0].base64;
      }
    }

    const styleConfig = await analyzeStyle(imageBase64, textContent, analysis);

    return ok({
      styleConfig,
      metadata: {
        totalSlides: analysis.totalSlides,
        imageCount: analysis.imageCount,
        ...analysis.metadata,
      },
    });
  } catch (error) {
    console.error('分析失败:', error);
    return fail(error instanceof Error ? error.message : '分析失败');
  }
}
