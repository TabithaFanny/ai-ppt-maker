'use client';

import { GenerationProgress } from '@/types';
import { FileText, Sparkles, ListOrdered, LayoutGrid, CheckCircle2, AlertCircle } from 'lucide-react';

interface PipelineVisualizerProps {
  progress: GenerationProgress | null;
  onComplete?: () => void;
}

const STAGES = [
  { key: 'reading', label: '读取结构', icon: FileText, progress: 15 },
  { key: 'extracting', label: '提取风格DNA', icon: Sparkles, progress: 30 },
  { key: 'outlining', label: '生成叙事大纲', icon: ListOrdered, progress: 50 },
  { key: 'splitting', label: '拆分页面内容', icon: LayoutGrid, progress: 75 },
];

const STAGE_MESSAGES: Record<string, string> = {
  reading: '正在读取模板结构...',
  extracting: '正在提取风格DNA...',
  outlining: '正在生成PPT叙事大纲...',
  splitting: '正在拆分页面内容...',
  complete: '生成完成!',
  error: '生成失败',
};

export default function PipelineVisualizer({ progress, onComplete }: PipelineVisualizerProps) {
  const currentStage = progress?.stage || 'idle';
  const currentProgress = progress?.progress || 0;
  const currentMessage = progress?.message || '准备开始...';

  const isStageComplete = (stageKey: string) => {
    const stage = STAGES.find(s => s.key === stageKey);
    if (!stage) return false;
    return currentProgress >= stage.progress;
  };

  const isStageActive = (stageKey: string) => {
    return currentStage === stageKey;
  };

  return (
    <div className="bg-white rounded-xl p-8 border border-gray-100 shadow-sm max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-2">AI 正在生成你的 PPT</h2>
        <p className="text-gray-600">{currentMessage}</p>
      </div>

      {/* Pipeline Steps */}
      <div className="flex items-center justify-between mb-8">
        {STAGES.map((stage, index) => {
          const Icon = stage.icon;
          const isComplete = isStageComplete(stage.key);
          const isActive = isStageActive(stage.key);

          return (
            <div key={stage.key} className="flex items-center">
              {/* Step Circle */}
              <div className="relative">
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 ${
                    isComplete
                      ? 'bg-green-500 text-white'
                      : isActive
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 size={28} />
                  ) : (
                    <Icon size={24} />
                  )}
                </div>

                {/* Active indicator */}
                {isActive && !isComplete && (
                  <div className="absolute inset-0 rounded-full border-2 border-blue-600 animate-ping opacity-25" />
                )}
              </div>

              {/* Label */}
              <div className={`mt-2 text-sm font-medium ${
                isComplete
                  ? 'text-green-600'
                  : isActive
                  ? 'text-blue-600'
                  : 'text-gray-400'
              }`}>
                {stage.label}
              </div>

              {/* Connector */}
              {index < STAGES.length - 1 && (
                <div className="flex-1 mx-4">
                  <div className="h-1 bg-gray-200 rounded-full">
                    <div
                      className={`h-full bg-green-500 rounded-full transition-all duration-500 ${
                        isComplete ? 'w-full' : 'w-0'
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">生成进度</span>
          <span className="font-medium text-gray-900">{currentProgress}%</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              currentStage === 'error'
                ? 'bg-red-500'
                : currentStage === 'complete'
                ? 'bg-green-500'
                : 'bg-gradient-to-r from-blue-500 to-purple-500'
            }`}
            style={{ width: `${currentProgress}%` }}
          />
        </div>
      </div>

      {/* Status Message */}
      {currentStage === 'error' && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
          <div>
            <div className="font-medium text-red-700">生成过程中出现错误</div>
            <div className="text-sm text-red-600">{currentMessage}</div>
          </div>
        </div>
      )}

      {/* Complete State */}
      {currentStage === 'complete' && onComplete && (
        <div className="mt-6 text-center">
          <button
            onClick={onComplete}
            className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition"
          >
            查看生成的 PPT
          </button>
        </div>
      )}
    </div>
  );
}

// Compact version for inline display
export function PipelineVisualizerCompact({ progress }: { progress: GenerationProgress | null }) {
  const currentProgress = progress?.progress || 0;
  const currentMessage = progress?.message || '准备开始...';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">{currentMessage}</span>
        <span className="font-medium text-blue-600">{currentProgress}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
          style={{ width: `${currentProgress}%` }}
        />
      </div>
    </div>
  );
}
