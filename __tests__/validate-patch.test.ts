/**
 * Tests for lib/validate-patch.ts — PatchValidator
 */

import { validatePatch } from '../lib/validate-patch';
import { createUpdateTextPatch, createBatchUpdateTextPatch, createMovePatch, createResizePatch, createDeleteElementPatch, createAddElementPatch, createReplaceLayoutPatch } from '../lib/edit-patch';
import type { EditPatch } from '../types/generation';
import type { PPTJson, Slide, ContentBlock } from '../types';

function makeBlock(overrides: Partial<ContentBlock> = {}): ContentBlock {
  return {
    id: 'block-1',
    type: 'text',
    content: 'Hello',
    position: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 },
    ...overrides,
  };
}

function makeSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    id: 'slide-1',
    layout: 'content',
    title: 'Test',
    mainConclusion: 'Conclusion',
    content: [makeBlock(), makeBlock({ id: 'block-2', content: 'World' })],
    ...overrides,
  };
}

function makePPTJson(slides: Slide[] = [makeSlide()]): PPTJson {
  return {
    metadata: { projectId: 'p1', title: 'Test', category: 'test', audience: 'general', createdAt: new Date().toISOString() },
    designSystem: { palette: { primary: '#000', secondary: '#fff', accent: '#f00', background: '#fff', text: '#000' }, typography: { titleFont: 'Arial', bodyFont: 'Helvetica', titleSize: 44, bodySize: 18 } },
    roles: { designer: 'test', contentStrategist: 'test', visualDirector: 'test' },
    slides,
  };
}

