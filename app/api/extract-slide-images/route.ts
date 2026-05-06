import { NextRequest } from 'next/server';
import { join } from 'path';
import { stat, mkdtemp, rm, readdir } from 'fs/promises';
import { readFileSync } from 'fs';
import { execFile, exec } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import JSZip from 'jszip';
import { parsePPTX } from '@/lib/pptx-parser';
import { ok, fail } from '@/lib/api-response';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);
const DEFAULT_SOFFICE_PATH = '/Applications/LibreOffice.app/Contents/MacOS/soffice';
const DEFAULT_PDFTOPPM_PATH = '/opt/homebrew/bin/pdftoppm';
const SOFFICE_PATH = process.env.LIBREOFFICE_PATH || DEFAULT_SOFFICE_PATH;
const PDFTOPPM_PATH = process.env.PDFTOPPM_PATH || DEFAULT_PDFTOPPM_PATH;

let dependencyCheckLogged = false;

async function ensureExecutable(path: string, label: string, envName: string, defaultPath: string): Promise<void> {
  try {
    await stat(path);
    if (!dependencyCheckLogged && path === defaultPath && !process.env[envName]) {
      console.warn(`[ExtractSlides] ${envName} not set; using macOS default ${path}`);
    }
  } catch {
    throw new Error(`${label} 未找到：${path}。请安装依赖或设置环境变量 ${envName}。`);
  }
}

async function ensureRenderDependencies(options: { requireLibreOffice: boolean }): Promise<void> {
  if (options.requireLibreOffice) {
    await ensureExecutable(SOFFICE_PATH, 'LibreOffice', 'LIBREOFFICE_PATH', DEFAULT_SOFFICE_PATH);
  }
  await ensureExecutable(PDFTOPPM_PATH, 'pdftoppm', 'PDFTOPPM_PATH', DEFAULT_PDFTOPPM_PATH);
  dependencyCheckLogged = true;
}

