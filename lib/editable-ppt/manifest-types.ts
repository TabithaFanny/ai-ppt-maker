/**
 * EditablePptManifest — 与 bggg-creator-image2ppt 的 manifest.json 格式对齐。
 *
 * 这是 GenSlidePrompt/GenSlideResult 与 Python PPTX 渲染器之间的中间层。
 * 坐标系：像素，基于 canvas (默认 1600×900)。
 * 元素顺序：从底到顶（z-order）。
 */

// ── Deck-level metadata ──

export interface ManifestDeck {
  name: string;
  canvas_width: number;   // px, default 1600
  canvas_height: number;  // px, default 900
  slide_width_in: number; // inches, default 13.333
}

// ── Element types ──

export interface ManifestBackgroundElement {
  kind: 'background';
  fill?: string;          // hex color
  file?: string;          // path relative to manifest dir
}

export interface ManifestTextElement {
  kind: 'text';
  name?: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  font_size_px?: number;
  font_family?: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  valign?: 'top' | 'middle' | 'bottom';
  line_spacing?: number;
}

export interface ManifestImageElement {
  kind: 'image';
  name?: string;
  file: string;           // path relative to manifest dir
  x: number;
  y: number;
  w: number;
  h: number;
  fit?: 'stretch' | 'contain' | 'cover';
}

export interface ManifestShapeElement {
  kind: 'shape';
  shape: 'rect' | 'roundRect' | 'ellipse' | 'circle' | 'line';
  name?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  stroke?: string;
  stroke_width_px?: number;
}

export interface ManifestTableElement {
  kind: 'table';
  name?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rows: string[][];
  font_size_px?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

export type ManifestElement =
  | ManifestBackgroundElement
  | ManifestTextElement
  | ManifestImageElement
  | ManifestShapeElement
  | ManifestTableElement;

// ── Slide ──

export interface ManifestSlide {
  name: string;
  elements: ManifestElement[];
}

// ── Root manifest ──

export interface EditablePptManifest {
  deck: ManifestDeck;
  slides: ManifestSlide[];
}

// ── Defaults ──

export const DEFAULT_CANVAS_WIDTH = 1600;
export const DEFAULT_CANVAS_HEIGHT = 900;
export const DEFAULT_SLIDE_WIDTH_IN = 13.333;
