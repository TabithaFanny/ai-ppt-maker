/**
 * Tests for lib/render-style.ts — StyleKit → CSS vars / PPTX config
 */

import { styleKitToCSSVars, styleKitToPptxConfig, styleConfigToPptxConfig, resolvePptxConfig } from '../lib/render-style';
import { createEmptyStyleKit, createEmptyStyleDNA } from '../types/stylekit';

function makeTestStyleKit() {
  const dna = createEmptyStyleDNA('dna-1', 'Test DNA', 'file-1');
  dna.palette = {
    primary: '#ff0000',
    secondary: '#00ff00',
    accent: '#0000ff',
    background: '#ffffff',
    text: '#333333',
  };
  dna.typography = {
    titleFont: 'Georgia',
    bodyFont: 'Calibri',
    titleSize: 40,
    subtitleSize: 28,
    bodySize: 16,
    captionSize: 12,
  };
  dna.spacing = {
    slidePadding: 30,
    contentMargin: 15,
    elementGap: 10,
  };
  dna.effects = {
    shadowEnabled: true,
    shadowType: 'soft',
    borderRadius: 8,
    gradientEnabled: false,
  };
  return createEmptyStyleKit('sk-1', 'Test Kit', 'file-1', dna);
}

describe('styleKitToCSSVars', () => {
  it('maps palette colors to CSS variables', () => {
    const kit = makeTestStyleKit();
    const vars = styleKitToCSSVars(kit);

    expect(vars['--sk-primary']).toBe('#ff0000');
    expect(vars['--sk-secondary']).toBe('#00ff00');
    expect(vars['--sk-accent']).toBe('#0000ff');
    expect(vars['--sk-background']).toBe('#ffffff');
    expect(vars['--sk-text']).toBe('#333333');
  });

  it('maps typography with font fallbacks', () => {
    const kit = makeTestStyleKit();
    const vars = styleKitToCSSVars(kit);

    expect(vars['--sk-title-font']).toContain('Georgia');
    expect(vars['--sk-title-font']).toContain('PingFang SC');
    expect(vars['--sk-body-font']).toContain('Calibri');
  });

  it('maps font sizes as pt values', () => {
    const kit = makeTestStyleKit();
    const vars = styleKitToCSSVars(kit);

    expect(vars['--sk-title-size']).toBe('40pt');
    expect(vars['--sk-body-size']).toBe('16pt');
  });

  it('maps spacing to px values', () => {
    const kit = makeTestStyleKit();
    const vars = styleKitToCSSVars(kit);

    expect(vars['--sk-slide-padding']).toBe('30px');
    expect(vars['--sk-element-gap']).toBe('10px');
  });

  it('maps effects correctly', () => {
    const kit = makeTestStyleKit();
    const vars = styleKitToCSSVars(kit);

    expect(vars['--sk-border-radius']).toBe('8px');
    expect(vars['--sk-shadow']).toBe('0 2px 8px rgba(0,0,0,0.1)');
  });
});

describe('styleKitToPptxConfig', () => {
  it('maps StyleKit to PPTX config', () => {
    const kit = makeTestStyleKit();
    const config = styleKitToPptxConfig(kit);

    expect(config.backgroundColor).toBe('#ffffff');
    expect(config.titleFontFace).toBe('Georgia');
    expect(config.titleFontSize).toBe(40);
    expect(config.bodyFontFace).toBe('Calibri');
    expect(config.bodyFontSize).toBe(16);
    expect(config.titleBold).toBe(true);
    expect(config.bodyBold).toBe(false);
  });
});

describe('resolvePptxConfig', () => {
  it('returns StyleKit config when StyleKit provided', () => {
    const kit = makeTestStyleKit();
    const config = resolvePptxConfig({ styleKit: kit });

    expect(config).not.toBeNull();
    expect(config!.titleFontFace).toBe('Georgia');
  });

  it('returns null when neither StyleKit nor StyleConfig provided', () => {
    const config = resolvePptxConfig({});
    expect(config).toBeNull();
  });
});
