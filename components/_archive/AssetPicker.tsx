'use client';

import { useState, useEffect } from 'react';
import { assetStorage } from '@/lib/asset-storage';
import { ExtractedAsset } from '@/lib/resource-extractor';
import { AssetLibraryItem } from '@/lib/asset-storage';
import { Image, Search, Check } from 'lucide-react';

interface AssetPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onAssetPicked: (asset: AssetLibraryItem, position: { x: number; y: number; width: number; height: number }) => void;
  projectId?: string;
}

export default function AssetPicker({ isOpen, onClose, onAssetPicked, projectId }: AssetPickerProps) {
  const [assets, setAssets] = useState<AssetLibraryItem[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AssetLibraryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadAssets();
    }
  }, [isOpen, projectId]);

  const loadAssets = async () => {
    try {
      const items = await assetStorage.getAssets({ projectId });
      setAssets(items);
    } catch (error) {
      console.error('Failed to load assets:', error);
    }
  };

  const handleInsert = () => {
    if (selectedAsset) {
      // Default position in center of slide (normalized 0-1 coordinates)
      const defaultPosition = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
      onAssetPicked(selectedAsset, defaultPosition);
      onClose();
    }
  };

  const filteredAssets = searchQuery
    ? assets.filter(a =>
        a.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
        a.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : assets;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-bold text-lg">选择资源</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleInsert}
              disabled={!selectedAsset}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              插入
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索图标、背景、装饰..."
              className="w-full pl-9 pr-4 py-2 border rounded"
            />
          </div>
        </div>

        {/* Type filter */}
        <div className="p-2 border-b flex gap-2 flex-wrap">
          {(['icon', 'background', 'decoration', 'chart', 'device'] as const).map((type) => {
            const count = assets.filter(a => a.type === type).length;
            return (
              <button
                key={type}
                onClick={() => setSearchQuery(type)}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
              >
                {type === 'icon' ? '图标' : type === 'background' ? '背景' : type === 'decoration' ? '装饰' : type === 'chart' ? '图表' : '设备'} ({count})
              </button>
            );
          })}
        </div>

        {/* Assets grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredAssets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Image size={48} className="mx-auto mb-2 text-gray-300" />
              <p>暂无资源</p>
              <p className="text-sm">上传 PPT 模板后自动提取</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
              {filteredAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => setSelectedAsset(asset)}
                  className={`p-2 border rounded hover:bg-gray-50 relative ${
                    selectedAsset?.id === asset.id ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                >
                  {selectedAsset?.id === asset.id && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                  <div className="aspect-square bg-gray-100 rounded mb-2 flex items-center justify-center overflow-hidden">
                    {asset.thumbnail ? (
                      <img src={asset.thumbnail} alt={asset.category} className="w-full h-full object-contain" />
                    ) : (
                      <Image size={24} className="text-gray-400" />
                    )}
                  </div>
                  <p className="text-xs text-center truncate">{asset.category}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t text-sm text-gray-500">
          选择一个资源插入到当前幻灯片
        </div>
      </div>
    </div>
  );
}
