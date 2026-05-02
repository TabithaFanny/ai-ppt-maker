'use client';

import { useState } from 'react';
import { Copy, Check, Edit2, X, Palette, Type } from 'lucide-react';

export interface UniversalPromptDisplayProps {
  universalPrompt: string;
  overallStyle: 'business' | 'tech' | 'creative' | 'academic';
  colorPalette?: string[];
  typography?: {
    titleFont: string;
    bodyFont: string;
    titleSize: number;
    bodySize: number;
  };
  onEdit?: (newPrompt: string) => void;
}

const STYLE_LABELS: Record<UniversalPromptDisplayProps['overallStyle'], string> = {
  business: 'Business',
  tech: 'Tech',
  creative: 'Creative',
  academic: 'Academic',
};

const STYLE_COLORS: Record<UniversalPromptDisplayProps['overallStyle'], string> = {
  business: 'bg-amber-100 text-amber-800 border-amber-200',
  tech: 'bg-blue-100 text-blue-800 border-blue-200',
  creative: 'bg-purple-100 text-purple-800 border-purple-200',
  academic: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

export default function UniversalPromptDisplay({
  universalPrompt,
  overallStyle,
  colorPalette,
  typography,
  onEdit,
}: UniversalPromptDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(universalPrompt);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(universalPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSaveEdit = () => {
    if (onEdit && editedPrompt.trim()) {
      onEdit(editedPrompt.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedPrompt(universalPrompt);
    setIsEditing(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
      {/* Header with style tag and actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 text-xs font-medium rounded-full border ${STYLE_COLORS[overallStyle]}`}
          >
            {STYLE_LABELS[overallStyle]}
          </span>
          <h3 className="text-sm font-medium text-gray-700">Universal Prompt</h3>
        </div>
        <div className="flex items-center gap-1">
          {onEdit && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
              aria-label="Edit prompt"
            >
              <Edit2 size={16} />
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
          >
            {copied ? (
              <>
                <Check size={16} className="text-green-600" />
                <span className="text-green-600">Copied</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Prompt content */}
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            className="w-full px-4 py-3 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none font-mono"
            rows={4}
            placeholder="Enter universal prompt..."
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancelEdit}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              <X size={16} />
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition"
            >
              <Check size={16} />
              Save
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-700 leading-relaxed font-mono bg-gray-50 px-4 py-3 rounded-lg border border-gray-100">
          {universalPrompt}
        </p>
      )}

      {/* Optional color palette */}
      {colorPalette && colorPalette.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Palette size={16} />
            <span className="font-medium">Color Palette</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {colorPalette.map((color, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100"
              >
                <div
                  className="w-5 h-5 rounded border border-gray-200 shadow-sm"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-gray-600 font-mono">{color}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Optional typography info */}
      {typography && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Type size={16} />
            <span className="font-medium">Typography</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
              <div className="text-xs text-gray-500 mb-1">Title Font</div>
              <div className="text-sm text-gray-900 font-medium">{typography.titleFont}</div>
              <div className="text-xs text-gray-500">{typography.titleSize}px</div>
            </div>
            <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
              <div className="text-xs text-gray-500 mb-1">Body Font</div>
              <div className="text-sm text-gray-900 font-medium">{typography.bodyFont}</div>
              <div className="text-xs text-gray-500">{typography.bodySize}px</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
