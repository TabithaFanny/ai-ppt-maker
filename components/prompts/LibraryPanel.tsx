'use client';

import { useState } from 'react';
import { X, Plus, FileText, User } from 'lucide-react';
import { TemplatePrompt, UserPrompt } from '@/types';
import TemplatePromptCard from './TemplatePromptCard';

interface LibraryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  templates: TemplatePrompt[];
  userPrompts: UserPrompt[];
  onSelectTemplate?: (template: TemplatePrompt) => void;
  onSelectUserPrompt?: (prompt: UserPrompt) => void;
  onDeleteTemplate?: (id: string) => void;
  onDeleteUserPrompt?: (id: string) => void;
}

type TabType = 'template' | 'user';

const CATEGORY_LABELS: Record<UserPrompt['category'], string> = {
  style: '风格',
  layout: '布局',
  illustration: '插画',
  icon: '图标',
  decoration: '装饰',
};

const CATEGORY_COLORS: Record<UserPrompt['category'], string> = {
  style: 'bg-blue-100 text-blue-700',
  layout: 'bg-green-100 text-green-700',
  illustration: 'bg-purple-100 text-purple-700',
  icon: 'bg-amber-100 text-amber-700',
  decoration: 'bg-pink-100 text-pink-700',
};

const SOURCE_LABELS: Record<UserPrompt['source'], string> = {
  manual: '手动创建',
  extracted: '内容提取',
  optimized: 'AI 优化',
};

export default function LibraryPanel({
  isOpen,
  onClose,
  templates,
  userPrompts,
  onSelectTemplate,
  onSelectUserPrompt,
  onDeleteTemplate,
  onDeleteUserPrompt,
}: LibraryPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('template');

  if (!isOpen) return null;

  const handleTemplateClick = (template: TemplatePrompt) => {
    onSelectTemplate?.(template);
  };

  const handleTemplateDelete = (id: string) => {
    onDeleteTemplate?.(id);
  };

  const handleUserPromptClick = (prompt: UserPrompt) => {
    onSelectUserPrompt?.(prompt);
  };

  const handleUserPromptDelete = (id: string) => {
    onDeleteUserPrompt?.(id);
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
      <div className="fixed inset-y-0 left-0 w-80 bg-white border-r shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">Prompt 库</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded"
              aria-label="关闭"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('template')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === 'template'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText size={16} />
              模板 Prompt
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 rounded-full">
                {templates.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('user')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === 'user'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <User size={16} />
              用户 Prompt
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 rounded-full">
                {userPrompts.length}
              </span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {activeTab === 'template' ? (
            <div className="space-y-3">
              {templates.length === 0 ? (
                <div className="text-center py-12">
                  <FileText size={48} className="mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500">暂无模板 Prompt</p>
                  <p className="text-sm text-gray-400 mt-1">
                    上传 PPT 后自动提取
                  </p>
                </div>
              ) : (
                templates.map((template) => (
                  <TemplatePromptCard
                    key={template.id}
                    template={template}
                    onClick={() => handleTemplateClick(template)}
                    onDelete={() => handleTemplateDelete(template.id)}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {userPrompts.length === 0 ? (
                <div className="text-center py-12">
                  <User size={48} className="mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500">暂无用户 Prompt</p>
                  <p className="text-sm text-gray-400 mt-1">
                    点击底部按钮新增
                  </p>
                </div>
              ) : (
                userPrompts.map((prompt) => (
                  <UserPromptCard
                    key={prompt.id}
                    prompt={prompt}
                    onClick={() => handleUserPromptClick(prompt)}
                    onDelete={() => handleUserPromptDelete(prompt.id)}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={() => {
              // TODO: Open new prompt editor
              console.log('Add new prompt');
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus size={18} />
            新增 Prompt
          </button>
        </div>
      </div>
    </>
  );
}

interface UserPromptCardProps {
  prompt: UserPrompt;
  onClick?: () => void;
  onDelete?: () => void;
}

function UserPromptCard({ prompt, onClick, onDelete }: UserPromptCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  return (
    <div
      onClick={onClick}
      className="group relative bg-white border rounded-lg p-3 cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all duration-200"
    >
      {/* Name and Source */}
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-gray-900 line-clamp-1 pr-2" title={prompt.name}>
          {prompt.name}
        </h4>
        <span
          className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${
            CATEGORY_COLORS[prompt.category]
          }`}
        >
          {CATEGORY_LABELS[prompt.category]}
        </span>
      </div>

      {/* Tags */}
      {prompt.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {prompt.tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
            >
              {tag}
            </span>
          ))}
          {prompt.tags.length > 3 && (
            <span className="text-xs text-gray-400">
              +{prompt.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer: Source and Usage */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{SOURCE_LABELS[prompt.source]}</span>
        <span>使用 {prompt.usageCount} 次</span>
      </div>

      {/* Delete Button (hover reveal) */}
      <button
        onClick={handleDelete}
        className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        aria-label="删除 Prompt"
      >
        <X size={14} />
      </button>
    </div>
  );
}
