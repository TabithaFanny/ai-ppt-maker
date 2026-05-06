'use client';

import { useState, useEffect } from 'react';
import { ContentBlock } from '@/types';
import { useElementSelection } from '@/hooks/useElementSelection';
import { Trash2, Lock, Unlock, Palette, Type, Square, ToggleLeft, Grip, AlertCircle } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { StyleDNA } from '@/types/stylekit';

// 默认 StyleDNA 值（用于"恢复默认"按钮）
const DEFAULT_STYLE_DNA: Pick<StyleDNA, 'palette' | 'typography' | 'effects'> = {
  palette: { primary: '#1a73e8', secondary: '#5f6368', accent: '#34a853', background: '#ffffff', text: '#202124' },
  typography: { titleFont: 'system-ui', bodyFont: 'system-ui', titleSize: 36, subtitleSize: 20, bodySize: 16, captionSize: 12 },
  effects: { shadowEnabled: false, shadowType: 'soft', borderRadius: 8, gradientEnabled: false },
};

interface PropertyPanelProps {
  slideId: string;
  blocks: ContentBlock[];
  onUpdate: (blockId: string, updates: Partial<ContentBlock>) => void;
  onDelete: (blockId: string) => void;
}

// 10 项样式属性定义：5 项生效，5 项待接入
interface StyleField {
  key: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  description: string;
}

const STYLE_FIELDS: StyleField[] = [
  { key: 'primaryColor', label: '主色', icon: <Palette size={14} />, active: true, description: '主色调，用于标题和重点元素' },
  { key: 'titleFontSize', label: '标题字号', icon: <Type size={14} />, active: true, description: '页面标题字体大小' },
  { key: 'bodyFontSize', label: '正文字号', icon: <Type size={14} />, active: true, description: '正文内容字体大小' },
  { key: 'borderRadius', label: '模块圆角', icon: <Square size={14} />, active: true, description: '卡片和模块的圆角大小' },
  { key: 'cardShadow', label: '卡片阴影', icon: <ToggleLeft size={14} />, active: true, description: '卡片阴影开关' },
  { key: 'secondaryColor', label: '辅色', icon: <Palette size={14} />, active: true, description: '辅助色，用于次级元素' },
  { key: 'accentColor', label: '强调色', icon: <Palette size={14} />, active: true, description: '强调色，用于高亮元素' },
  { key: 'titleFont', label: '标题字体', icon: <Type size={14} />, active: true, description: '标题使用的字体' },
  { key: 'bodyFont', label: '正文字体', icon: <Type size={14} />, active: true, description: '正文使用的字体' },
  { key: 'slidePadding', label: '页面边距', icon: <Grip size={14} />, active: true, description: '幻灯片页面内边距' },
];

