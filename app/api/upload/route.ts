import { NextRequest } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { PDFDocument } from 'pdf-lib';
import { ok, fail } from '@/lib/api-response';

async function extractPdfPages(buffer: Buffer): Promise<{ firstPage: string; thumbnails: string[] }> {
  const pdf = await PDFDocument.load(buffer);
  const pageCount = Math.min(pdf.getPageCount(), 3);

  const firstPagePdf = await PDFDocument.create();
  const [firstPage] = await firstPagePdf.copyPages(pdf, [0]);
  firstPagePdf.addPage(firstPage);
  const firstPageBytes = await firstPagePdf.save();

  const thumbnails: string[] = [];
  for (let i = 0; i < pageCount; i++) {
    const singlePagePdf = await PDFDocument.create();
    const [page] = await singlePagePdf.copyPages(pdf, [i]);
    singlePagePdf.addPage(page);
    const pdfBytes = await singlePagePdf.save();
    thumbnails.push(Buffer.from(pdfBytes).toString('base64'));
  }

  return {
    firstPage: Buffer.from(firstPageBytes).toString('base64'),
    thumbnails,
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return fail('没有文件', 400);
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'ppt', 'pptx'].includes(ext || '')) {
      return fail('不支持的文件类型', 400);
    }

    if (file.size > 50 * 1024 * 1024) {
      return fail('文件过大', 400);
    }

    const uploadDir = join(process.cwd(), 'uploads');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const fileId = crypto.randomUUID();
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = join(uploadDir, `${fileId}.${ext}`);
    await writeFile(filePath, buffer);

    let firstPagePdf = '';
    let thumbnails: string[] = [];

    if (ext === 'pdf') {
      const extracted = await extractPdfPages(buffer);
      firstPagePdf = extracted.firstPage;
      thumbnails = extracted.thumbnails;
    }

    const warnings: string[] = [];
    if (ext === 'ppt') {
      warnings.push('旧版 .ppt 格式样式提取能力有限，建议转换为 .pptx 格式获得更好的效果');
    }

    return ok({
      fileId,
      url: `/uploads/${fileId}.${ext}`,
      name: file.name,
      size: file.size,
      type: ext,
      firstPagePdf,
      thumbnails,
      warnings,
    });
  } catch (error) {
    console.error('上传失败:', error);
    return fail('上传失败');
  }
}
