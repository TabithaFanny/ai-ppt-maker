/**
 * Tests for lib/edit-patch.ts and lib/edit-history.ts
 */

import {
  createUpdateTextPatch,
  createBatchUpdateTextPatch,
  createMovePatch,
  createResizePatch,
  createDeleteElementPatch,
  createAddElementPatch,
  createReplaceLayoutPatch,
  applyPatch,
  reversePatch,
} from '../lib/edit-patch';
import {
  createEditHistory,
  pushPatch,
  undo,
  redo,
  canUndo,
  canRedo,
} from '../lib/edit-history';
import type { PPTJson, Slide, ContentBlock } from '../types';
import type { EditPatch } from '../types/generation';

function makeTestPPTJson(): PPTJson {
  const block1: ContentBlock = {
    id: 'block-1',
    type: 'text',
    content: 'Hello World',
    position: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 },
  };
  const block2: ContentBlock = {
    id: 'block-2',
    type: 'text',
    content: 'Second block',
    position: { x: 0.1, y: 0.4, width: 0.8, height: 0.2 },
  };
  const slide: Slide = {
    id: 'slide-1',
    layout: 'content',
    title: 'Test Slide',
    mainConclusion: 'Test conclusion',
    content: [block1, block2],
  };
  return {
    metadata: {
      projectId: 'proj-1',
      title: 'Test PPT',
      category: 'test',
      audience: 'general',
      createdAt: new Date().toISOString(),
    },
    designSystem: {
      palette: { primary: '#000', secondary: '#fff', accent: '#f00', background: '#fff', text: '#000' },
      typography: { titleFont: 'Arial', bodyFont: 'Helvetica', titleSize: 44, bodySize: 18 },
    },
    roles: { designer: 'test', contentStrategist: 'test', visualDirector: 'test' },
    slides: [slide],
  };
}

describe('createUpdateTextPatch', () => {
  it('creates a valid patch', () => {
    const patch = createUpdateTextPatch('slide-1', 'block-1', 'Hello', 'World');
    expect(patch.operation).toBe('update_text');
    expect(patch.slideId).toBe('slide-1');
    expect(patch.elementId).toBe('block-1');
    expect(patch.oldValue).toBe('Hello');
    expect(patch.newValue).toBe('World');
  });
});

describe('applyPatch / reversePatch — update_text', () => {
  it('applies text update', () => {
    const ppt = makeTestPPTJson();
    const patch = createUpdateTextPatch('slide-1', 'block-1', 'Hello World', 'Updated');
    const result = applyPatch(ppt, patch);

    expect(result.slides[0].content[0].content).toBe('Updated');
    expect(result.slides[0].content[1].content).toBe('Second block');
  });

  it('reverses text update', () => {
    const ppt = makeTestPPTJson();
    const patch = createUpdateTextPatch('slide-1', 'block-1', 'Hello World', 'Updated');
    const updated = applyPatch(ppt, patch);
    const restored = reversePatch(updated, patch);

    expect(restored.slides[0].content[0].content).toBe('Hello World');
  });

  it('ignores patch for non-existent slide', () => {
    const ppt = makeTestPPTJson();
    const patch = createUpdateTextPatch('nonexistent', 'block-1', 'Hello', 'World');
    const result = applyPatch(ppt, patch);

    expect(result).toEqual(ppt);
  });

  it('ignores patch for non-existent element', () => {
    const ppt = makeTestPPTJson();
    const patch = createUpdateTextPatch('slide-1', 'nonexistent', 'Hello', 'World');
    const result = applyPatch(ppt, patch);

    expect(result.slides[0].content[0].content).toBe('Hello World');
  });
});

describe('applyPatch / reversePatch — batch_update_text', () => {
  it('applies batch text update to multiple elements', () => {
    const ppt = makeTestPPTJson();
    const patch = createBatchUpdateTextPatch('slide-1', [
      { elementId: 'block-1', oldValue: 'Hello World', newValue: 'Updated 1' },
      { elementId: 'block-2', oldValue: 'Second block', newValue: 'Updated 2' },
    ]);
    const result = applyPatch(ppt, patch);

    expect(result.slides[0].content[0].content).toBe('Updated 1');
    expect(result.slides[0].content[1].content).toBe('Updated 2');
  });

  it('reverses batch text update', () => {
    const ppt = makeTestPPTJson();
    const patch = createBatchUpdateTextPatch('slide-1', [
      { elementId: 'block-1', oldValue: 'Hello World', newValue: 'Updated 1' },
      { elementId: 'block-2', oldValue: 'Second block', newValue: 'Updated 2' },
    ]);
    const updated = applyPatch(ppt, patch);
    const restored = reversePatch(updated, patch);

    expect(restored.slides[0].content[0].content).toBe('Hello World');
    expect(restored.slides[0].content[1].content).toBe('Second block');
  });

  it('ignores batch patch for non-existent slide', () => {
    const ppt = makeTestPPTJson();
    const patch = createBatchUpdateTextPatch('nonexistent', [
      { elementId: 'block-1', oldValue: 'Hello', newValue: 'World' },
    ]);
    const result = applyPatch(ppt, patch);

    expect(result).toEqual(ppt);
  });
});

