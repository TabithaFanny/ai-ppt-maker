/**
 * PPTX Parser - Extracts text and images from PowerPoint files
 *
 * PPTX files are ZIP archives containing:
 * - ppt/slides/slideN.xml - Individual slide content
 * - ppt/media/ - Images used in the presentation
 * - ppt/slides/_rels/slideN.xml.rels - Relationships for each slide
 */

import JSZip from 'jszip';
import { readFile } from 'fs/promises';
import { join } from 'path';

export interface SlideContent {
  slideIndex: number;
  slideId: string;
  title: string;
  textContent: string[];
  imageRefs: string[];
}

export interface PPTXAnalysis {
  totalSlides: number;
  slides: SlideContent[];
  allText: string;
  imageCount: number;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
  };
}

// XML helper to extract text content
function extractTextFromXML(xmlContent: string): string[] {
  const textMatches = xmlContent.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || [];
  return textMatches.map(match => {
    const content = match.replace(/<a:t[^>]*>/, '').replace(/<\/a:t>/, '');
    return content.trim();
  }).filter(text => text.length > 0);
}

// Extract image references from slide relationships
async function extractImageRefs(
  zip: JSZip,
  slideRelPath: string
): Promise<string[]> {
  try {
    const relContent = await zip.file(slideRelPath)?.async('string');
    if (!relContent) return [];

    const imageMatches = relContent.match(/Target="[^"]*"\s+Type="[^"]*\/image"/g) || [];
    return imageMatches.map(match => {
      const targetMatch = match.match(/Target="([^"]+)"/);
      return targetMatch ? targetMatch[1] : '';
    }).filter(ref => ref.includes('media/'));
  } catch {
    return [];
  }
}

// Extract slide title from slide XML
function extractSlideTitle(xmlContent: string): string {
  // Try to find title placeholder content
  const titleMatch = xmlContent.match(/<p:ph\s+type="title"[^>]*>[\s\S]*?<a:t[^>]*>([^<]+)<\/a:t>/);
  if (titleMatch) return titleMatch[1];

  // Fallback: first text element as title
  const firstText = extractTextFromXML(xmlContent);
  return firstText[0] || 'Untitled Slide';
}

// Parse PPTX file and extract content
export async function parsePPTX(filePath: string): Promise<PPTXAnalysis> {
  const fileBuffer = await readFile(filePath);
  const zip = await JSZip.loadAsync(fileBuffer);

  // Find all slide files
  const slideFiles = Object.keys(zip.files)
    .filter(path => path.match(/^ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0');
      const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0');
      return numA - numB;
    });

  // Count images
  const imageFiles = Object.keys(zip.files).filter(path => path.startsWith('ppt/media/'));
  const imageCount = imageFiles.length;

  // Extract content from each slide
  const slides: SlideContent[] = await Promise.all(
    slideFiles.map(async (slidePath, index) => {
      const slideContent = await zip.file(slidePath)?.async('string') || '';

      // Get slide relationships for image refs
      const slideName = slidePath.match(/slide(\d+)\.xml/)?.[1] || String(index + 1);
      const relPath = `ppt/slides/_rels/slide${slideName}.xml.rels`;
      const imageRefs = await extractImageRefs(zip, relPath);

      // Extract text content
      const textContent = extractTextFromXML(slideContent);
      const title = extractSlideTitle(slideContent);

      return {
        slideIndex: index + 1,
        slideId: `slide-${index + 1}`,
        title,
        textContent,
        imageRefs,
      };
    })
  );

  // Combine all text for AI analysis
  const allText = slides
    .map(s => `Slide ${s.slideIndex}: ${s.title}\n${s.textContent.join('\n')}`)
    .join('\n\n');

  // Try to extract metadata from app.xml
  let metadata = { title: '', author: '', subject: '' };
  try {
    const appContent = await zip.file('docProps/app.xml')?.async('string') || '';
    const titleMatch = appContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/);
    const authorMatch = appContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/);
    const subjectMatch = appContent.match(/<dc:subject[^>]*>([^<]+)<\/dc:subject>/);

    metadata = {
      title: titleMatch ? titleMatch[1] : '',
      author: authorMatch ? authorMatch[1] : '',
      subject: subjectMatch ? subjectMatch[1] : '',
    };
  } catch {
    // Metadata extraction failed, use defaults
  }

  return {
    totalSlides: slides.length,
    slides,
    allText,
    imageCount,
    metadata,
  };
}

// Extract images as base64 for AI vision analysis
export async function extractImageForAnalysis(
  filePath: string,
  slideIndex: number
): Promise<string | null> {
  const fileBuffer = await readFile(filePath);
  const zip = await JSZip.loadAsync(fileBuffer);

  // Find the slide
  const slidePath = `ppt/slides/slide${slideIndex}.xml`;
  const slideContent = await zip.file(slidePath)?.async('string');

  if (!slideContent) return null;

  // Get first image from this slide's relationships
  const relPath = `ppt/slides/_rels/slide${slideIndex}.xml.rels`;
  const relContent = await zip.file(relPath)?.async('string') || '';

  const imageMatch = relContent.match(/Target="([^"]*media\/[^"]+)"\s+Type="[^"]*\/image"/);
  if (!imageMatch) return null;

  const imagePath = imageMatch[1];
  const imageFile = zip.file(imagePath);

  if (!imageFile) return null;

  const imageBuffer = await imageFile.async('arraybuffer');
  const base64 = Buffer.from(imageBuffer).toString('base64');

  return base64;
}

// Get all images from a PPTX for asset extraction
export async function extractAllImages(
  filePath: string
): Promise<{ name: string; base64: string; path: string }[]> {
  const fileBuffer = await readFile(filePath);
  const zip = await JSZip.loadAsync(fileBuffer);

  const mediaFiles = Object.keys(zip.files).filter(
    path => path.startsWith('ppt/media/') && !path.endsWith('/')
  );

  const images = await Promise.all(
    mediaFiles.map(async (path) => {
      const file = zip.file(path);
      if (!file) return null;

      const buffer = await file.async('arraybuffer');
      const base64 = Buffer.from(buffer).toString('base64');
      const name = path.split('/').pop() || 'image';

      return { name, base64, path };
    })
  );

  return images.filter((img): img is { name: string; base64: string; path: string } => img !== null);
}

// Generate preview thumbnails for slides
export async function generateSlideThumbnails(
  filePath: string,
  maxSlides: number = 5
): Promise<{ slideIndex: number; base64: string }[]> {
  // Note: Full thumbnail generation would require a headless browser or canvas library
  // For now, we return empty thumbnails and let the frontend handle rendering
  const thumbnails: { slideIndex: number; base64: string }[] = [];

  for (let i = 1; i <= Math.min(maxSlides, 50); i++) {
    thumbnails.push({
      slideIndex: i,
      base64: '', // Frontend will show placeholder
    });
  }

  return thumbnails;
}
