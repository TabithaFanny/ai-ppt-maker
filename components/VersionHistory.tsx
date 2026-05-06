'use client';

import { useState, useEffect } from 'react';
import { ProjectVersion, versionService } from '@/lib/db';
import { Clock, RotateCcw } from 'lucide-react';

interface VersionHistoryProps {
  projectId: string;
  onRestore: (pptJson: ProjectVersion['pptJson']) => void;
}

export default function VersionHistory({ projectId, onRestore }: VersionHistoryProps) {
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const loadVersions = async () => {
    const data = await versionService.getByProject(projectId);
    setVersions(data);
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    loadVersions();
  }, [projectId]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const handleRestore = async (versionId: string) => {
    const version = await versionService.restore(versionId);
    if (version?.pptJson) {
      onRestore(version.pptJson);
      setIsOpen(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50"
      >
        <Clock size={20} />
        历史版本 ({versions.length})
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border rounded-lg shadow-lg z-50">
          <div className="p-4 border-b">
            <h3 className="font-semibold">历史版本</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {versions.length === 0 ? (
              <div className="p-4 text-center text-gray-500">暂无历史版本</div>
            ) : (
              versions.map((version) => (
                <div
                  key={version.id}
                  className="p-4 border-b hover:bg-gray-50 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {version.pptJson?.slides.length || 0} 页幻灯片
                    </div>
                    <div className="text-xs text-gray-500">{formatTime(version.createdAt)}</div>
                  </div>
                  <button
                    onClick={() => handleRestore(version.id)}
                    className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <RotateCcw size={14} />
                    恢复
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
      )}
    </div>
  );
}
