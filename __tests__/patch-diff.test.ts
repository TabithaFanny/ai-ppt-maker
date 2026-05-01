/**
 * Tests for lib/patch-diff.ts — 人类可读 diff 生成
 */

import { generatePatchDiff } from '../lib/patch-diff';
import { createUpdateTextPatch, createBatchUpdateTextPatch, createMovePatch, createResizePatch, createDeleteElementPatch, createAddElementPatch, createReplaceLayoutPatch } from '../lib/edit-patch';
import type { PPTJson, Slide, ContentBlock } from '../types';

function makeBlock(overrides: Partial<ContentBlock> = {}): ContentBlock {
  return {
    id: 'block-1',
    type: 'text',
    content: 'Hello World',
    position: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 },
    ...overrides,
  };
}

function makeSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    id: 'slide-1',
    layout: 'content',
    title: 'Test Slide',
    mainConclusion: 'Conclusion',
    content: [makeBlock(), makeBlock({ id: 'block-2', content: 'Second block' })],
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

describe('generatePatchDiff', () => {
  it('generates diff for update_text', () => {
    const ppt = makePPTJson();
    const patch = createUpdateTextPatch('slide-1', 'block-1', 'Hello World', 'New Title');
    const diff = generatePatchDiff(ppt, patch);

    expect(diff.slideId).toBe('slide-1');
    expect(diff.operation).toBe('update_text');
    expect(diff.summary).toContain('修改文字');
    expect(diff.changes).toHaveLength(1);
    expect(diff.changes[0].elementId).toBe('block-1');
    expect(diff.changes[0].oldValue).toBe('Hello World');
    expect(diff.changes[0].newValue).toBe('New Title');
  });

  it('generates diff for batch_update_text', () => {
    const ppt = makePPTJson();
    const patch = createBatchUpdateTextPatch('slide-1', [
      { elementId: 'block-1', oldValue: 'Hello World', newValue: 'Updated 1' },
      { elementId: 'block-2', oldValue: 'Second block', newValue: 'Updated 2' },
    ]);
    const diff = generatePatchDiff(ppt, patch);

    expect(diff.operation).toBe('batch_update_text');
    expect(diff.changes).toHaveLength(2);
    expect(diff.summary).toContain('2');
  });

  it('generates diff for move_element', () => {
    const ppt = makePPTJson();
    const oldPos = { x: 0.1, y: 0.1, width: 0.8, height: 0.2 };
    const newPos = { x: 0.2, y: 0.3, width: 0.8, height: 0.2 };
    const patch = createMovePatch('slide-1', 'block-1', oldPos, newPos);
    const diff = generatePatchDiff(ppt, patch);

    expect(diff.operation).toBe('move_element');
    expect(diff.changes).toHaveLength(1);
    expect(diff.changes[0].oldValue).toEqual(oldPos);
    expect(diff.changes[0].newValue).toEqual(newPos);
  });

  it('generates diff for resize_element', () => {
    const ppt = makePPTJson();
    const oldPos = { x: 0.1, y: 0.1, width: 0.8, height: 0.2 };
    const newPos = { x: 0.1, y: 0.1, width: 0.4, height: 0.1 };
    const patch = createResizePatch('slide-1', 'block-1', oldPos, newPos);
    const diff = generatePatchDiff(ppt, patch);

    expect(diff.operation).toBe('resize_element');
    expect(diff.summary).toContain('调整大小');
  });

  it('generates diff for delete_element', () => {
    const ppt = makePPTJson();
    const block = makeBlock();
    const patch = createDeleteElementPatch('slide-1', block);
    const diff = generatePatchDiff(ppt, patch);

    expect(diff.operation).toBe('delete_element');
    expect(diff.changes).toHaveLength(1);
    expect(diff.changes[0].oldValue).toEqual(block);
    expect(diff.changes[0].newValue).toBeNull();
    expect(diff.summary).toContain('删除');
  });

  it('generates diff for add_element', () => {
    const ppt = makePPTJson();
    const newBlock = makeBlock({ id: 'block-new', content: 'New element' });
    const patch = createAddElementPatch('slide-1', newBlock);
    const diff = generatePatchDiff(ppt, patch);

    expect(diff.operation).toBe('add_element');
    expect(diff.changes).toHaveLength(1);
    expect(diff.changes[0].newValue).toEqual(newBlock);
    expect(diff.summary).toContain('添加');
  });

  it('generates diff for replace_layout', () => {
    const ppt = makePPTJson();
    const patch = createReplaceLayoutPatch('slide-1', 'content', 'image');
    const diff = generatePatchDiff(ppt, patch);

    expect(diff.operation).toBe('replace_layout');
    expect(diff.changes).toHaveLength(1);
    expect(diff.changes[0].oldValue).toBe('content');
    expect(diff.changes[0].newValue).toBe('image');
    expect(diff.summary).toContain('布局');
  });

  it('includes slide title in diff', () => {
    const ppt = makePPTJson();
    const patch = createUpdateTextPatch('slide-1', 'block-1', 'Hello World', 'New');
    const diff = generatePatchDiff(ppt, patch);

    expect(diff.slideTitle).toBe('Test Slide');
  });
});
