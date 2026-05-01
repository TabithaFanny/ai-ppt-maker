/**
 * Tests for lib/layout-resolver.ts — Layout fallback and zone resolution
 */

import { chooseLayoutForRole, resolveLayoutPlan, snapToZone, findHoveredZone } from '../lib/layout-resolver';
import type { ContentBlock } from '../types/elements';
import type { SlideRole } from '../types/stylekit';

describe('chooseLayoutForRole', () => {
  it('returns hero for cover role', () => {
    expect(chooseLayoutForRole('cover')).toBe('hero');
  });

  it('returns two-column for content role', () => {
    expect(chooseLayoutForRole('content')).toBe('two-column');
  });

  it('returns centered for section-header', () => {
    expect(chooseLayoutForRole('section-header')).toBe('centered');
  });

  it('returns full-bleed for image-focus', () => {
    expect(chooseLayoutForRole('image-focus')).toBe('full-bleed');
  });

  it('returns data-chart for data-display', () => {
    expect(chooseLayoutForRole('data-display')).toBe('data-chart');
  });

  it('returns quote for quote role', () => {
    expect(chooseLayoutForRole('quote')).toBe('quote');
  });

  it('returns comparison for comparison role', () => {
    expect(chooseLayoutForRole('comparison')).toBe('comparison');
  });

  it('returns centered for closing', () => {
    expect(chooseLayoutForRole('closing')).toBe('centered');
  });

  it('returns grid for toc', () => {
    expect(chooseLayoutForRole('toc')).toBe('grid');
  });

  it('returns grid for summary', () => {
    expect(chooseLayoutForRole('summary')).toBe('grid');
  });
});

describe('resolveLayoutPlan', () => {
  it('returns a valid LayoutPlan for cover role', () => {
    const plan = resolveLayoutPlan('slide-1', 'cover', []);
    expect(plan.slideId).toBe('slide-1');
    expect(plan.slideRole).toBe('cover');
    expect(plan.layoutType).toBe('hero');
    expect(plan.zones.length).toBeGreaterThan(0);
  });

  it('assigns blocks to zones', () => {
    const blocks: ContentBlock[] = [
      { id: 'b1', type: 'text', content: 'Title', position: { x: 0.1, y: 0.2, width: 0.8, height: 0.2 } },
      { id: 'b2', type: 'text', content: 'Body', position: { x: 0.1, y: 0.5, width: 0.8, height: 0.3 } },
    ];
    const plan = resolveLayoutPlan('slide-1', 'content', blocks);

    const occupied = plan.zones.filter(z => z.isOccupied);
    expect(occupied.length).toBeGreaterThanOrEqual(1);
  });

  it('uses layoutTypeOverride when provided', () => {
    const plan = resolveLayoutPlan('slide-1', 'content', [], null, 'grid');
    expect(plan.layoutType).toBe('grid');
  });

  it('returns zones for all 10 layout types', () => {
    const layoutTypes = ['hero', 'two-column', 'grid', 'centered', 'full-bleed', 'quote', 'data-chart', 'comparison', 'timeline', 'gallery'];
    for (const lt of layoutTypes) {
      const plan = resolveLayoutPlan('slide-1', 'content', [], null, lt as any);
      expect(plan.zones.length).toBeGreaterThan(0);
    }
  });
});

describe('snapToZone', () => {
  it('snaps element near zone center', () => {
    const zones = [
      { id: 'z1', name: 'Zone 1', position: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 }, contentType: 'text' as const, isOccupied: false },
    ];
    const elementPos = { x: 0.15, y: 0.15, width: 0.2, height: 0.2 };
    const result = snapToZone(elementPos, zones);

    expect(result).not.toBeNull();
    expect(result!.zoneId).toBe('z1');
  });

  it('returns null when element is far from all zones', () => {
    const zones = [
      { id: 'z1', name: 'Zone 1', position: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 }, contentType: 'text' as const, isOccupied: false },
    ];
    const elementPos = { x: 0.8, y: 0.8, width: 0.1, height: 0.1 };
    const result = snapToZone(elementPos, zones, 0.05);

    expect(result).toBeNull();
  });
});

describe('findHoveredZone', () => {
  it('finds zone under element center', () => {
    const zones = [
      { id: 'z1', name: 'Zone 1', position: { x: 0, y: 0, width: 0.5, height: 0.5 }, contentType: 'text' as const, isOccupied: false },
      { id: 'z2', name: 'Zone 2', position: { x: 0.5, y: 0, width: 0.5, height: 0.5 }, contentType: 'text' as const, isOccupied: false },
    ];
    const result = findHoveredZone({ x: 0.6, y: 0.1, width: 0.1, height: 0.1 }, zones);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('z2');
  });

  it('returns null when element center is outside all zones', () => {
    const zones = [
      { id: 'z1', name: 'Zone 1', position: { x: 0, y: 0, width: 0.3, height: 0.3 }, contentType: 'text' as const, isOccupied: false },
    ];
    const result = findHoveredZone({ x: 0.8, y: 0.8, width: 0.1, height: 0.1 }, zones);

    expect(result).toBeNull();
  });
});
