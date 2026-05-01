/**
 * Zod schemas for AI output validation
 * 验证 AI 返回的 JSON 结构，失败时自动重试一次
 */

import { z } from 'zod';

// ============ StyleConfig schema (analyzeStyle 输出) ============

export const StyleConfigSchema = z.object({
  overallStyle: z.enum(['business', 'tech', 'creative', 'academic']),
  palette: z.object({
    primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    text: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  typography: z.object({
    titleFont: z.string().min(1),
    bodyFont: z.string().min(1),
    titleSize: z.number().positive(),
    bodySize: z.number().positive(),
  }),
  layout: z.object({
    type: z.enum(['single', 'double', 'full', 'centered']),
    spacing: z.number(),
    padding: z.number(),
  }),
  designPrinciples: z.array(z.string()),
});

// ============ PPTJson schema (generatePPTJson 输出) ============

const ContentBlockSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'image', 'chart', 'list']),
  content: z.string(),
  position: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
  }),
  style: z.object({
    fontSize: z.number().optional(),
    fontWeight: z.string().optional(),
    color: z.string().optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
  }).optional(),
});

const SlideSchema = z.object({
  id: z.string(),
  layout: z.enum(['title', 'content', 'image', 'chart', 'quote']),
  title: z.string(),
  mainConclusion: z.string(),
  content: z.array(ContentBlockSchema),
});

export const PPTJsonSchema = z.object({
  metadata: z.object({
    projectId: z.string(),
    title: z.string(),
    category: z.string(),
    audience: z.string(),
    createdAt: z.string(),
  }),
  designSystem: z.object({
    palette: z.object({
      primary: z.string(),
      secondary: z.string(),
      accent: z.string(),
      background: z.string(),
      text: z.string(),
    }),
    typography: z.object({
      titleFont: z.string(),
      bodyFont: z.string(),
      titleSize: z.number(),
      bodySize: z.number(),
    }),
  }),
  roles: z.object({
    designer: z.string(),
    contentStrategist: z.string(),
    visualDirector: z.string(),
  }),
  slides: z.array(SlideSchema).min(1),
});

// ============ DeckPlan schema (Phase 1: generateDeckPlan 输出) ============

export const SlidePlanSchema = z.object({
  id: z.string(),
  index: z.number(),
  role: z.enum([
    'cover', 'toc', 'section-header', 'content', 'image-focus',
    'data-display', 'quote', 'comparison', 'summary', 'closing',
  ]),
  title: z.string(),
  mainConclusion: z.string(),
  contentOutline: z.array(z.object({
    type: z.enum(['heading', 'paragraph', 'bullet-list', 'image', 'chart', 'icon', 'decoration', 'caption']),
    description: z.string(),
    required: z.boolean(),
  })),
  layoutHint: z.enum([
    'hero', 'two-column', 'grid', 'centered', 'full-bleed',
    'quote', 'data-chart', 'comparison', 'timeline', 'gallery',
  ]).optional(),
});

export const DeckPlanSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  scenario: z.enum(['course', 'defense', 'pitch', 'report', 'proposal', 'training', 'research']),
  audience: z.enum(['teacher', 'judge', 'client', 'leader', 'student', 'investor', 'team']),
  slidePlans: z.array(SlidePlanSchema).min(1),
  metadata: z.object({
    totalPages: z.number().positive(),
    generatedAt: z.number(),
  }),
});

// ============ DistillStyleKit response schema ============

export const DistillStyleKitResponseSchema = z.object({
  name: z.string().min(1),
  mood: z.enum(['professional', 'creative', 'academic', 'casual']),
  moodDescription: z.string(),
  palette: z.object({
    primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    text: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  typography: z.object({
    titleFont: z.string(),
    bodyFont: z.string(),
    titleSize: z.number(),
    subtitleSize: z.number(),
    bodySize: z.number(),
    captionSize: z.number(),
  }),
  spacing: z.object({
    slidePadding: z.number(),
    contentMargin: z.number(),
    elementGap: z.number(),
  }),
  effects: z.object({
    shadowEnabled: z.boolean(),
    shadowType: z.enum(['soft', 'hard', 'none']),
    borderRadius: z.number(),
    gradientEnabled: z.boolean(),
  }),
  layoutPatterns: z.array(z.object({
    layoutType: z.string(),
    frequency: z.number(),
    bestFor: z.array(z.string()),
    layoutPrompt: z.string(),
    applicableSlides: z.array(z.number()),
  })),
  slideRoleDistribution: z.record(z.string(), z.number()),
  styleTags: z.array(z.string()),
});

// ============ EditPatch schema (AI edit 输出) ============

export const EditPatchSchema = z.object({
  operation: z.enum([
    'update_text',
    'batch_update_text',
    'move_element',
    'resize_element',
    'delete_element',
    'add_element',
    'replace_layout',
  ]),
  slideId: z.string(),
  elementId: z.string().optional(),
  oldValue: z.unknown().optional(),
  newValue: z.unknown().optional(),
  description: z.string(),
});

// ============ 验证工具函数 ============

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * 验证 AI 输出 JSON，失败时返回可读错误信息
 */
export function validateAIOutput<T>(
  schema: z.ZodSchema<T>,
  rawJson: unknown,
  context: string
): ValidationResult<T> {
  const result = schema.safeParse(rawJson);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const issues = result.error.issues
    .map(i => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');

  return {
    success: false,
    error: `[${context}] Schema validation failed:\n${issues}`,
  };
}
