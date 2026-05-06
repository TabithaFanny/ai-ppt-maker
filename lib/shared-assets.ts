/**
 * 共享资产生成管线
 *
 * 从 MasterTemplate 生成可复用的视觉资产：
 * - 统一背景图（透明 PNG）
 * - 装饰元素
 * - Logo 占位
 *
 * 当图片 API 不可用时，返回 CSS 渐变 fallback 描述。
 */

import type { MasterTemplate } from '@/types';

export interface SharedAsset {
  id: string;
  name: string;
  type: 'background' | 'decoration' | 'logo';
  prompt: string;
  imageUrl?: string;
  cssGradient?: string;
  status: 'pending' | 'generating' | 'done' | 'failed';
}

/**
 * Build generation prompts from MasterTemplate
 * Returns asset descriptors ready for image generation
 */
export function buildAssetPrompts(master: MasterTemplate): SharedAsset[] {
  const assets: SharedAsset[] = [];

  // Background asset
  if (master.background) {
    const bg = master.background;
    const colorStr = bg.colors.join(' → ');
    assets.push({
      id: `asset-bg-${Date.now()}`,
      name: '统一背景',
      type: 'background',
      prompt: `A presentation slide background, ${bg.type} style, colors: ${colorStr}. ${bg.description}. No text, no content, just the background pattern/gradient. Clean, professional, 16:9 aspect ratio.`,
      cssGradient: bg.type === 'gradient' && bg.colors.length >= 2
        ? `linear-gradient(135deg, ${bg.colors.join(', ')})`
        : undefined,
      status: 'pending',
    });
  }

  // Decoration assets
  for (const dec of master.sharedDecorations) {
    if (dec.type === 'logo') continue; // Logo handled separately
    assets.push({
      id: `asset-dec-${dec.type}-${dec.position}-${Date.now()}`,
      name: `${dec.type} (${dec.position})`,
      type: 'decoration',
      prompt: `A decorative element for presentation slides: ${dec.description || dec.type}. Position: ${dec.position}. Transparent background (PNG). Colors: ${master.colorSystem.primary}, ${master.colorSystem.accent}. Clean vector style.`,
      status: 'pending',
    });
  }

  return assets;
}

/**
 * Generate a single shared asset image
 * Falls back to CSS gradient when image API is unavailable
 */
export async function generateAssetImage(asset: SharedAsset): Promise<SharedAsset> {
  try {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: asset.prompt,
        model: 'gpt-image-2',
        size: '1792x1024',
        response_format: 'url',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[SharedAssets] Image generation failed:', err);
      return { ...asset, status: 'failed' };
    }

    const data = await res.json();
    const imageUrl = data.data?.imageUrl || data.imageUrl;
    return { ...asset, imageUrl, status: 'done' };
  } catch (err) {
    console.warn('[SharedAssets] Image generation error:', err);
    return { ...asset, status: 'failed' };
  }
}
