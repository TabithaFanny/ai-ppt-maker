/**
 * Tests for lib/auto-fixer.ts
 */

import { autoFixSlide, autoFixPPTJson, autoFixSlideRealtime } from '../lib/auto-fixer';
import type { PPTJson, Slide, ContentBlock } from '../types';
import type { ResidualIssue } from '../types/generation';

function makeSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    id: 'slide-1',
    layout: 'content',
    title: 'Test Title',
    mainConclusion: 'Test Conclusion',
    content: [
      { id: 'b1', type: 'text', content: 'Hello', position: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 } },
    ],
    ...overrides,
  };
}

function makePPTJson(slides: Slide[]): PPTJson {
  return {
    metadata: { projectId: 'p1', title: 'Test', category: 'test', audience: 'general', createdAt: new Date().toISOString() },
    designSystem: {
      palette: { primary: '#000', secondary: '#fff', accent: '#f00', background: '#fff', text: '#000' },
      typography: { titleFont: 'Arial', bodyFont: 'Helvetica', titleSize: 44, bodySize: 18 },
    },
    roles: { designer: 'test', contentStrategist: 'test', visualDirector: 'test' },
    slides,
  };
}

describe('autoFixSlide', () => {
  it('fixes empty title by extracting from content', () => {
    const slide = makeSlide({ title: '' });
    const issues: ResidualIssue[] = [
      { type: 'empty_block', severity: 'high', description: '幻灯片标题为空' },
    ];
    const { slide: fixed } = autoFixSlide(slide, issues);

    expect(fixed.title).toBeTruthy();
    expect(fixed.title.length).toBeLessThanOrEqual(50);
  });

  it('fixes empty conclusion from content', () => {
    const slide = makeSlide({ mainConclusion: '' });
    const issues: ResidualIssue[] = [
      { type: 'empty_block', severity: 'medium', description: '缺少核心结论' },
    ];
    const { slide: fixed } = autoFixSlide(slide, issues);

    expect(fixed.mainConclusion).toBeTruthy();
  });

  it('removes empty content blocks', () => {
    const slide = makeSlide({
      content: [
        { id: 'b1', type: 'text', content: 'Has content', position: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 } },
        { id: 'b2', type: 'text', content: '', position: { x: 0.1, y: 0.4, width: 0.8, height: 0.2 } },
      ],
    });
    const issues: ResidualIssue[] = [
      { type: 'empty_block', severity: 'high', description: '内容块 2 为空' },
    ];
    const { slide: fixed } = autoFixSlide(slide, issues);

    expect(fixed.content).toHaveLength(1);
    expect(fixed.content[0].id).toBe('b1');
  });

  it('clamps out-of-bounds positions', () => {
    const slide = makeSlide({
      content: [
        { id: 'b1', type: 'text', content: 'Hello', position: { x: 0.9, y: 0.9, width: 0.3, height: 0.3 } },
      ],
    });
    const { slide: fixed } = autoFixSlide(slide, []);

    expect(fixed.content[0].position.x + fixed.content[0].position.width).toBeLessThanOrEqual(1.0);
    expect(fixed.content[0].position.y + fixed.content[0].position.height).toBeLessThanOrEqual(1.0);
  });

  it('does not modify slide with no issues', () => {
    const slide = makeSlide();
    const { slide: fixed, fixes } = autoFixSlide(slide, []);

    expect(fixed.title).toBe('Test Title');
    expect(fixes).toHaveLength(0);
  });
});

describe('autoFixPPTJson', () => {
  it('fixes multiple slides', () => {
    const slide1 = makeSlide({ id: 's1', title: '' });
    const slide2 = makeSlide({ id: 's2', title: 'Good Title' });
    const ppt = makePPTJson([slide1, slide2]);
    const issues: ResidualIssue[] = [
      { type: 'empty_block', severity: 'high', description: '幻灯片标题为空', slideId: 's1' },
    ];
    const { pptJson: fixed, result } = autoFixPPTJson(ppt, issues);

    expect(fixed.slides[0].title).toBeTruthy();
    expect(fixed.slides[1].title).toBe('Good Title');
    expect(result.fixed).toBeGreaterThanOrEqual(1);
  });
});