/** Render PPTX slides to PNG images using LibreOffice (PPTX→PDF) + pdftoppm (PDF→PNG) */
async function renderSlidesWithLibreOffice(
  filePath: string,
  slideCount: number
): Promise<Map<number, string>> {
  await ensureRenderDependencies({ requireLibreOffice: true });
  const outputDir = await mkdtemp(join(tmpdir(), 'pptx-render-'));
  const slideImages = new Map<number, string>();

  try {
    // Step 1: Convert PPTX to PDF using LibreOffice
    await execFileAsync(
      SOFFICE_PATH,
      ['--headless', '--convert-to', 'pdf', '--outdir', outputDir, filePath],
      { timeout: 120_000 }
    );

    const files = await readdir(outputDir);
    const pdfFile = files.find(f => f.endsWith('.pdf'));

    if (!pdfFile) {
      console.warn('[ExtractSlides] LibreOffice did not produce a PDF');
      return slideImages;
    }

    const pdfPath = join(outputDir, pdfFile);

    // Step 2: Convert each PDF page to PNG using pdftoppm (via shell for environment)
    const pngPrefix = join(outputDir, 'slide');
    try {
      const { stderr } = await execAsync(
        `"${PDFTOPPM_PATH}" -png -r 150 -l 30 "${pdfPath}" "${pngPrefix}"`,
        { timeout: 90_000 }
      );
      if (stderr) {
        console.warn('[ExtractSlides] pdftoppm stderr:', stderr.slice(0, 300));
      }
    } catch (pdferr) {
      const msg = pdferr instanceof Error ? pdferr.message : String(pdferr);
      const stderr = (pdferr as { stderr?: string })?.stderr || '';
      const stdout = (pdferr as { stdout?: string })?.stdout || '';
      console.error('[ExtractSlides] pdftoppm FAILED:', msg);
      if (stderr) console.error('[ExtractSlides] pdftoppm stderr:', stderr.slice(0, 500));
      if (stdout) console.error('[ExtractSlides] pdftoppm stdout:', stdout.slice(0, 500));
      throw pdferr;
    }

    // pdftoppm outputs files like "slide-01.png", "slide-02.png", ...
    const pngFiles = (await readdir(outputDir))
      .filter(f => f.startsWith('slide-') && f.endsWith('.png'))
      .sort();

    for (let i = 0; i < pngFiles.length && i < slideCount; i++) {
      const pngPath = join(outputDir, pngFiles[i]);
      const buffer = readFileSync(pngPath);
      const base64 = buffer.toString('base64');
      // pdftoppm page numbering starts at 1
      slideImages.set(i + 1, `data:image/png;base64,${base64}`);
    }

    console.log(`[ExtractSlides] Rendered ${slideImages.size}/${slideCount} slides (via PDF)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stderr = (err as { stderr?: string })?.stderr || '';
    console.error('[ExtractSlides] LibreOffice rendering FAILED:', msg);
    if (stderr) console.error('[ExtractSlides] stderr:', stderr.slice(0, 500));
    throw err;
  } finally {
    // Clean up temp directory in background
    rm(outputDir, { recursive: true, force: true }).catch(() => {});
  }

  return slideImages;
}

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

/** Render PDF pages directly to PNG using pdftoppm (no LibreOffice needed) */
async function renderPdfToPng(filePath: string): Promise<Map<number, string>> {
  await ensureRenderDependencies({ requireLibreOffice: false });
  const outputDir = await mkdtemp(join(tmpdir(), 'pdf-render-'));
  const slideImages = new Map<number, string>();

  try {
    const pngPrefix = join(outputDir, 'slide');
    try {
      await execAsync(
        `"${PDFTOPPM_PATH}" -png -r 150 -l 30 "${filePath}" "${pngPrefix}"`,
        { timeout: 90_000 }
      );
    } catch (pdferr: unknown) {
      const msg = pdferr instanceof Error ? pdferr.message : String(pdferr);
      const stderr = (pdferr as { stderr?: string })?.stderr || '';
      console.error('[ExtractSlides] PDF pdftoppm FAILED:', msg);
      if (stderr) console.error('[ExtractSlides] PDF pdftoppm stderr:', stderr.slice(0, 500));
      throw pdferr;
    }

    const pngFiles = (await readdir(outputDir))
      .filter(f => f.startsWith('slide-') && f.endsWith('.png'))
      .sort();

    for (let i = 0; i < pngFiles.length; i++) {
      const pngPath = join(outputDir, pngFiles[i]);
      const buffer = readFileSync(pngPath);
      const base64 = buffer.toString('base64');
      slideImages.set(i + 1, `data:image/png;base64,${base64}`);
    }

    console.log(`[ExtractSlides] PDF direct render: ${slideImages.size} slides`);
  } catch (err) {
    console.error('[ExtractSlides] PDF render failed:', err instanceof Error ? err.message : String(err));
    throw err;
  } finally {
    rm(outputDir, { recursive: true, force: true }).catch(() => {});
  }

  return slideImages;
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

    const isPdf = filePath.endsWith('.pdf');

    // PDF files: render directly with pdftoppm
    if (isPdf) {
      const renderedSlides = await renderPdfToPng(filePath);
      if (renderedSlides.size === 0) {
        return fail('PDF 渲染失败：未生成任何页面图片', 500);
      }
      const slides = [];
      for (const [slideIndex, imageBase64] of renderedSlides) {
        slides.push({
          slideIndex,
          imageBase64,
          layout: 'single' as LayoutType,
          slideXML: '',
          textContent: '',
          colorScheme: {},
          fontInfo: {},
        });
      }
      return ok({ slides });
    }

    // PPTX files: parse + render
    const analysis = await parsePPTX(filePath);

    const fileBuffer = readFileSync(filePath);
    const zip = await JSZip.loadAsync(fileBuffer);

    // 用 LibreOffice 渲染幻灯片为 PNG 图片
    const renderedSlides = await renderSlidesWithLibreOffice(filePath, analysis.slides.length);
    if (renderedSlides.size === 0) {
      return fail('PPTX 渲染失败：未生成任何页面图片，请检查 LibreOffice/pdftoppm 配置', 500);
    }

    const slides = await Promise.all(
      analysis.slides.map(async (slide) => {
        const slidePath = `ppt/slides/slide${slide.slideIndex}.xml`;
        const slideXML = await zip.file(slidePath)?.async('string') || '';

        const layout: LayoutType = inferLayoutFromSlideXML(slideXML);

        // 优先使用 LibreOffice 渲染的完整幻灯片图片
        const imageBase64: string | null = renderedSlides.get(slide.slideIndex) || null;

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

    const renderedCount = slides.filter(s => s.imageBase64).length;
    console.log(`[ExtractSlides] Total: ${slides.length} slides, ${renderedCount} with images`);

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

function extractColorScheme(_zip: JSZip, __slideIndex: number): Record<string, string> {
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