export default function PropertyPanel({ slideId, blocks, onUpdate, onDelete }: PropertyPanelProps) {
  const { selectedElement } = useElementSelection();
  const [localBlock, setLocalBlock] = useState<ContentBlock | null>(null);
  const [stylePanelOpen, setStylePanelOpen] = useState(true);

  const currentStyleKit = useStore((s) => s.currentStyleKit);
  const updateStyleKit = useStore((s) => s.updateStyleKit);

  const selectedBlock = selectedElement?.slideId === slideId
    ? blocks.find(b => b.id === selectedElement.elementId)
    : null;  useEffect(() => {
    if (selectedBlock) {
      setLocalBlock(selectedBlock);
    } else {
      setLocalBlock(null);
    }
  }, [selectedBlock]);

  const handleUpdate = (updates: Partial<ContentBlock>) => {
    if (localBlock) {
      onUpdate(localBlock.id, updates);
    }
  };

  const dna = currentStyleKit?.styleDNA;

  // 样式更新函数 — deep clone 以避免浅拷贝导致嵌套对象变异
  const updateStyle = <T,>(path: string[], value: T) => {
    if (!currentStyleKit || !dna) return;
    // StyleDNA 全为 plain JSON（字符串/数字/布尔/对象/数组），可用 JSON.parse/stringify 深拷贝
    const newStyleDNA: StyleDNA = JSON.parse(JSON.stringify(dna));
    let obj = newStyleDNA as unknown as Record<string, unknown>;
    for (let i = 0; i < path.length - 1; i++) {
      if (!obj[path[i]]) obj[path[i]] = {};
      obj = obj[path[i]] as Record<string, unknown>;
    }
    obj[path[path.length - 1]] = value;
    newStyleDNA.updatedAt = Date.now();
    updateStyleKit(currentStyleKit.id, { styleDNA: newStyleDNA });
  };

  return (
    <div className="w-72 border-l bg-gray-50 flex flex-col overflow-y-auto">
      {/* 全局样式面板 */}
      {currentStyleKit && dna && (
        <div className="border-b">
          <button
            onClick={() => setStylePanelOpen(!stylePanelOpen)}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-100 transition-colors"
          >
            <h4 className="font-medium text-sm flex items-center gap-1.5">
              <Palette size={14} className="text-blue-600" />
              全局样式
            </h4>
            <span className={`text-gray-400 transition-transform ${stylePanelOpen ? 'rotate-90' : ''}`}>›</span>
          </button>

          {stylePanelOpen && (
            <div className="px-3 pb-3 space-y-2">
              <p className="text-xs text-gray-400">修改幻灯片全局视觉风格</p>

              {STYLE_FIELDS.map((field) => {
                if (!field.active) {
                  return (
                    <div key={field.key} className="flex items-center justify-between px-2 py-1.5 bg-gray-100 rounded opacity-50">
                      <span className="flex items-center gap-1.5 text-xs text-gray-500">
                        {field.icon}
                        {field.label}
                      </span>
                      <span className="text-[10px] text-gray-400 bg-white px-1.5 py-0.5 rounded">待接入</span>
                    </div>
                  );
                }

                // 5 个生效项
                switch (field.key) {
                  case 'primaryColor':
                    return (
                      <div key={field.key} className="space-y-0.5">
                        <label className="flex items-center gap-1 text-xs text-gray-600">
                          <Palette size={12} className="text-blue-600" />
                          主色
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={dna.palette.primary}
                            onChange={(e) => updateStyle(['palette', 'primary'], e.target.value)}
                            className="w-9 h-8 border rounded cursor-pointer shrink-0"
                          />
                          <input
                            type="text"
                            value={dna.palette.primary}
                            onChange={(e) => updateStyle(['palette', 'primary'], e.target.value)}
                            className="flex-1 px-2 py-1 text-xs border rounded font-mono"
                          />
                        </div>
                      </div>
                    );

                  case 'titleFontSize':
                    return (
                      <div key={field.key} className="space-y-0.5">
                        <label className="flex items-center gap-1 text-xs text-gray-600">
                          <Type size={12} />
                          标题字号
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="24"
                            max="64"
                            value={dna.typography.titleSize}
                            onChange={(e) => updateStyle(['typography', 'titleSize'], Number(e.target.value))}
                            className="flex-1 h-1.5"
                          />
                          <span className="text-xs text-gray-500 w-10 text-right">{dna.typography.titleSize}pt</span>
                        </div>
                      </div>
                    );

                  case 'bodyFontSize':
                    return (
                      <div key={field.key} className="space-y-0.5">
                        <label className="flex items-center gap-1 text-xs text-gray-600">
                          <Type size={12} />
                          正文字号
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="10"
                            max="32"
                            value={dna.typography.bodySize}
                            onChange={(e) => updateStyle(['typography', 'bodySize'], Number(e.target.value))}
                            className="flex-1 h-1.5"
                          />
                          <span className="text-xs text-gray-500 w-10 text-right">{dna.typography.bodySize}pt</span>
                        </div>
                      </div>
                    );

                  case 'borderRadius':
                    return (
                      <div key={field.key} className="space-y-0.5">
                        <label className="flex items-center gap-1 text-xs text-gray-600">
                          <Square size={12} />
                          模块圆角
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0"
                            max="24"
                            value={dna.effects.borderRadius}
                            onChange={(e) => updateStyle(['effects', 'borderRadius'], Number(e.target.value))}
                            className="flex-1 h-1.5"
                          />
                          <span className="text-xs text-gray-500 w-10 text-right">{dna.effects.borderRadius}px</span>
                        </div>
                      </div>
                    );

                  case 'cardShadow':
                    return (
                      <div key={field.key} className="space-y-0.5">
                        <label className="flex items-center gap-1 text-xs text-gray-600">
                          <ToggleLeft size={12} />
                          卡片阴影
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateStyle(['effects', 'shadowEnabled'], !dna.effects.shadowEnabled)}
                            className={`px-2 py-1 text-xs rounded border transition-colors ${
                              dna.effects.shadowEnabled
                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                : 'bg-white border-gray-200 text-gray-500'
                            }`}
                          >
                            {dna.effects.shadowEnabled ? '开启' : '关闭'}
                          </button>
                          {dna.effects.shadowEnabled && (
                            <select
                              value={dna.effects.shadowType}
                              onChange={(e) => updateStyle(['effects', 'shadowType'], e.target.value)}
                              className="flex-1 px-2 py-1 text-xs border rounded"
                            >
                              <option value="soft">柔和</option>
                              <option value="hard">硬朗</option>
                              <option value="none">无</option>
                            </select>
                          )}
                        </div>
                      </div>
                    );

                  case 'secondaryColor':
                    return (
                      <div key={field.key} className="space-y-0.5">
                        <label className="flex items-center gap-1 text-xs text-gray-600">
                          <Palette size={12} className="text-blue-600" />
                          辅色
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={dna.palette.secondary}
                            onChange={(e) => updateStyle(['palette', 'secondary'], e.target.value)}
                            className="w-9 h-8 border rounded cursor-pointer shrink-0"
                          />
                          <input
                            type="text"
                            value={dna.palette.secondary}
                            onChange={(e) => updateStyle(['palette', 'secondary'], e.target.value)}
                            className="flex-1 px-2 py-1 text-xs border rounded font-mono"
                          />
                        </div>
                      </div>
                    );

                  case 'accentColor':
                    return (
                      <div key={field.key} className="space-y-0.5">
                        <label className="flex items-center gap-1 text-xs text-gray-600">
                          <Palette size={12} className="text-blue-600" />
                          强调色
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={dna.palette.accent}
                            onChange={(e) => updateStyle(['palette', 'accent'], e.target.value)}
                            className="w-9 h-8 border rounded cursor-pointer shrink-0"
                          />
                          <input
                            type="text"
                            value={dna.palette.accent}
                            onChange={(e) => updateStyle(['palette', 'accent'], e.target.value)}
                            className="flex-1 px-2 py-1 text-xs border rounded font-mono"
                          />
                        </div>
                      </div>
                    );

                  case 'titleFont':
                    return (
                      <div key={field.key} className="space-y-0.5">
                        <label className="flex items-center gap-1 text-xs text-gray-600">
                          <Type size={12} />
                          标题字体
                        </label>
                        <input
                          type="text"
                          value={dna.typography.titleFont}
                          onChange={(e) => updateStyle(['typography', 'titleFont'], e.target.value)}
                          className="w-full px-2 py-1 text-xs border rounded"
                          placeholder="e.g. Arial, Helvetica"
                        />
                      </div>
                    );

                  case 'bodyFont':
                    return (
                      <div key={field.key} className="space-y-0.5">
                        <label className="flex items-center gap-1 text-xs text-gray-600">
                          <Type size={12} />
                          正文字体
                        </label>
                        <input
                          type="text"
                          value={dna.typography.bodyFont}
                          onChange={(e) => updateStyle(['typography', 'bodyFont'], e.target.value)}
                          className="w-full px-2 py-1 text-xs border rounded"
                          placeholder="e.g. Arial, Helvetica"
                        />
                      </div>
                    );

                  case 'slidePadding':
                    return (
                      <div key={field.key} className="space-y-0.5">
                        <label className="flex items-center gap-1 text-xs text-gray-600">
                          <Grip size={12} />
                          页面边距
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0"
                            max="80"
                            value={dna.spacing.slidePadding}
                            onChange={(e) => updateStyle(['spacing', 'slidePadding'], Number(e.target.value))}
                            className="flex-1 h-1.5"
                          />
                          <span className="text-xs text-gray-500 w-10 text-right">{dna.spacing.slidePadding}px</span>
                        </div>
                      </div>
                    );

                  default:
                    return null;
                }
              })}

              <div className="flex gap-1.5 pt-1">
                <button
                  onClick={() => {
                    if (currentStyleKit) {
                      const resetDNA = { ...currentStyleKit.styleDNA, ...DEFAULT_STYLE_DNA, updatedAt: Date.now() };
                      updateStyleKit(currentStyleKit.id, { styleDNA: resetDNA });
                    }
                  }}
                  className="flex-1 px-2 py-1.5 text-xs border rounded hover:bg-white transition-colors"
                >
                  恢复默认
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Element properties */}
      {localBlock ? (
        <>
          {/* Header */}
          <div className="p-3 border-b flex items-center justify-between">
            <h4 className="font-medium text-sm">元素属性</h4>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleUpdate({ locked: !localBlock.locked })}
                className={`p-1.5 rounded ${localBlock.locked ? 'text-amber-600 bg-amber-50' : 'text-gray-400 hover:bg-gray-100'}`}
                title={localBlock.locked ? '解锁元素' : '锁定元素'}
              >
                {localBlock.locked ? <Lock size={16} /> : <Unlock size={16} />}
              </button>
              <button
                onClick={() => onDelete(localBlock.id)}
                className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                title="删除元素"
                disabled={localBlock.locked}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 p-3 space-y-4">
            {/* Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">类型</label>
              <select
                value={localBlock.type}
                onChange={(e) => handleUpdate({ type: e.target.value as ContentBlock['type'] })}
                className="w-full px-2 py-1.5 text-sm border rounded"
              >
                <option value="text">文字</option>
                <option value="image">图片</option>
                <option value="chart">图表</option>
                <option value="list">列表</option>
              </select>
            </div>

            {/* Content */}
            {(localBlock.type === 'text' || localBlock.type === 'list') && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">内容</label>
                <textarea
                  value={localBlock.content}
                  onChange={(e) => handleUpdate({ content: e.target.value })}
                  rows={4}
                  className="w-full px-2 py-1.5 text-sm border rounded resize-none"
                />
              </div>
            )}

            {/* Position */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">位置</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">X</label>
                  <input
                    type="number"
                    value={localBlock.position.x.toFixed(2)}
                    onChange={(e) => handleUpdate({ position: { ...localBlock.position, x: Number(e.target.value) } })}
                    step="0.05"
                    min="0"
                    max="1"
                    className="w-full px-2 py-1 text-xs border rounded"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Y</label>
                  <input
                    type="number"
                    value={localBlock.position.y.toFixed(2)}
                    onChange={(e) => handleUpdate({ position: { ...localBlock.position, y: Number(e.target.value) } })}
                    step="0.05"
                    min="0"
                    max="1"
                    className="w-full px-2 py-1 text-xs border rounded"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">宽</label>
                  <input
                    type="number"
                    value={localBlock.position.width.toFixed(2)}
                    onChange={(e) => handleUpdate({ position: { ...localBlock.position, width: Number(e.target.value) } })}
                    step="0.05"
                    min="0.05"
                    max="1"
                    className="w-full px-2 py-1 text-xs border rounded"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">高</label>
                  <input
                    type="number"
                    value={localBlock.position.height.toFixed(2)}
                    onChange={(e) => handleUpdate({ position: { ...localBlock.position, height: Number(e.target.value) } })}
                    step="0.05"
                    min="0.05"
                    max="1"
                    className="w-full px-2 py-1 text-xs border rounded"
                  />
                </div>
              </div>
            </div>

            {/* Style */}
            {localBlock.style && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">样式</label>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500">字号</label>
                    <input
                      type="number"
                      value={localBlock.style.fontSize || 14}
                      onChange={(e) => handleUpdate({ style: { ...localBlock.style, fontSize: Number(e.target.value) } })}
                      min="8"
                      max="72"
                      className="w-full px-2 py-1 text-xs border rounded"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">字重</label>
                    <select
                      value={localBlock.style.fontWeight || 'normal'}
                      onChange={(e) => handleUpdate({ style: { ...localBlock.style, fontWeight: e.target.value } })}
                      className="w-full px-2 py-1 text-xs border rounded"
                    >
                      <option value="normal">正常</option>
                      <option value="bold">粗体</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">颜色</label>
                    <input
                      type="color"
                      value={localBlock.style.color || '#000000'}
                      onChange={(e) => handleUpdate({ style: { ...localBlock.style, color: e.target.value } })}
                      className="w-full h-8 border rounded cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">对齐</label>
                    <select
                      value={localBlock.style.align || 'left'}
                      onChange={(e) => handleUpdate({ style: { ...localBlock.style, align: e.target.value as 'left' | 'center' | 'right' } })}
                      className="w-full px-2 py-1 text-xs border rounded"
                    >
                      <option value="left">左对齐</option>
                      <option value="center">居中</option>
                      <option value="right">右对齐</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="p-4">
          <p className="text-sm text-gray-400 flex items-center gap-1.5">
            <AlertCircle size={14} />
            选择一个元素以编辑属性
          </p>
        </div>
      )}
    </div>
  );
}