describe('autoFixSlideRealtime', () => {
  it('clamps out-of-bounds positions', () => {
    const slide = makeSlide({
      content: [
        { id: 'b1', type: 'text', content: 'Hello', position: { x: 0.9, y: 0.9, width: 0.3, height: 0.3 } },
      ],
    });
    const { slide: fixed, changed } = autoFixSlideRealtime(slide);

    expect(changed).toBe(true);
    expect(fixed.content[0].position.x + fixed.content[0].position.width).toBeLessThanOrEqual(1.0);
  });

  it('recovers empty title from content', () => {
    const slide = makeSlide({ title: '' });
    const { slide: fixed, changed } = autoFixSlideRealtime(slide);

    expect(changed).toBe(true);
    expect(fixed.title).toBeTruthy();
  });

  it('returns changed=false for valid slide', () => {
    const slide = makeSlide();
    const { slide: fixed, changed } = autoFixSlideRealtime(slide);

    expect(changed).toBe(false);
    expect(fixed.title).toBe('Test Title');
  });

  it('does not remove empty blocks (non-destructive)', () => {
    const slide = makeSlide({
      content: [
        { id: 'b1', type: 'text', content: 'Has content', position: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 } },
        { id: 'b2', type: 'text', content: '', position: { x: 0.1, y: 0.4, width: 0.8, height: 0.2 } },
      ],
    });
    const { slide: fixed } = autoFixSlideRealtime(slide);

    // Empty blocks are preserved (non-destructive)
    expect(fixed.content).toHaveLength(2);
  });

  it('preserves locked elements — does not modify their position', () => {
    const slide = makeSlide({
      content: [
        { id: 'b1', type: 'text', content: 'Locked content', position: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 }, locked: true },
      ],
    });
    const { slide: fixed, changed } = autoFixSlideRealtime(slide);

    // Locked elements with valid positions should not be touched
    expect(changed).toBe(false);
    expect(fixed.content[0].position).toEqual({ x: 0.1, y: 0.1, width: 0.8, height: 0.2 });
    expect(fixed.content[0].locked).toBe(true);
  });

  it('clamps locked elements if out-of-bounds (safety override)', () => {
    const slide = makeSlide({
      content: [
        { id: 'b1', type: 'text', content: 'Locked', position: { x: 0.9, y: 0.9, width: 0.3, height: 0.3 }, locked: true },
      ],
    });
    const { slide: fixed, changed } = autoFixSlideRealtime(slide);

    // Safety clamp applies even to locked elements
    expect(changed).toBe(true);
    expect(fixed.content[0].position.x + fixed.content[0].position.width).toBeLessThanOrEqual(1.0);
    // But locked flag is preserved
    expect(fixed.content[0].locked).toBe(true);
  });

  it('does not move valid in-bounds elements', () => {
    const slide = makeSlide({
      content: [
        { id: 'b1', type: 'text', content: 'A', position: { x: 0.05, y: 0.05, width: 0.4, height: 0.1 } },
        { id: 'b2', type: 'text', content: 'B', position: { x: 0.5, y: 0.5, width: 0.4, height: 0.1 } },
      ],
    });
    const { slide: fixed, changed } = autoFixSlideRealtime(slide);

    expect(changed).toBe(false);
    expect(fixed.content[0].position).toEqual({ x: 0.05, y: 0.05, width: 0.4, height: 0.1 });
    expect(fixed.content[1].position).toEqual({ x: 0.5, y: 0.5, width: 0.4, height: 0.1 });
  });

  it('preserves all content fields unchanged when no fix needed', () => {
    const slide = makeSlide({
      content: [
        { id: 'b1', type: 'text', content: 'Exact', position: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 } },
      ],
    });
    const { slide: fixed, changed } = autoFixSlideRealtime(slide);

    expect(changed).toBe(false);
    expect(fixed.content[0].id).toBe('b1');
    expect(fixed.content[0].type).toBe('text');
    expect(fixed.content[0].content).toBe('Exact');
  });

  it('clamps negative positions to zero', () => {
    const slide = makeSlide({
      content: [
        { id: 'b1', type: 'text', content: 'Hello', position: { x: -0.1, y: -0.2, width: 0.5, height: 0.3 } },
      ],
    });
    const { slide: fixed, changed } = autoFixSlideRealtime(slide);

    expect(changed).toBe(true);
    expect(fixed.content[0].position.x).toBe(0);
    expect(fixed.content[0].position.y).toBe(0);
  });
});
