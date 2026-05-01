import Dexie, { Table } from 'dexie';
import { ExtractedAsset } from './resource-extractor';

// Asset library stored in IndexedDB
export interface AssetLibraryItem extends ExtractedAsset {
  projectId?: string; // Optional - assets can be project-specific or global
}

class AssetDatabase extends Dexie {
  assets!: Table<AssetLibraryItem>;
  extractionHistory!: Table<{ id: string; fileId: string; extractedAt: number; assetCount: number }>;

  constructor() {
    super('ai-ppt-generator-assets');
    this.version(1).stores({
      assets: 'id, type, category, sourceFileId, projectId, extractedAt',
      extractionHistory: 'id, fileId, extractedAt',
    });
  }
}

export const assetDb = new AssetDatabase();

// Asset storage service
export const assetStorage = {
  // Save extracted assets
  async saveAssets(fileId: string, assets: ExtractedAsset[], projectId?: string): Promise<void> {
    const items: AssetLibraryItem[] = assets.map(asset => ({
      ...asset,
      projectId,
    }));

    await assetDb.assets.bulkAdd(items);

    // Record extraction history
    await assetDb.extractionHistory.add({
      id: crypto.randomUUID(),
      fileId,
      extractedAt: Date.now(),
      assetCount: assets.length,
    });
  },

  // Get all assets, optionally filtered by type
  async getAssets(options?: {
    type?: ExtractedAsset['type'];
    projectId?: string;
    limit?: number;
  }): Promise<AssetLibraryItem[]> {
    let query = assetDb.assets.toCollection();

    if (options?.type) {
      query = assetDb.assets.where('type').equals(options.type);
    }

    let results = await query.toArray();

    if (options?.projectId) {
      results = results.filter(a => a.projectId === options.projectId || !a.projectId);
    }

    // Sort by usage count (most used first)
    results.sort((a, b) => b.usageCount - a.usageCount);

    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  },

  // Get assets grouped by type
  async getAssetsByType(projectId?: string): Promise<Record<ExtractedAsset['type'], AssetLibraryItem[]>> {
    const assets = await this.getAssets({ projectId });

    return {
      icon: assets.filter(a => a.type === 'icon'),
      background: assets.filter(a => a.type === 'background'),
      decoration: assets.filter(a => a.type === 'decoration'),
      chart: assets.filter(a => a.type === 'chart'),
      device: assets.filter(a => a.type === 'device'),
    };
  },

  // Increment usage count for an asset
  async incrementUsage(assetId: string): Promise<void> {
    const asset = await assetDb.assets.get(assetId);
    if (asset) {
      await assetDb.assets.update(assetId, {
        usageCount: (asset.usageCount || 0) + 1,
      });
    }
  },

  // Delete assets by fileId
  async deleteByFileId(fileId: string): Promise<void> {
    await assetDb.assets.where('sourceFileId').equals(fileId).delete();
  },

  // Search assets by tags
  async searchAssets(query: string, projectId?: string): Promise<AssetLibraryItem[]> {
    const assets = await this.getAssets({ projectId });
    const lowerQuery = query.toLowerCase();

    return assets.filter(asset =>
      asset.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      asset.category.toLowerCase().includes(lowerQuery)
    );
  },

  // Get extraction history
  async getExtractionHistory(): Promise<{ id: string; fileId: string; extractedAt: number; assetCount: number }[]> {
    return assetDb.extractionHistory.orderBy('extractedAt').reverse().toArray();
  },

  // Clear all assets (for testing)
  async clearAll(): Promise<void> {
    await assetDb.assets.clear();
    await assetDb.extractionHistory.clear();
  },
};
