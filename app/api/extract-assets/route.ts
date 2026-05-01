import { NextRequest } from 'next/server';
import { extractAssetsFromTemplate } from '@/lib/resource-extractor';
import { assetStorage } from '@/lib/asset-storage';
import { StyleConfig } from '@/types';
import { ok, fail } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const { fileId, projectId, styleConfig } = await request.json();

    if (!fileId) {
      return fail('缺少 fileId', 400);
    }

    const result = await extractAssetsFromTemplate(
      fileId,
      styleConfig as StyleConfig | undefined
    );

    if (result.assets.length > 0) {
      await assetStorage.saveAssets(fileId, result.assets, projectId);
    }

    return ok({
      assetCount: result.assets.length,
      totalSlides: result.totalSlides,
    });
  } catch (error) {
    console.error('资产提取失败:', error);
    return fail(error instanceof Error ? error.message : '资产提取失败');
  }
}