describe('applyPatch / reversePatch — move_element', () => {
  it('applies move', () => {
    const ppt = makeTestPPTJson();
    const oldPos = { x: 0.1, y: 0.1, width: 0.8, height: 0.2 };
    const newPos = { x: 0.5, y: 0.5, width: 0.8, height: 0.2 };
    const patch = createMovePatch('slide-1', 'block-1', oldPos, newPos);
    const result = applyPatch(ppt, patch);

    expect(result.slides[0].content[0].position).toEqual(newPos);
  });

  it('reverses move', () => {
    const ppt = makeTestPPTJson();
    const oldPos = { x: 0.1, y: 0.1, width: 0.8, height: 0.2 };
    const newPos = { x: 0.5, y: 0.5, width: 0.8, height: 0.2 };
    const patch = createMovePatch('slide-1', 'block-1', oldPos, newPos);
    const updated = applyPatch(ppt, patch);
    const restored = reversePatch(updated, patch);

    expect(restored.slides[0].content[0].position).toEqual(oldPos);
  });
});

describe('applyPatch / reversePatch — delete_element', () => {
  it('deletes element', () => {
    const ppt = makeTestPPTJson();
    const block = ppt.slides[0].content[0];
    const patch = createDeleteElementPatch('slide-1', block);
    const result = applyPatch(ppt, patch);

    expect(result.slides[0].content).toHaveLength(1);
    expect(result.slides[0].content[0].id).toBe('block-2');
  });

  it('reverses delete (restores element)', () => {
    const ppt = makeTestPPTJson();
    const block = ppt.slides[0].content[0];
    const patch = createDeleteElementPatch('slide-1', block);
    const deleted = applyPatch(ppt, patch);
    const restored = reversePatch(deleted, patch);

    expect(restored.slides[0].content).toHaveLength(2);
    expect(restored.slides[0].content.find(b => b.id === 'block-1')).toBeDefined();
  });
});

describe('applyPatch / reversePatch — add_element', () => {
  it('adds element', () => {
    const ppt = makeTestPPTJson();
    const newBlock: ContentBlock = {
      id: 'block-3',
      type: 'text',
      content: 'New block',
      position: { x: 0.1, y: 0.7, width: 0.8, height: 0.2 },
    };
    const patch = createAddElementPatch('slide-1', newBlock);
    const result = applyPatch(ppt, patch);

    expect(result.slides[0].content).toHaveLength(3);
  });

  it('reverses add (removes element)', () => {
    const ppt = makeTestPPTJson();
    const newBlock: ContentBlock = {
      id: 'block-3',
      type: 'text',
      content: 'New block',
      position: { x: 0.1, y: 0.7, width: 0.8, height: 0.2 },
    };
    const patch = createAddElementPatch('slide-1', newBlock);
    const added = applyPatch(ppt, patch);
    const restored = reversePatch(added, patch);

    expect(restored.slides[0].content).toHaveLength(2);
  });
});

describe('applyPatch / reversePatch — resize_element', () => {
  it('applies resize', () => {
    const ppt = makeTestPPTJson();
    const oldPos = { x: 0.1, y: 0.1, width: 0.8, height: 0.2 };
    const newPos = { x: 0.1, y: 0.1, width: 0.4, height: 0.1 };
    const patch = createResizePatch('slide-1', 'block-1', oldPos, newPos);
    const result = applyPatch(ppt, patch);

    expect(result.slides[0].content[0].position).toEqual(newPos);
  });

  it('reverses resize', () => {
    const ppt = makeTestPPTJson();
    const oldPos = { x: 0.1, y: 0.1, width: 0.8, height: 0.2 };
    const newPos = { x: 0.1, y: 0.1, width: 0.4, height: 0.1 };
    const patch = createResizePatch('slide-1', 'block-1', oldPos, newPos);
    const updated = applyPatch(ppt, patch);
    const restored = reversePatch(updated, patch);

    expect(restored.slides[0].content[0].position).toEqual(oldPos);
  });
});

