import { NextRequest } from 'next/server';
import { minimaxVisionChat, isMockMode } from '@/lib/api-client';
import { mockElementDecomposeResponse } from '@/lib/ai-mock-data';
import { ok, fail } from '@/lib/api-response';

interface SlideInput {
  slideIndex: number;
  imageBase64: string;
}

interface ElementDecomposeRequest {
  slides: SlideInput[];
}

const ELEMENT_DECOMPOSE_PROMPT = `Analyze this PPT slide image and decompose it into individual visual elements.

**Step 1 — Background**: What is behind all elements? Type: solid (single color), gradient (2+ color transition), image (photograph/illustration), or pattern (repeating design). List all colors as hex codes. Write a short description.

**Step 2 — Elements**: Identify EVERY distinct visual element on the slide, from largest to smallest. For each element determine:
- type: title, subtitle, body, bullet_list, image, icon, shape, chart, table, decoration, page_number, or line
- position: ALL values 0-100, representing percentage of slide dimensions. x=distance from left edge, y=distance from top, w=element width, h=element height. Example: a full-width top title → { x: 5, y: 5, w: 90, h: 12 }
- content: text for text elements (original text from the slide), imageDescription for images/charts, chartType for charts (bar/line/pie/scatter/area)
- style: fontSize (pt), fontWeight (light/normal/medium/bold/black), color (hex), backgroundColor (hex), textAlign (left/center/right/justify), borderRadius (px), opacity (0-1)
- purpose: one sentence explaining this element's role on the slide

**Step 3 — Layout Pattern**: One sentence describing how all elements relate spatially (e.g., "Left-aligned title area with two-column body: bullet list on left, image on right").

**Step 4 — Reusable Prompt**: Write a comprehensive prompt that could be used to generate a slide with this exact layout pattern but with different content. Include all key style parameters (colors, fonts, positioning, layout logic).

Respond ONLY in English with this exact JSON format — no additional text:

\`\`\`json
{
  "background": {
    "type": "solid",
    "colors": ["#ffffff"],
    "description": "Clean white background"
  },
  "elements": [
    {
      "type": "title",
      "rect": { "x": 8, "y": 8, "w": 84, "h": 12 },
      "content": { "text": "Slide Title" },
      "style": { "fontSize": 36, "fontWeight": "bold", "color": "#1e40af", "textAlign": "left" },
      "purpose": "Main slide title introducing the topic"
    }
  ],
  "layoutPattern": "Top-left title with two-column body below: bullet points on left, supporting image on right",
  "reusablePrompt": "Generate a professional PPT slide with..."
}
\`\`\``;

