import { NextRequest } from 'next/server';
import { join } from 'path';
import { stat } from 'fs/promises';
import JSZip from 'jszip';
import { parsePPTX } from '@/lib/pptx-parser';
import { ok, fail } from '@/lib/api-response';

type LayoutType = 'single' | 'double' | 'full' | 'centered';

function inferLayoutFromSlideXML(slideXML: string): LayoutType {
  const hasTitle = slideXML.includes('type="title"');
  const hasCenter = slideXML.includes('type="center"');

  const placeholderPattern = /<p:sp>[^]*?<p:ph[^>]*>[^]*?<\/p:sp>/g;
  const placeholderMatches = slideXML.match(placeholderPattern) || [];

  if (hasTitle) {
    if (placeholderMatches.length === 1) {
      return hasCenter ? 'centered' : 'full';
    }
    if (placeholderMatches.length === 2) {
      return 'single';
    }
    if (placeholderMatches.length >= 3) {
      return 'double';
    }
  }

  const contentPattern = /<p:sp>[^]*?<a:t[^]*?<\/p:sp>/g;
  const contentShapes = slideXML.match(contentPattern) || [];
  if (contentShapes.length === 0) {
    return 'full';
  } else if (contentShapes.length === 1) {
    return 'single';
  } else {
    return 'double';
  }
}

async function extractSlideImageRefs(zip: JSZip, slideIndex: number): Promise<string[]> {
  const relPath = `ppt/slides/_rels/slide${slideIndex}.xml.rels`;
  const relContent = await zip.file(relPath)?.async('string');

  if (!relContent) return [];

  const imagePattern = /Target="([^"]*media\/[^"]+)"\s+Type="[^"]*\/image"/g;
  const imageMatches = relContent.match(imagePattern) || [];
  return imageMatches.map(match => {
    const targetMatch = match.match(/Target="([^"]+)"/);
    return targetMatch ? targetMatch[1] : '';
  }).filter(ref => ref.includes('media/'));
}

async function extractImageAsDataURL(zip: JSZip, imagePath: string): Promise<string | null> {
  try {
    let normalizedPath = imagePath;
    if (imagePath.startsWith('../')) {
      normalizedPath = imagePath.replace(/^\.\.\//, 'ppt/');
    } else if (!imagePath.startsWith('ppt/')) {
      normalizedPath = `ppt/${imagePath}`;
    }

    const imageFile = zip.file(normalizedPath);
    if (!imageFile) return null;

    const buffer = await imageFile.async('arraybuffer');
    const base64 = Buffer.from(buffer).toString('base64');

    const ext = normalizedPath.split('.').pop()?.toLowerCase() || 'png';
    const mimeTypes: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
    };
    const mimeType = mimeTypes[ext] || 'image/png';

    return `data:${mimeType};base64,${base64}`;
  } catch {
    return null;
  }
}

async function findFileWithId(uploadDir: string, fileId: string): Promise<string | null> {
  const extensions = ['', '.pptx', '.ppt'];

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

    const fs = require('fs');
    const fileBuffer = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(fileBuffer);

    const slides = await Promise.all(
      analysis.slides.map(async (slide) => {
        const slidePath = `ppt/slides/slide${slide.slideIndex}.xml`;
        const slideXML = await zip.file(slidePath)?.async('string') || '';

        const layout: LayoutType = inferLayoutFromSlideXML(slideXML);

        const imageRefs = await extractSlideImageRefs(zip, slide.slideIndex);

        let imageBase64: string | null = null;
        if (imageRefs.length > 0) {
          imageBase64 = await extractImageAsDataURL(zip, imageRefs[0]);
        }

        const slideTextContent = extractTextContent(slideXML);
        const slideColorScheme = extractColorScheme(zip, slide.slideIndex);
        const slideFontInfo = extractFontInfo(slideXML);

        return {
          slideIndex: slide.slideIndex,
          imageBase64,
          layout,
          slideXML,
          textContent: slideTextContent,
          colorScheme: slideColorScheme,
          fontInfo: slideFontInfo,
        };
      })
    );

    return ok({ slides });
  } catch (error) {
    console.error('提取幻灯片图片失败:', error);
    return fail(error instanceof Error ? error.message : '提取幻灯片图片失败');
  }
}

function extractTextContent(slideXML: string): string {
  const textMatches = slideXML.match(/<a:t>([^<]*)<\/a:t>/g) || [];
  return textMatches
    .map((match) => match.replace(/<a:t>/, '').replace(/<\/a:t>/, ''))
    .filter((text) => text.trim().length > 0)
    .slice(0, 20)
    .join(' ');
}

function extractColorScheme(_zip: JSZip, _slideIndex: number): Record<string, string> {
  return {};
}

function extractFontInfo(slideXML: string): { titleFont?: string; bodyFont?: string } {
  const fontMatches = slideXML.match(/<a:latin typeface="([^"]+)"/g) || [];
  const fonts = [...new Set(fontMatches.map((m) => m.match(/<a:latin typeface="([^"]+)"/)?.[1]).filter(Boolean))];

  return {
    titleFont: fonts[0],
    bodyFont: fonts[1] || fonts[0],
  };
}
