/**
 * 风格包导入导出
 *
 * StylePack = masterTemplate + referenceSlidePrompts 打包为 .json
 * 用户可导出当前项目的风格分析结果，分享给他人直接导入复用。
 */

import type { MasterTemplate, RefSlidePrompt } from '@/types';

export const STYLE_PACK_VERSION = 1;

export interface StylePack {
  version: number;
  name: string;
  description: string;
  createdAt: string;
  masterTemplate: MasterTemplate;
  referenceSlidePrompts: RefSlidePrompt[];
  thumbnails?: string[];
}

/**
 * 从当前 workbench 状态导出风格包
 */
export function exportStylePack(
  name: string,
  description: string,
  masterTemplate: MasterTemplate,
  referenceSlidePrompts: RefSlidePrompt[],
  thumbnails?: string[],
): StylePack {
  return {
    version: STYLE_PACK_VERSION,
    name,
    description,
    createdAt: new Date().toISOString(),
    masterTemplate,
    referenceSlidePrompts,
    thumbnails,
  };
}

/**
 * 下载风格包为 JSON 文件
 */
export function downloadStylePack(pack: StylePack): void {
  const json = JSON.stringify(pack, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pack.name.replace(/\s+/g, '-')}-style-pack.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 解析导入的风格包 JSON
 * 返回 null 如果格式无效
 */
export function parseStylePack(jsonStr: string): StylePack | null {
  try {
    const data = JSON.parse(jsonStr);
    if (!data.version || !data.masterTemplate || !data.referenceSlidePrompts) {
      return null;
    }
    if (data.version > STYLE_PACK_VERSION) {
      console.warn('[StylePack] Version mismatch:', data.version, '>', STYLE_PACK_VERSION);
    }
    return data as StylePack;
  } catch {
    return null;
  }
}

/**
 * 从 File 对象读取风格包
 */
export function readStylePackFile(file: File): Promise<StylePack | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      resolve(parseStylePack(text));
    };
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}
