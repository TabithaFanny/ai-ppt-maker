'use client';

import { useState, useEffect } from 'react';
import { assetStorage } from '@/lib/asset-storage';
import { ExtractedAsset } from '@/lib/resource-extractor';
import { AssetLibraryItem } from '@/lib/asset-storage';
import { Search, X, Image, Grid, List } from 'lucide-react';
import NextImage from 'next/image';

interface AssetLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onAssetSelect: (asset: AssetLibraryItem) => void;
  projectId?: string;
}

const ASSET_TYPE_LABELS: Record<ExtractedAsset['type'], string> = {
  icon: '图标',
  background: '背景',
  decoration: '装饰',
  chart: '图表',
  device: '设备',
};

export default function AssetLibrary({ isOpen, onClose, onAssetSelect, projectId }: AssetLibraryProps) {
  const [activeType, setActiveType] = useState<ExtractedAsset['type'] | 'all'>('all');
  const [assets, setAssets] = useState<AssetLibraryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const loadAssets = async () => {
    try {
      const items = await assetStorage.getAssets({
        type: activeType === 'all' ? undefined : activeType as ExtractedAsset['type'],
        projectId,
      });
      setAssets(items);
    } catch (error) {
      console.error('Failed to load assets:', error);
    }
  };  useEffect(() => {
    if (isOpen) {
      loadAssets();
    }
  }, [isOpen, activeType, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredAssets = searchQuery
    ? assets.filter(a =>
        a.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
        a.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : assets;

  const handleAssetClick = (asset: AssetLibraryItem) => {
    assetStorage.incrementUsage(asset.id);
    onAssetSelect(asset);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white border-l shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">资源库</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded"
            aria-label="关闭"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索资源..."
            className="w-full pl-9 pr-4 py-2 border rounded text-sm"
          />
        </div>
      </div>

      {/* Type filter tabs */}
      <div className="border-b">
        <div className="flex flex-wrap">
          {(['all', 'icon', 'background', 'decoration', 'chart', 'device'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`px-3 py-2 text-sm ${
                activeType === type
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {type === 'all' ? '全部' : ASSET_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* View mode toggle */}
      <div className="p-2 border-b flex justify-end">
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-gray-100' : ''}`}
            aria-label="网格视图"
          >
            <Grid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-gray-100' : ''}`}
            aria-label="列表视图"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Assets list */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredAssets.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Image size={48} className="mx-auto mb-2 text-gray-300" aria-hidden="true" />
            <p>暂无资源</p>
            <p className="text-sm">上传 PPT 模板后自动提取</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-2">
            {filteredAssets.map((asset) => (
              <button
                key={asset.id}
                onClick={() => handleAssetClick(asset)}
                className="p-2 border rounded hover:bg-gray-50 text-left"
              >
                <div className="aspect-square bg-gray-100 rounded mb-2 flex items-center justify-center overflow-hidden relative">
                  {asset.thumbnail ? (
                    <NextImage src={asset.thumbnail} alt={asset.category} fill className="object-contain" unoptimized />
                  ) : (
                    <Image size={24} className="text-gray-400" aria-hidden="true" />
                  )}
                </div>
                <p className="text-xs truncate">{asset.category}</p>
                <p className="text-xs text-gray-500">{ASSET_TYPE_LABELS[asset.type]}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAssets.map((asset) => (
              <button
                key={asset.id}
                onClick={() => handleAssetClick(asset)}
                className="w-full p-2 border rounded hover:bg-gray-50 flex items-center gap-3"
              >
                <div className="w-12 h-12 bg-gray-100 rounded flex-shrink-0 flex items-center justify-center overflow-hidden relative">
                  {asset.thumbnail ? (
                    <NextImage src={asset.thumbnail} alt={asset.category} fill className="object-contain" unoptimized />
                  ) : (
                    <Image size={20} className="text-gray-400" aria-hidden="true" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">{asset.category}</p>
                  <p className="text-xs text-gray-500">{ASSET_TYPE_LABELS[asset.type]}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="p-3 border-t text-xs text-gray-500">
        共 {filteredAssets.length} 个资源
      </div>
    </div>
  );
}
