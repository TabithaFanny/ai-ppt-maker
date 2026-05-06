import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api-response';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

interface ExtractRequest {
  fileId?: string;
  text?: string; // direct text input
}

/** Extract text from Word (.docx) or PDF files using mammoth/pdfjs */
export async function POST(request: NextRequest) {
  try {
    const body: ExtractRequest = await request.json();

    // Direct text input (e.g., user pasted content)
    if (body.text) {
      const text = body.text.trim();
      const summary = text.length > 500
        ? text.slice(0, 200) + '...（内容已截断用于摘要）'
        : text;
      return ok({ text, summary, source: 'direct' });
    }

    if (!body.fileId) {
      return fail('fileId or text is required', 400);
    }

    const uploadDir = join(process.cwd(), 'uploads');
    const candidates = body.fileId.includes('.')
      ? [join(uploadDir, body.fileId)]
      : ['docx', 'doc', 'pdf'].map((ext) => join(uploadDir, `${body.fileId}.${ext}`));
    const filePath = candidates.find((candidate) => existsSync(candidate));

    let fileBuffer: Buffer;
    try {
      if (!filePath) throw new Error('not found');
      fileBuffer = readFileSync(filePath);
    } catch {
      return fail('文件未找到，请先上传文件', 404);
    }

    const ext = filePath.toLowerCase();
    let text = '';

    if (ext.endsWith('.docx') || ext.endsWith('.doc')) {
      // Word document — use mammoth
      try {
        const mammoth = (await import('mammoth')).default;
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        text = result.value;
      } catch (docErr) {
        console.warn('[extract-document] mammoth parse error, trying raw XML fallback:', docErr);
        // Fallback: extract whatever text we can from the raw buffer
        const rawStr = fileBuffer.toString('utf-8');
        const textMatches = rawStr.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
        text = textMatches.map((m) => m.replace(/<[^>]+>/g, '')).join(' ');
        if (!text.trim()) {
          return fail('文档解析失败：文件格式异常或内容为空。请尝试另存为 .docx 后重试。', 422);
        }
      }
    } else if (ext.endsWith('.pdf')) {
      // PDF — use pdfjs-dist
      const pdfjsLib = await import('pdfjs-dist');
      const loadingTask = pdfjsLib.getDocument({ data: fileBuffer });
      const pdfDoc = await loadingTask.promise;
      const pageTexts: string[] = [];

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const content = await page.getTextContent();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pageText = (content.items as any[])
          .filter((item) => typeof item === 'object' && item !== null && 'str' in item)
          .map((item) => String((item as { str?: string }).str || ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (pageText) pageTexts.push(`[第 ${i} 页]\n${pageText}`);
      }

      text = pageTexts.join('\n\n');
    } else {
      return fail('不支持的文件格式，请上传 Word (.docx) 或 PDF 文件', 400);
    }

    if (!text.trim()) {
      return ok({ text: '', summary: '文档内容为空或无法提取文本', source: ext });
    }

    const summary = text.length > 500
      ? text.slice(0, 300) + '...（内容已截断）'
      : text;

    return ok({ text, summary, source: ext });
  } catch (error) {
    console.error('[extract-document] error:', error);
    return fail(error instanceof Error ? error.message : '文档提取失败');
  }
}