async function decomposeSlide(imageBase64: string, signal?: AbortSignal) {
  const content = await minimaxVisionChat(ELEMENT_DECOMPOSE_PROMPT, imageBase64, { signal });
  const text = content.replace(/```json\n?|\n?```/g, '').trim();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Failed to parse element decompose response: ${text.slice(0, 200)}`);
  }
}

/** Sanitize a single rect to ensure all fields are finite numbers in 0-100 range */
function sanitizeRect(rect: unknown): { x: number; y: number; w: number; h: number } {
  const r = rect as Record<string, unknown> | null | undefined;
  if (!r || typeof r !== 'object') return { x: 0, y: 0, w: 100, h: 100 };
  const clamp = (v: unknown): number => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(100, v));
  };
  return { x: clamp(r.x), y: clamp(r.y), w: clamp(r.w), h: clamp(r.h) };
}

/** Validate and sanitize the vision model JSON output */
function validateDecomposition(raw: Record<string, unknown>): {
  background: { type: string; colors: string[]; description: string };
  elements: Array<{
    type: string;
    rect: { x: number; y: number; w: number; h: number };
    content: Record<string, unknown>;
    style: Record<string, unknown>;
    purpose: string;
  }>;
  layoutPattern: string;
  reusablePrompt: string;
} {
  const VALID_ELEMENT_TYPES = new Set([
    'title', 'subtitle', 'body', 'bullet_list', 'image', 'icon',
    'shape', 'chart', 'table', 'decoration', 'page_number', 'line',
  ]);

  const VALID_BG_TYPES = new Set(['solid', 'gradient', 'image', 'pattern']);

  // Validate background
  const bg = (raw.background as Record<string, unknown>) || {};
  const background = {
    type: VALID_BG_TYPES.has(bg.type as string) ? (bg.type as string) : 'solid',
    colors: Array.isArray(bg.colors) ? bg.colors.filter((c): c is string => typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c)) : ['#ffffff'],
    description: typeof bg.description === 'string' ? bg.description : 'No description',
  };

  // Validate elements
  const rawElements = Array.isArray(raw.elements) ? raw.elements : [];
  const elements: Array<{
    type: string;
    rect: { x: number; y: number; w: number; h: number };
    content: Record<string, unknown>;
    style: Record<string, unknown>;
    purpose: string;
  }> = [];

  for (const el of rawElements) {
    const e = el as Record<string, unknown> | null | undefined;
    if (!e || typeof e !== 'object') {
      console.warn('[ElementDecompose] Skipping non-object element:', el);
      continue;
    }

    // Validate type
    const type = VALID_ELEMENT_TYPES.has(e.type as string) ? (e.type as string) : 'shape';

    // Validate rect
    const rect = sanitizeRect(e.rect);

    // Validate content
    const rawContent = (e.content as Record<string, unknown>) || {};
    const content: Record<string, unknown> = {};
    if (typeof rawContent.text === 'string') content.text = rawContent.text;
    if (typeof rawContent.imageDescription === 'string') content.imageDescription = rawContent.imageDescription;
    if (typeof rawContent.chartType === 'string') content.chartType = rawContent.chartType;

    // Validate style — only keep known fields
    const rawStyle = (e.style as Record<string, unknown>) || {};
    const style: Record<string, unknown> = {};
    if (typeof rawStyle.fontSize === 'number') style.fontSize = rawStyle.fontSize;
    if (typeof rawStyle.fontWeight === 'string') style.fontWeight = rawStyle.fontWeight;
    if (typeof rawStyle.color === 'string') style.color = rawStyle.color;
    if (typeof rawStyle.backgroundColor === 'string') style.backgroundColor = rawStyle.backgroundColor;
    if (['left', 'center', 'right', 'justify'].includes(rawStyle.textAlign as string)) style.textAlign = rawStyle.textAlign;
    if (typeof rawStyle.borderRadius === 'number') style.borderRadius = rawStyle.borderRadius;
    if (typeof rawStyle.opacity === 'number') style.opacity = Math.max(0, Math.min(1, rawStyle.opacity));

    elements.push({
      type,
      rect,
      content,
      style,
      purpose: typeof e.purpose === 'string' ? e.purpose : `${type} element`,
    });
  }

  // Validate layoutPattern
  const layoutPattern = typeof raw.layoutPattern === 'string' ? raw.layoutPattern : '';

  // Validate reusablePrompt
  const reusablePrompt = typeof raw.reusablePrompt === 'string' ? raw.reusablePrompt : '';

  return { background, elements, layoutPattern, reusablePrompt };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ElementDecomposeRequest;
    const { slides } = body;

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return fail('slides array is required and cannot be empty', 400);
    }

    for (const slide of slides) {
      if (typeof slide.slideIndex !== 'number' || !slide.imageBase64) {
        return fail('Each slide must have slideIndex (number) and imageBase64 (string)', 400);
      }
    }

    if (isMockMode()) {
      return ok(mockElementDecomposeResponse);
    }

    const MAX_TIMEOUT_MS = 55_000;

    const results = await Promise.allSettled(
      slides.map(async (slide) => {
        console.log(`[ElementDecompose] Processing slide ${slide.slideIndex}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), MAX_TIMEOUT_MS);

        const rawDecomposed = await decomposeSlide(slide.imageBase64, controller.signal);
        clearTimeout(timeoutId);

        const validated = validateDecomposition(rawDecomposed as Record<string, unknown>);

        return {
          slideIndex: slide.slideIndex,
          background: validated.background,
          elements: validated.elements,
          layoutPattern: validated.layoutPattern,
          reusablePrompt: validated.reusablePrompt,
        };
      })
    );

    const decompositions: Array<{
      slideIndex: number;
      background: unknown;
      elements: unknown[];
      layoutPattern: string;
      reusablePrompt: string;
    }> = [];

    for (const r of results) {
      if (r.status === 'fulfilled') {
        decompositions.push(r.value);
      } else {
        console.warn('[ElementDecompose] Slide failed:', r.reason);
      }
    }

    if (decompositions.length === 0) {
      return fail('All slides failed to decompose', 500);
    }

    return ok({ decompositions });
  } catch (error) {
    console.error('Element decompose error:', error);
    return fail(error instanceof Error ? error.message : 'Internal server error');
  }
}
