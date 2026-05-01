/**
 * Tests for lib/text-diff.ts
 */

import { computeTextDiff, formatPosition } from '../lib/text-diff';

describe('computeTextDiff', () => {
  it('returns single same segment for identical strings', () => {
    const result = computeTextDiff('hello', 'hello');
    expect(result).toEqual([{ text: 'hello', type: 'same' }]);
  });

  it('detects removed text', () => {
    const result = computeTextDiff('hello world', 'hello');
    const removed = result.filter((s) => s.type === 'removed');
    expect(removed.length).toBeGreaterThan(0);
    expect(removed.some((s) => s.text.includes('world'))).toBe(true);
  });

  it('detects added text', () => {
    const result = computeTextDiff('hello', 'hello world');
    const added = result.filter((s) => s.type === 'added');
    expect(added.length).toBeGreaterThan(0);
    expect(added.some((s) => s.text.includes('world'))).toBe(true);
  });

  it('detects changed text', () => {
    const result = computeTextDiff('hello', 'jello');
    // Should have at least some removed and added parts
    const types = result.map((s) => s.type);
    expect(types).toContain('removed');
    expect(types).toContain('added');
  });

  it('handles completely different strings', () => {
    const result = computeTextDiff('abc', 'xyz');
    expect(result.length).toBeGreaterThanOrEqual(1);
    const removed = result.filter((s) => s.type === 'removed');
    const added = result.filter((s) => s.type === 'added');
    expect(removed.length + added.length).toBeGreaterThan(0);
  });

  it('handles empty strings', () => {
    const result1 = computeTextDiff('', '');
    expect(result1).toEqual([{ text: '', type: 'same' }]);

    const result2 = computeTextDiff('', 'new');
    expect(result2.some((s) => s.type === 'added')).toBe(true);

    const result3 = computeTextDiff('old', '');
    expect(result3.some((s) => s.type === 'removed')).toBe(true);
  });

  it('handles Chinese text', () => {
    const result = computeTextDiff('你好世界', '你好朋友');
    expect(result.length).toBeGreaterThan(0);
    // '你好' should be same
    expect(result.some((s) => s.type === 'same' && s.text.includes('你好'))).toBe(true);
  });
});

describe('formatPosition', () => {
  it('formats position as percentage string', () => {
    const result = formatPosition({ x: 0.1, y: 0.2, width: 0.5, height: 0.3 });
    expect(result).toBe('10%, 20% · 50×30%');
  });

  it('rounds to integers', () => {
    const result = formatPosition({ x: 0.156, y: 0.891, width: 0.333, height: 0.667 });
    expect(result).toBe('16%, 89% · 33×67%');
  });
});
