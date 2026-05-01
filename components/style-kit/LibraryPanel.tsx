'use client';

import { useState } from 'react';
import { X, Plus, Palette, Sparkles, Filter } from 'lucide-react';
import { StyleKit, Scenario } from '@/types';
import StyleKitCard from './StyleKitCard';

interface LibraryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  styleKits: StyleKit[];
  onSelectStyleKit?: (styleKit: StyleKit) => void;
  onDeleteStyleKit?: (id: string) => void;
  onCreateNew?: () => void;
}

type FilterType = 'all' | Scenario;

const SCENARIO_LABELS: Record<Scenario, string> = {
  course: '课程教学',
  defense: '论文答辩',
  pitch: '路演融资',
  report: '工作汇报',
  proposal: '方案提案',
  training: '企业培训',
  meeting: '会议演示',
  academic: '学术报告',
};

const SCENARIO_COLORS: Record<Scenario, string> = {
  course: 'bg-blue-100 text-blue-700',
  defense: 'bg-purple-100 text-purple-700',
  pitch: 'bg-green-100 text-green-700',
  report: 'bg-amber-100 text-amber-700',
  proposal: 'bg-pink-100 text-pink-700',
  training: 'bg-cyan-100 text-cyan-700',
  meeting: 'bg-indigo-100 text-indigo-700',
  academic: 'bg-orange-100 text-orange-700',
};

export default function StyleKitLibraryPanel({
  isOpen,
  onClose,
  styleKits,
  onSelectStyleKit,
  onDeleteStyleKit,
  onCreateNew,
}: LibraryPanelProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  // Filter style kits
  const filteredKits = styleKits.filter((kit) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = kit.name.toLowerCase().includes(query);
      const matchesMood = kit.styleDNA.mood.toLowerCase().includes(query);
      const matchesTags = kit.styleDNA.moodDescription.toLowerCase().includes(query);
      if (!matchesName && !matchesMood && !matchesTags) {
        return false;
      }
    }

    // Scenario filter
    if (filter !== 'all') {
      return kit.scenarioAdapters.some((adapter) => adapter.scenario === filter);
    }

    return true;
  });

  // Group by mood for display
  const groupedByMood = filteredKits.reduce(
    (acc, kit) => {
      const mood = kit.styleDNA.mood;
      if (!acc[mood]) {
        acc[mood] = [];
      }
      acc[mood].push(kit);
      return acc;
    },
    {} as Record<string, StyleKit[]>
  );

  const handleStyleKitClick = (styleKit: StyleKit) => {
    onSelectStyleKit?.(styleKit);
  };

  const handleDelete = (id: string) => {
    onDeleteStyleKit?.(id);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Left Drawer */}
      <div className="fixed inset-y-0 left-0 w-96 bg-white border-r shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Palette className="text-indigo-600" size={20} />
              <h2 className="font-bold text-lg">StyleKit 库</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded"
              aria-label="关闭"
            >
              <X size={20} />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <input
              type="text"
              placeholder="搜索 StyleKit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <Filter
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                filter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              全部
            </button>
            {(Object.keys(SCENARIO_LABELS) as Scenario[]).map((scenario) => (
              <button
                key={scenario}
                onClick={() => setFilter(scenario)}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                  filter === scenario
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {SCENARIO_LABELS[scenario]}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredKits.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">
                {searchQuery ? '未找到匹配的 StyleKit' : '暂无 StyleKit'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {searchQuery ? '尝试其他搜索词' : '上传 PPT 后自动提取'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedByMood).map(([mood, kits]) => (
                <div key={mood}>
                  <h3 className="text-sm font-medium text-gray-500 mb-2 capitalize">
                    {mood} ({kits.length})
                  </h3>
                  <div className="space-y-3">
                    {kits.map((kit) => (
                      <StyleKitCard
                        key={kit.id}
                        styleKit={kit}
                        onClick={() => handleStyleKitClick(kit)}
                        onDelete={() => handleDelete(kit.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">
              共 {styleKits.length} 个 StyleKit
            </span>
          </div>
          <button
            onClick={onCreateNew}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            <Plus size={18} />
            新建 StyleKit
          </button>
        </div>
      </div>
    </>
  );
}