describe('applyPatch / reversePatch — replace_layout', () => {
  it('replaces slide layout', () => {
    const ppt = makeTestPPTJson();
    const patch = createReplaceLayoutPatch('slide-1', 'content', 'image');
    const result = applyPatch(ppt, patch);

    expect(result.slides[0].layout).toBe('image');
  });

  it('reverses layout replacement', () => {
    const ppt = makeTestPPTJson();
    const patch = createReplaceLayoutPatch('slide-1', 'content', 'image');
    const updated = applyPatch(ppt, patch);
    const restored = reversePatch(updated, patch);

    expect(restored.slides[0].layout).toBe('content');
  });

  it('ignores patch for non-existent slide', () => {
    const ppt = makeTestPPTJson();
    const patch = createReplaceLayoutPatch('nonexistent', 'content', 'image');
    const result = applyPatch(ppt, patch);

    expect(result).toEqual(ppt);
  });

  it('does not affect other slides', () => {
    const slide1 = { ...makeTestPPTJson().slides[0], id: 's1', layout: 'content' as const };
    const slide2 = { ...makeTestPPTJson().slides[0], id: 's2', layout: 'title' as const };
    const ppt = { ...makeTestPPTJson(), slides: [slide1, slide2] };
    const patch = createReplaceLayoutPatch('s1', 'content', 'chart');
    const result = applyPatch(ppt, patch);

    expect(result.slides[0].layout).toBe('chart');
    expect(result.slides[1].layout).toBe('title');
  });

  it('preserves title and content after layout change', () => {
    const ppt = makeTestPPTJson();
    const patch = createReplaceLayoutPatch('slide-1', 'content', 'quote');
    const result = applyPatch(ppt, patch);

    expect(result.slides[0].title).toBe('Test Slide');
    expect(result.slides[0].mainConclusion).toBe('Test conclusion');
    expect(result.slides[0].content).toHaveLength(2);
    expect(result.slides[0].content[0].content).toBe('Hello World');
  });
});

describe('edit-history', () => {
  it('starts with empty stacks', () => {
    const history = createEditHistory();
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });

  it('pushes patch and enables undo', () => {
    const patch = createUpdateTextPatch('s1', 'b1', 'old', 'new');
    let history = createEditHistory();
    history = pushPatch(history, patch);

    expect(canUndo(history)).toBe(true);
    expect(canRedo(history)).toBe(false);
  });

  it('undo returns the patch and moves to redo stack', () => {
    const patch = createUpdateTextPatch('s1', 'b1', 'old', 'new');
    let history = pushPatch(createEditHistory(), patch);
    const { history: h2, patch: undone } = undo(history);

    expect(undone).toBe(patch);
    expect(canUndo(h2)).toBe(false);
    expect(canRedo(h2)).toBe(true);
  });

  it('redo returns the patch and moves back to undo stack', () => {
    const patch = createUpdateTextPatch('s1', 'b1', 'old', 'new');
    let history = pushPatch(createEditHistory(), patch);
    const { history: h2 } = undo(history);
    const { history: h3, patch: redone } = redo(h2);

    expect(redone).toBe(patch);
    expect(canUndo(h3)).toBe(true);
    expect(canRedo(h3)).toBe(false);
  });

  it('new push clears redo stack', () => {
    const patch1 = createUpdateTextPatch('s1', 'b1', 'a', 'b');
    const patch2 = createUpdateTextPatch('s1', 'b1', 'b', 'c');
    let history = pushPatch(createEditHistory(), patch1);
    const { history: h2 } = undo(history);
    history = pushPatch(h2, patch2);

    expect(canUndo(history)).toBe(true);
    expect(canRedo(history)).toBe(false);
  });

  it('respects max history depth of 50', () => {
    let history = createEditHistory();
    for (let i = 0; i < 60; i++) {
      const patch = createUpdateTextPatch('s1', 'b1', `${i}`, `${i + 1}`);
      history = pushPatch(history, patch);
    }

    expect(history.undoStack).toHaveLength(50);
  });

  it('text update patch integrates with undo/redo on PPTJson', () => {
    const ppt = makeTestPPTJson();
    const patch = createUpdateTextPatch('slide-1', 'block-1', 'Hello World', 'New Title');
    const updated = applyPatch(ppt, patch);

    expect(updated.slides[0].content[0].content).toBe('New Title');

    let history = createEditHistory();
    history = pushPatch(history, patch);
    expect(canUndo(history)).toBe(true);

    const { patch: undone } = undo(history);
    expect(undone).not.toBeNull();
    const restored = reversePatch(updated, undone!);
    expect(restored.slides[0].content[0].content).toBe('Hello World');
  });

  it('add_element integrates with undo/redo on PPTJson', () => {
    const ppt = makeTestPPTJson();
    const newBlock: ContentBlock = {
      id: 'block-new',
      type: 'text',
      content: 'Added via asset',
      position: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
    };
    const patch = createAddElementPatch('slide-1', newBlock);
    const added = applyPatch(ppt, patch);
    expect(added.slides[0].content).toHaveLength(3);

    let history = createEditHistory();
    history = pushPatch(history, patch);
    expect(canUndo(history)).toBe(true);

    const { patch: undone } = undo(history);
    expect(undone).not.toBeNull();
    const restored = reversePatch(added, undone!);
    expect(restored.slides[0].content).toHaveLength(2);
  });

  it('replace_layout integrates with undo/redo on PPTJson', () => {
    const ppt = makeTestPPTJson();
    const patch = createReplaceLayoutPatch('slide-1', 'content', 'image');
    const updated = applyPatch(ppt, patch);
    expect(updated.slides[0].layout).toBe('image');

    let history = createEditHistory();
    history = pushPatch(history, patch);
    expect(canUndo(history)).toBe(true);

    const { patch: undone } = undo(history);
    expect(undone).not.toBeNull();
    const restored = reversePatch(updated, undone!);
    expect(restored.slides[0].layout).toBe('content');
  });
});
