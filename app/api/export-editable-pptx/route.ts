import { NextRequest, NextResponse } from 'next/server';
import { buildManifest } from '@/lib/editable-ppt/build-manifest';
import { imagesToManifest } from '@/lib/editable-ppt/image-to-manifest';
import { callPythonRenderer } from '@/lib/editable-ppt/call-python-renderer';
import type { GenSlidePrompt, GenSlideResult } from '@/types';
import type { EditablePptManifest } from '@/lib/editable-ppt/manifest-types';

export const runtime = 'nodejs';
export const maxDuration = 120; // Vision AI may need time for multi-slide

const VISION_EXPORT_MAX_SLIDES = 3;
const VISION_EXPORT_CONCURRENCY = 3;

/**
 * POST /api/export-editable-pptx
 *
 * Two modes:
 *  - mode: "structure" (default) — build manifest from GenSlidePrompt.elements
 *  - mode: "vision"             — use Vision AI to recognize images, build precise manifest
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      mode = 'structure',
      prompts,
      results,
      deckName,
      fileName,
      visionProvider,
    } = body as {
      mode?: 'structure' | 'vision';
      prompts?: GenSlidePrompt[];
      results?: GenSlideResult[];
      deckName?: string;
      fileName?: string;
      visionProvider?: 'openai' | 'minimax';
    };

    let manifest: EditablePptManifest;

    if (mode === 'vision') {
      // ── Vision mode: recognize images → precise manifest ──
      if (!results || !Array.isArray(results) || results.length === 0) {
        return NextResponse.json(
          { error: '视觉识别模式需要 results（含 previewImage）' },
          { status: 400 },
        );
      }

      const slidesWithImages = results
        .filter(r => r.previewImage && (r.status === 'generated' || r.status === 'confirmed'))
        .sort((a, b) => a.slideIndex - b.slideIndex)
        .slice(0, VISION_EXPORT_MAX_SLIDES);

      if (slidesWithImages.length === 0) {
        return NextResponse.json(
          { error: '没有包含预览图片的已生成页面' },
          { status: 400 },
        );
      }

      const slideInputs = slidesWithImages.map(r => {
        const matchingPrompt = prompts?.find(p => p.index === r.slideIndex);
        return {
          imageBase64: r.previewImage!,
          context: matchingPrompt
            ? `页面标题: ${matchingPrompt.title}, 类型: ${matchingPrompt.type}, 内容目标: ${matchingPrompt.contentGoal}`
            : undefined,
        };
      });

      console.log(`[export-editable-pptx] Vision mode: analyzing ${slideInputs.length} slides...`);
      manifest = await imagesToManifest(slideInputs, deckName || 'Recognized Deck', {
        provider: visionProvider || 'openai',
        concurrency: VISION_EXPORT_CONCURRENCY,
      });

    } else {
      // ── Structure mode: convert GenSlidePrompt.elements → manifest ──
      if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
        return NextResponse.json(
          { error: 'prompts 数组不能为空' },
          { status: 400 },
        );
      }
      manifest = buildManifest(prompts, results, { deckName });
    }

    // Validate
    if (manifest.slides.length === 0) {
      return NextResponse.json(
        { error: 'manifest 中没有幻灯片' },
        { status: 400 },
      );
    }

    // Call Python renderer
    const { pptxBuffer } = await callPythonRenderer(
      manifest,
      fileName || deckName || 'editable-output',
    );

    return new NextResponse(new Uint8Array(pptxBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName || deckName || 'editable-output')}.pptx"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[export-editable-pptx] Error:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