describe('validatePatch', () => {
  describe('common checks', () => {
    it('rejects unknown slideId', () => {
      const ppt = makePPTJson();
      const patch = createUpdateTextPatch('nonexistent', 'block-1', 'old', 'new');
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('SLIDE_NOT_FOUND');
      expect(result.errors[0].message).toContain('幻灯片不存在');
    });

    it('rejects unknown operation', () => {
      const ppt = makePPTJson();
      const patch = { ...createUpdateTextPatch('slide-1', 'block-1', 'a', 'b'), operation: 'unknown_op' as any };
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('UNSUPPORTED_OPERATION');
    });

    it('accepts valid patch', () => {
      const ppt = makePPTJson();
      const patch = createUpdateTextPatch('slide-1', 'block-1', 'Hello', 'Updated');
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns warnings array', () => {
      const ppt = makePPTJson();
      const patch = createUpdateTextPatch('slide-1', 'block-1', 'Hello', 'Updated');
      const result = validatePatch(ppt, patch);

      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('update_text', () => {
    it('rejects unknown elementId', () => {
      const ppt = makePPTJson();
      const patch = createUpdateTextPatch('slide-1', 'nonexistent', 'old', 'new');
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('ELEMENT_NOT_FOUND');
    });

    it('rejects update to locked element', () => {
      const lockedBlock = makeBlock({ id: 'locked-1', locked: true });
      const ppt = makePPTJson([makeSlide({ content: [lockedBlock] })]);
      const patch = createUpdateTextPatch('slide-1', 'locked-1', 'old', 'new');
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('ELEMENT_LOCKED');
    });

    it('rejects when elementId is missing', () => {
      const ppt = makePPTJson();
      const patch = createUpdateTextPatch('slide-1', '', 'old', 'new');
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('ELEMENT_ID_REQUIRED');
    });
  });

  describe('batch_update_text', () => {
    it('rejects if any elementId does not exist', () => {
      const ppt = makePPTJson();
      const patch = createBatchUpdateTextPatch('slide-1', [
        { elementId: 'block-1', oldValue: 'Hello', newValue: 'Updated' },
        { elementId: 'nonexistent', oldValue: 'x', newValue: 'y' },
      ]);
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'ELEMENT_NOT_FOUND')).toBe(true);
    });

    it('rejects if batch contains locked element', () => {
      const lockedBlock = makeBlock({ id: 'locked-1', locked: true });
      const ppt = makePPTJson([makeSlide({ content: [lockedBlock, makeBlock({ id: 'b-2' })] })]);
      const patch = createBatchUpdateTextPatch('slide-1', [
        { elementId: 'locked-1', oldValue: 'x', newValue: 'y' },
        { elementId: 'b-2', oldValue: 'a', newValue: 'b' },
      ]);
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'ELEMENT_LOCKED')).toBe(true);
    });

    it('rejects empty batch', () => {
      const ppt = makePPTJson();
      const patch = createBatchUpdateTextPatch('slide-1', []);
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('EMPTY_BATCH');
    });

    it('accepts batch with all valid elements', () => {
      const ppt = makePPTJson();
      const patch = createBatchUpdateTextPatch('slide-1', [
        { elementId: 'block-1', oldValue: 'Hello', newValue: 'Updated' },
        { elementId: 'block-2', oldValue: 'World', newValue: 'Changed' },
      ]);
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(true);
    });
  });

  describe('move_element / resize_element', () => {
    it('rejects unknown elementId', () => {
      const ppt = makePPTJson();
      const patch = createMovePatch('slide-1', 'nonexistent', { x: 0, y: 0, width: 0.5, height: 0.5 }, { x: 0.1, y: 0.1, width: 0.5, height: 0.5 });
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('ELEMENT_NOT_FOUND');
    });

    it('rejects out-of-bounds position', () => {
      const ppt = makePPTJson();
      const patch = createMovePatch('slide-1', 'block-1', { x: 0.1, y: 0.1, width: 0.8, height: 0.2 }, { x: 0.9, y: 0.9, width: 0.5, height: 0.5 });
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('POSITION_OUT_OF_BOUNDS');
    });

    it('rejects negative dimensions', () => {
      const ppt = makePPTJson();
      const patch = createResizePatch('slide-1', 'block-1', { x: 0.1, y: 0.1, width: 0.8, height: 0.2 }, { x: 0.1, y: 0.1, width: -0.5, height: 0.2 });
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_DIMENSIONS');
    });

    it('rejects move on locked element', () => {
      const lockedBlock = makeBlock({ id: 'locked-1', locked: true });
      const ppt = makePPTJson([makeSlide({ content: [lockedBlock] })]);
      const patch = createMovePatch('slide-1', 'locked-1', { x: 0.1, y: 0.1, width: 0.8, height: 0.2 }, { x: 0.2, y: 0.2, width: 0.8, height: 0.2 });
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('ELEMENT_LOCKED');
    });

    it('rejects NaN position values', () => {
      const ppt = makePPTJson();
      const patch = createMovePatch('slide-1', 'block-1', { x: 0.1, y: 0.1, width: 0.8, height: 0.2 }, { x: NaN, y: 0.1, width: 0.8, height: 0.2 });
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_POSITION_VALUES');
    });

    it('rejects Infinity position values', () => {
      const ppt = makePPTJson();
      const patch = createMovePatch('slide-1', 'block-1', { x: 0.1, y: 0.1, width: 0.8, height: 0.2 }, { x: 0.1, y: Infinity, width: 0.8, height: 0.2 });
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_POSITION_VALUES');
    });

    it('rejects when elementId is missing', () => {
      const ppt = makePPTJson();
      const patch = createMovePatch('slide-1', '', { x: 0.1, y: 0.1, width: 0.8, height: 0.2 }, { x: 0.2, y: 0.2, width: 0.8, height: 0.2 });
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('ELEMENT_ID_REQUIRED');
    });

    it('accepts valid in-bounds position', () => {
      const ppt = makePPTJson();
      const patch = createMovePatch('slide-1', 'block-1', { x: 0.1, y: 0.1, width: 0.8, height: 0.2 }, { x: 0.05, y: 0.05, width: 0.4, height: 0.15 });
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(true);
    });
  });

  describe('delete_element', () => {
    it('rejects delete of locked element', () => {
      const lockedBlock = makeBlock({ id: 'locked-1', locked: true });
      const ppt = makePPTJson([makeSlide({ content: [lockedBlock] })]);
      const patch = createDeleteElementPatch('slide-1', lockedBlock);
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('ELEMENT_LOCKED');
    });

    it('rejects when elementId is missing', () => {
      const ppt = makePPTJson();
      const block = makeBlock({ id: '' });
      const patch = createDeleteElementPatch('slide-1', block);
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('ELEMENT_ID_REQUIRED');
    });

    it('accepts delete of unlocked element', () => {
      const ppt = makePPTJson();
      const patch = createDeleteElementPatch('slide-1', makeBlock());
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(true);
    });
  });

  describe('add_element', () => {
    it('rejects duplicate element id', () => {
      const ppt = makePPTJson();
      const duplicateBlock = makeBlock({ id: 'block-1', content: 'Duplicate' });
      const patch = createAddElementPatch('slide-1', duplicateBlock);
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('DUPLICATE_ELEMENT_ID');
    });

    it('rejects add with missing block data', () => {
      const ppt = makePPTJson();
      const patch: EditPatch = {
        id: 'test-patch',
        timestamp: Date.now(),
        slideId: 'slide-1',
        operation: 'add_element',
        oldValue: null,
        newValue: null,
        description: 'test',
      };
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_ADD_DATA');
    });

    it('rejects add with invalid position', () => {
      const ppt = makePPTJson();
      const badBlock = makeBlock({ id: 'new-1', position: { x: 0.9, y: 0.9, width: 0.5, height: 0.5 } });
      const patch = createAddElementPatch('slide-1', badBlock);
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('POSITION_OUT_OF_BOUNDS');
    });

    it('accepts add with unique id', () => {
      const ppt = makePPTJson();
      const newBlock = makeBlock({ id: 'block-new' });
      const patch = createAddElementPatch('slide-1', newBlock);
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(true);
    });
  });

  describe('replace_layout', () => {
    it('rejects unknown layout value', () => {
      const ppt = makePPTJson();
      const patch = createReplaceLayoutPatch('slide-1', 'content', 'nonexistent_layout' as any);
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_LAYOUT');
    });

    it('rejects empty newValue', () => {
      const ppt = makePPTJson();
      const patch = createReplaceLayoutPatch('slide-1', 'content', '' as any);
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_LAYOUT');
    });

    it('rejects if resulting slide would have no content', () => {
      const emptySlide = makeSlide({ content: [] });
      const ppt = makePPTJson([emptySlide]);
      const patch = createReplaceLayoutPatch('slide-1', 'content', 'image');
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('EMPTY_SLIDE_AFTER_LAYOUT_CHANGE');
    });

    it('warns if layout change might hide content', () => {
      const slideWithManyBlocks = makeSlide({
        content: [
          makeBlock({ id: 'b1' }),
          makeBlock({ id: 'b2', position: { x: 0.1, y: 0.3, width: 0.8, height: 0.2 } }),
          makeBlock({ id: 'b3', position: { x: 0.1, y: 0.6, width: 0.8, height: 0.2 } }),
        ],
      });
      const ppt = makePPTJson([slideWithManyBlocks]);
      const patch = createReplaceLayoutPatch('slide-1', 'content', 'title');
      const result = validatePatch(ppt, patch);

      // title layout typically has fewer content slots
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('accepts valid layout replacement', () => {
      const ppt = makePPTJson();
      const patch = createReplaceLayoutPatch('slide-1', 'content', 'quote');
      const result = validatePatch(ppt, patch);

      expect(result.valid).toBe(true);
    });

    it('accepts all valid layout values', () => {
      const ppt = makePPTJson();
      const validLayouts = ['title', 'content', 'image', 'chart', 'quote'];
      for (const layout of validLayouts) {
        const patch = createReplaceLayoutPatch('slide-1', 'content', layout as any);
        const result = validatePatch(ppt, patch);
        expect(result.valid).toBe(true);
      }
    });
  });
});
