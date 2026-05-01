'use client';

import { useState, useEffect } from 'react';
import { X, Save, RotateCcw, Palette, Type, Layout, Sparkles } from 'lucide-react';
import { StyleKit, StyleDNA, Scenario, LayoutPattern, LayoutType } from '@/types';

interface StyleKitEditorProps {
  styleKit: StyleKit | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (styleKit: StyleKit) => void;
}

const MOOD_OPTIONS: StyleDNA['mood'][] = ['professional', 'creative', 'academic', 'casual'];
const LAYOUT_TYPES: LayoutType[] = ['hero', 'two-column', 'grid', 'centered', 'full-bleed', 'quote', 'data-chart', 'comparison', 'timeline', 'gallery'];

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm text-gray-600 w-20">{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-10 rounded border border-gray-200 cursor-pointer"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm font-mono"
        placeholder="#000000"
      />
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  unit = '',
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm text-gray-600 w-20">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm"
      />
      {unit && <span className="text-sm text-gray-400">{unit}</span>}
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm text-gray-600 w-20">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm"
      />
    </div>
  );
}

export default function StyleKitEditor({
  styleKit,
  isOpen,
  onClose,
  onSave,
}: StyleKitEditorProps) {
  const [editedKit, setEditedKit] = useState<StyleKit | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'palette' | 'typography' | 'spacing' | 'effects'>('basic');

  useEffect(() => {
    if (styleKit) {
      setEditedKit(JSON.parse(JSON.stringify(styleKit)) as StyleKit);
    }
  }, [styleKit]);

  if (!isOpen || !editedKit) return null;

  const updateStyleDNA = (updates: Partial<StyleDNA>) => {
    setEditedKit((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        styleDNA: { ...prev.styleDNA, ...updates, updatedAt: Date.now() },
        updatedAt: Date.now(),
      };
    });
  };

  const handleSave = () => {
    if (editedKit && onSave) {
      editedKit.updatedAt = Date.now();
      onSave(editedKit);
    }
  };

  const handleReset = () => {
    if (styleKit) {
      setEditedKit(JSON.parse(JSON.stringify(styleKit)) as StyleKit);
    }
  };

  const tabs = [
    { id: 'basic' as const, label: '基本信息', icon: Sparkles },
    { id: 'palette' as const, label: '配色', icon: Palette },
    { id: 'typography' as const, label: '字体', icon: Type },
    { id: 'spacing' as const, label: '间距', icon: Layout },
    { id: 'effects' as const, label: '效果', icon: Sparkles },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[600px] md:max-h-[80vh] bg-white rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold">编辑 StyleKit</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded"
            aria-label="关闭"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-gray-100 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <TextInput
                label="名称"
                value={editedKit.name}
                onChange={(value) => setEditedKit((prev) => prev ? { ...prev, name: value } : null)}
              />

              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 w-20">风格定位</label>
                <select
                  value={editedKit.styleDNA.mood}
                  onChange={(e) => updateStyleDNA({ mood: e.target.value as StyleDNA['mood'] })}
                  className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm"
                >
                  {MOOD_OPTIONS.map((mood) => (
                    <option key={mood} value={mood}>
                      {mood === 'professional' ? '专业商务' :
                       mood === 'creative' ? '创意艺术' :
                       mood === 'academic' ? '学术严谨' : '休闲随意'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-start gap-3">
                <label className="text-sm text-gray-600 w-20 pt-1">风格描述</label>
                <textarea
                  value={editedKit.styleDNA.moodDescription}
                  onChange={(e) => updateStyleDNA({ moodDescription: e.target.value })}
                  className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm h-20 resize-none"
                  placeholder="描述这个风格的视觉特点..."
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 w-20">来源文件</label>
                <span className="text-sm text-gray-500">{editedKit.sourceFileId}</span>
              </div>
            </div>
          )}

          {activeTab === 'palette' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 mb-4">编辑配色方案</p>
              <ColorInput
                label="Primary"
                value={editedKit.styleDNA.palette.primary}
                onChange={(value) => updateStyleDNA({
                  palette: { ...editedKit.styleDNA.palette, primary: value }
                })}
              />
              <ColorInput
                label="Secondary"
                value={editedKit.styleDNA.palette.secondary}
                onChange={(value) => updateStyleDNA({
                  palette: { ...editedKit.styleDNA.palette, secondary: value }
                })}
              />
              <ColorInput
                label="Accent"
                value={editedKit.styleDNA.palette.accent}
                onChange={(value) => updateStyleDNA({
                  palette: { ...editedKit.styleDNA.palette, accent: value }
                })}
              />
              <ColorInput
                label="Background"
                value={editedKit.styleDNA.palette.background}
                onChange={(value) => updateStyleDNA({
                  palette: { ...editedKit.styleDNA.palette, background: value }
                })}
              />
              <ColorInput
                label="Text"
                value={editedKit.styleDNA.palette.text}
                onChange={(value) => updateStyleDNA({
                  palette: { ...editedKit.styleDNA.palette, text: value }
                })}
              />
            </div>
          )}

          {activeTab === 'typography' && (
            <div className="space-y-4">
              <TextInput
                label="标题字体"
                value={editedKit.styleDNA.typography.titleFont}
                onChange={(value) => updateStyleDNA({
                  typography: { ...editedKit.styleDNA.typography, titleFont: value }
                })}
              />
              <TextInput
                label="正文字体"
                value={editedKit.styleDNA.typography.bodyFont}
                onChange={(value) => updateStyleDNA({
                  typography: { ...editedKit.styleDNA.typography, bodyFont: value }
                })}
              />
              <NumberInput
                label="标题字号"
                value={editedKit.styleDNA.typography.titleSize}
                onChange={(value) => updateStyleDNA({
                  typography: { ...editedKit.styleDNA.typography, titleSize: value }
                })}
                unit="pt"
              />
              <NumberInput
                label="副标题字号"
                value={editedKit.styleDNA.typography.subtitleSize}
                onChange={(value) => updateStyleDNA({
                  typography: { ...editedKit.styleDNA.typography, subtitleSize: value }
                })}
                unit="pt"
              />
              <NumberInput
                label="正文字号"
                value={editedKit.styleDNA.typography.bodySize}
                onChange={(value) => updateStyleDNA({
                  typography: { ...editedKit.styleDNA.typography, bodySize: value }
                })}
                unit="pt"
              />
              <NumberInput
                label="注释字号"
                value={editedKit.styleDNA.typography.captionSize}
                onChange={(value) => updateStyleDNA({
                  typography: { ...editedKit.styleDNA.typography, captionSize: value }
                })}
                unit="pt"
              />
            </div>
          )}

          {activeTab === 'spacing' && (
            <div className="space-y-4">
              <NumberInput
                label="页面边距"
                value={editedKit.styleDNA.spacing.slidePadding}
                onChange={(value) => updateStyleDNA({
                  spacing: { ...editedKit.styleDNA.spacing, slidePadding: value }
                })}
                unit="px"
              />
              <NumberInput
                label="内容边距"
                value={editedKit.styleDNA.spacing.contentMargin}
                onChange={(value) => updateStyleDNA({
                  spacing: { ...editedKit.styleDNA.spacing, contentMargin: value }
                })}
                unit="px"
              />
              <NumberInput
                label="元素间距"
                value={editedKit.styleDNA.spacing.elementGap}
                onChange={(value) => updateStyleDNA({
                  spacing: { ...editedKit.styleDNA.spacing, elementGap: value }
                })}
                unit="px"
              />
            </div>
          )}

          {activeTab === 'effects' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 w-20">阴影</label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editedKit.styleDNA.effects.shadowEnabled}
                    onChange={(e) => updateStyleDNA({
                      effects: { ...editedKit.styleDNA.effects, shadowEnabled: e.target.checked }
                    })}
                    className="rounded"
                  />
                  <span className="text-sm">启用阴影</span>
                </label>
              </div>

              {editedKit.styleDNA.effects.shadowEnabled && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600 w-20">阴影类型</label>
                  <select
                    value={editedKit.styleDNA.effects.shadowType}
                    onChange={(e) => updateStyleDNA({
                      effects: { ...editedKit.styleDNA.effects, shadowType: e.target.value as 'soft' | 'hard' }
                    })}
                    className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm"
                  >
                    <option value="soft">Soft (柔和)</option>
                    <option value="hard">Hard (锐利)</option>
                    <option value="none">None (无)</option>
                  </select>
                </div>
              )}

              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 w-20">圆角</label>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={editedKit.styleDNA.effects.borderRadius}
                  onChange={(e) => updateStyleDNA({
                    effects: { ...editedKit.styleDNA.effects, borderRadius: Number(e.target.value) }
                  })}
                  className="flex-1"
                />
                <span className="text-sm text-gray-500 w-12">{editedKit.styleDNA.effects.borderRadius}px</span>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 w-20">渐变</label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editedKit.styleDNA.effects.gradientEnabled}
                    onChange={(e) => updateStyleDNA({
                      effects: { ...editedKit.styleDNA.effects, gradientEnabled: e.target.checked }
                    })}
                    className="rounded"
                  />
                  <span className="text-sm">启用渐变</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
          >
            <RotateCcw size={16} />
            重置
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
            >
              <Save size={16} />
              保存
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
