'use client';

import { useState, useEffect } from 'react';
import { UserPrompt } from '@/types';
import { X } from 'lucide-react';

interface UserPromptEditorProps {
  prompt?: UserPrompt;
  onSave: (prompt: UserPrompt) => void;
  onCancel: () => void;
}

const CATEGORIES = [
  { value: 'style', label: 'Style' },
  { value: 'layout', label: 'Layout' },
  { value: 'illustration', label: 'Illustration' },
  { value: 'icon', label: 'Icon' },
  { value: 'decoration', label: 'Decoration' },
] as const;

export default function UserPromptEditor({ prompt, onSave, onCancel }: UserPromptEditorProps) {
  const isEditMode = Boolean(prompt);

  const [formData, setFormData] = useState({
    name: '',
    content: '',
    category: 'style' as UserPrompt['category'],
    tags: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (prompt) {
      setFormData({
        name: prompt.name,
        content: prompt.content,
        category: prompt.category,
        tags: prompt.tags.join(', '),
      });
    }
  }, [prompt]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = '名称不能为空';
    }
    if (!formData.content.trim()) {
      newErrors.content = '内容不能为空';
    }
    if (formData.name.length > 50) {
      newErrors.name = '名称不能超过50字';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const now = Date.now();
    const tags = formData.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const savedPrompt: UserPrompt = {
      id: prompt?.id || crypto.randomUUID(),
      name: formData.name.trim(),
      content: formData.content.trim(),
      category: formData.category,
      tags,
      source: prompt?.source || 'manual',
      usageCount: prompt?.usageCount || 0,
      successCount: prompt?.successCount || 0,
      createdAt: prompt?.createdAt || now,
      updatedAt: now,
    };

    onSave(savedPrompt);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">{isEditMode ? '编辑 Prompt' : '新增 Prompt'}</h2>
        <button
          onClick={onCancel}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded"
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 名称 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="例如：科技风格标题"
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
        </div>

        {/* 内容 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            内容 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            placeholder="输入 Prompt 内容..."
            rows={6}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          {errors.content && <p className="text-sm text-red-500">{errors.content}</p>}
        </div>

        {/* 分类 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">分类</label>
          <select
            value={formData.category}
            onChange={(e) =>
              setFormData({ ...formData, category: e.target.value as UserPrompt['category'] })
            }
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* 标签 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">标签</label>
          <input
            type="text"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            placeholder="用逗号分隔多个标签，例如：科技, 简约, 蓝色"
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500">用逗号分隔多个标签</p>
        </div>

        {/* 来源（编辑模式显示） */}
        {isEditMode && prompt?.source && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-500">来源</label>
            <p className="text-sm text-gray-700 capitalize">
              {prompt.source === 'extracted'
                ? '从内容中提取'
                : prompt.source === 'optimized'
                  ? 'AI 优化生成'
                  : '手动创建'}
            </p>
          </div>
        )}

        {/* 按钮 */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      </form>
    </div>
  );
}
