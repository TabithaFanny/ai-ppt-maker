/**
 * 验证所有 AI mock 数据是否通过 Zod Schema
 * 确保 AI_MOCK=true 时不会 JSON.parse 失败
 */
import {
  mockStyleConfig,
  mockStyleKitExtractResponse,
  mockStyleDistillResult,
  mockDeckPlan,
  mockPPTJson,
  mockEditPatch,
  mockEditPatchBatch,
} from '@/lib/ai-mock-data';
import {
  StyleConfigSchema,
  PPTJsonSchema,
  DeckPlanSchema,
  DistillStyleKitResponseSchema,
  EditPatchSchema,
  validateAIOutput,
} from '@/lib/schemas';

describe('AI Mock Data - Schema Validation', () => {
  describe('mockStyleConfig', () => {
    it('passes StyleConfigSchema', () => {
      const result = validateAIOutput(StyleConfigSchema, mockStyleConfig, 'mockStyleConfig');
      expect(result.success).toBe(true);
    });
  });

  describe('mockStyleKitExtractResponse', () => {
    it('has valid structure', () => {
      expect(mockStyleKitExtractResponse.sourceFileId).toBeTruthy();
      expect(mockStyleKitExtractResponse.styleDNAResults.length).toBeGreaterThan(0);
      expect(typeof mockStyleKitExtractResponse.processedSlides).toBe('number');
      expect(typeof mockStyleKitExtractResponse.hadFailures).toBe('boolean');
    });
  });

  describe('mockStyleDistillResult', () => {
    it('passes DistillStyleKitResponseSchema', () => {
      const result = validateAIOutput(
        DistillStyleKitResponseSchema,
        mockStyleDistillResult,
        'mockStyleDistill'
      );
      expect(result.success).toBe(true);
    });
  });

  describe('mockDeckPlan', () => {
    it('passes DeckPlanSchema', () => {
      const result = validateAIOutput(DeckPlanSchema, mockDeckPlan, 'mockDeckPlan');
      expect(result.success).toBe(true);
    });

    it('has at least 8 slides', () => {
      expect(mockDeckPlan.slidePlans.length).toBeGreaterThanOrEqual(8);
    });

    it('starts with cover and ends with closing', () => {
      expect(mockDeckPlan.slidePlans[0].role).toBe('cover');
      expect(mockDeckPlan.slidePlans[mockDeckPlan.slidePlans.length - 1].role).toBe('closing');
    });
  });

  describe('mockPPTJson', () => {
    it('passes PPTJsonSchema', () => {
      const result = validateAIOutput(PPTJsonSchema, mockPPTJson, 'mockPPTJson');
      expect(result.success).toBe(true);
    });

    it('has at least 8 slides', () => {
      expect(mockPPTJson.slides.length).toBeGreaterThanOrEqual(8);
    });

    it('all slides have IDs', () => {
      mockPPTJson.slides.forEach((slide, i) => {
        expect(slide.id).toBeTruthy();
        expect(slide.title).toBeTruthy();
        expect(slide.mainConclusion).toBeTruthy();
      });
    });

    it('all content blocks have valid positions', () => {
      mockPPTJson.slides.forEach((slide) => {
        slide.content.forEach((block) => {
          expect(block.position.x).toBeGreaterThanOrEqual(0);
          expect(block.position.x).toBeLessThanOrEqual(1);
          expect(block.position.y).toBeGreaterThanOrEqual(0);
          expect(block.position.y).toBeLessThanOrEqual(1);
          expect(block.position.width).toBeGreaterThan(0);
          expect(block.position.width).toBeLessThanOrEqual(1);
          expect(block.position.height).toBeGreaterThan(0);
          expect(block.position.height).toBeLessThanOrEqual(1);
        });
      });
    });

    it('has speakerNotes on each slide', () => {
      mockPPTJson.slides.forEach((slide, i) => {
        expect((slide as any).speakerNotes).toBeTruthy();
      });
    });
  });

  describe('mockEditPatch', () => {
    it('passes EditPatchSchema', () => {
      const result = validateAIOutput(EditPatchSchema, mockEditPatch, 'mockEditPatch');
      expect(result.success).toBe(true);
    });
  });

  describe('mockEditPatchBatch', () => {
    it('all items pass EditPatchSchema', () => {
      mockEditPatchBatch.forEach((patch, i) => {
        const result = validateAIOutput(EditPatchSchema, patch, `mockEditPatchBatch[${i}]`);
        expect(result.success).toBe(true);
      });
    });
  });
});
