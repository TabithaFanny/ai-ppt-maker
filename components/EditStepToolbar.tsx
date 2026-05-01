'use client';

import { PanelLeftClose, PanelLeft, Box, Layers, Eye, Library, Wand2, MapPin, Undo2, Redo2, Plus, Trash2 } from 'lucide-react';

export type EditMode = 'content' | 'element' | 'preview';

interface EditStepToolbarProps {
  isOutlineOpen: boolean;
  onToggleOutline: () => void;
  editMode: EditMode;
  onEditModeChange: (mode: EditMode) => void;
  isAssetLibraryOpen: boolean;
  onToggleAssetLibrary: () => void;
  isAiEditOpen: boolean;
  onToggleAiEdit: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  showLayoutGuide: boolean;
  onToggleLayoutGuide: () => void;
  isResidualPanelOpen: boolean;
  onToggleResidual: () => void;
  onAddSlide: () => void;
  onDeleteSlide: () => void;
  onGenerateImage: () => void;
  isGeneratingImage: boolean;
  slidesCount: number;
  hasVersionHistory?: boolean;
  versionHistoryComponent?: React.ReactNode;
}

export default function EditStepToolbar({
  isOutlineOpen, onToggleOutline,
  editMode, onEditModeChange,
  isAssetLibraryOpen, onToggleAssetLibrary,
  isAiEditOpen, onToggleAiEdit,
  canUndo, canRedo, onUndo, onRedo,
  showLayoutGuide, onToggleLayoutGuide,
  isResidualPanelOpen, onToggleResidual,
  onAddSlide, onDeleteSlide, onGenerateImage, isGeneratingImage,
  slidesCount,
  versionHistoryComponent,
}: EditStepToolbarProps) {
  return (
    <>
      {/* Desktop toolbar */}
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleOutline}
            className="md:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center border rounded hover:bg-gray-50"
            aria-label={isOutlineOpen ? '收起大纲' : '展开大纲'}
          >
            {isOutlineOpen ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
          </button>
          <h2 className="text-xl font-bold">编辑内容</h2>

          {/* Edit mode tabs */}
          <div className="hidden md:flex items-center gap-1 ml-4 bg-gray-100 rounded-lg p-1">
            {([
              { key: 'content' as EditMode, icon: Layers, label: '内容' },
              { key: 'element' as EditMode, icon: Box, label: '元素' },
              { key: 'preview' as EditMode, icon: Eye, label: '预览' },
            ]).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => onEditModeChange(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm ${
                  editMode === key ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden md:flex gap-2">
          <button
            onClick={onToggleAssetLibrary}
            className={`flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50 ${
              isAssetLibraryOpen ? 'bg-blue-50 border-blue-300' : ''
            }`}
          >
            <Library size={20} />
            资源库
          </button>

          <button
            onClick={onToggleAiEdit}
            className={`flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50 ${
              isAiEditOpen ? 'bg-purple-50 border-purple-300' : ''
            }`}
          >
            <Wand2 size={20} />
            AI 编辑
          </button>

          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center border rounded hover:bg-gray-50 disabled:opacity-30"
            aria-label="撤销"
          >
            <Undo2 size={20} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center border rounded hover:bg-gray-50 disabled:opacity-30"
            aria-label="重做"
          >
            <Redo2 size={20} />
          </button>

          <button
            onClick={onToggleLayoutGuide}
            className={`flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50 ${
              showLayoutGuide ? 'bg-green-50 border-green-300' : ''
            }`}
          >
            <MapPin size={20} />
            布局引导
          </button>

          <button
            onClick={onToggleResidual}
            className={`flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50 ${
              isResidualPanelOpen ? 'bg-orange-50 border-orange-300' : ''
            }`}
          >
            <Eye size={20} />
            质量检查
          </button>

          {versionHistoryComponent}

          <button
            onClick={onAddSlide}
            className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50"
          >
            <Plus size={20} />
            添加幻灯片
          </button>
          <button
            onClick={onGenerateImage}
            disabled={isGeneratingImage}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            <Wand2 size={20} />
            {isGeneratingImage ? '生成中...' : 'AI 配图'}
          </button>
          <button
            onClick={onDeleteSlide}
            disabled={slidesCount <= 1}
            className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            <Trash2 size={20} />
            删除当前页
          </button>
        </div>
      </div>

      {/* Mobile toolbar */}
      <div className="md:hidden border-b p-2 flex gap-2">
        <select
          value={editMode}
          onChange={(e) => onEditModeChange(e.target.value as EditMode)}
          className="flex-1 px-3 py-2 border rounded"
        >
          <option value="content">内容编辑</option>
          <option value="element">元素编辑</option>
          <option value="preview">预览模式</option>
        </select>
        <button
          onClick={onAddSlide}
          className="flex-1 flex items-center justify-center gap-2 min-h-[44px] py-2 border rounded hover:bg-gray-50"
        >
          <Plus size={20} />
          添加
        </button>
        <button
          onClick={onDeleteSlide}
          disabled={slidesCount <= 1}
          className="flex-1 flex items-center justify-center gap-2 min-h-[44px] py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
        >
          <Trash2 size={20} />
          删除
        </button>
      </div>
    </>
  );
}
