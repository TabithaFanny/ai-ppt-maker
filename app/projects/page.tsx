'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { projectService } from '@/lib/db';
import { Project } from '@/types';
import {
  Plus, Trash2, Copy, FileJson, Download, Upload, MoreVertical,
  Edit, Eye, CheckCircle2, Clock, AlertCircle, Sparkles, FileText
} from 'lucide-react';
import { importExportService } from '@/lib/import-export';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProjects = async () => {
    const data = await projectService.getAll();
    setProjects(data);
    setLoading(false);
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const deleteProject = async (id: string) => {
    if (!confirm('确定要删除这个项目吗？')) return;
    await projectService.delete(id);
    loadProjects();
  };

  const duplicateProject = async (project: Project) => {
    await projectService.create({
      title: `${project.title} (副本)`,
      status: project.status,
      styleKitId: project.styleKitId,
      styleKitVersion: project.styleKitVersion,
      styleKitSource: project.styleKitSource,
      styleConfig: project.styleConfig,
      userInput: project.userInput,
      pptJson: project.pptJson,
    });
    loadProjects();
  };

  const exportProject = async (project: Project) => {
    try {
      const data = await importExportService.exportProject(project.id);
      const filename = `${project.title}_${new Date().toISOString().split('T')[0]}.json`;
      importExportService.downloadJSON(data, filename);
    } catch {
      alert('导出失败');
    }
  };

  const exportAll = async () => {
    try {
      const data = await importExportService.exportAll();
      const filename = `所有项目_${new Date().toISOString().split('T')[0]}.json`;
      importExportService.downloadJSON(data, filename);
    } catch {
      alert('导出失败');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const result = await importExportService.importData(text);
      alert(`导入成功 ${result.success} 个项目${result.failed > 0 ? `，失败 ${result.failed} 个` : ''}`);
      loadProjects();
    } catch (error) {
      alert('导入失败：' + (error as Error).message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getStatusInfo = (status: Project['status']) => {
    switch (status) {
      case 'completed':
        return { icon: CheckCircle2, label: '已完成', color: 'bg-green-100 text-green-700' };
      case 'generating':
        return { icon: Sparkles, label: '生成中', color: 'bg-blue-100 text-blue-700' };
      case 'analyzing':
        return { icon: Clock, label: '分析中', color: 'bg-yellow-100 text-yellow-700' };
      default:
        return { icon: AlertCircle, label: '草稿', color: 'bg-gray-100 text-gray-600' };
    }
  };

  const getStyleTag = (project: Project): { label: string; color: string } | null => {
    if (!project.styleConfig) return null;
    const styleMap: Record<string, { label: string; color: string }> = {
      business: { label: '商务风', color: 'bg-blue-50 text-blue-600' },
      tech: { label: '科技风', color: 'bg-purple-50 text-purple-600' },
      creative: { label: '创意风', color: 'bg-pink-50 text-pink-600' },
      academic: { label: '学术风', color: 'bg-green-50 text-green-600' },
    };
    return styleMap[project.styleConfig.overallStyle] || null;
  };

  const getPageCount = (project: Project): number => {
    return project.pptJson?.slides?.length || 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">我的项目</h1>
            <p className="text-gray-500 mt-1">{projects.length} 个项目</p>
          </div>
          <div className="flex gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <Upload size={20} />
              {importing ? '导入中...' : '导入'}
            </button>
            {projects.length > 0 && (
              <button
                onClick={exportAll}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Download size={20} />
                导出全部
              </button>
            )}
            <Link
              href="/create"
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={20} />
              新建项目
            </Link>
          </div>
        </div>

        {/* Project Grid */}
        {projects.length === 0 ? (
          <div className="text-center py-20">
            <FileText size={64} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 mb-4">还没有项目</p>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={20} />
              创建第一个项目
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => {
              const statusInfo = getStatusInfo(project.status);
              const styleTag = getStyleTag(project);
              const pageCount = getPageCount(project);
              const StatusIcon = statusInfo.icon;

              return (
                <div
                  key={project.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* Thumbnail Preview */}
                  <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center relative">
                    {project.pptJson?.slides?.[0] ? (
                      <div className="w-full h-full p-4 flex items-center justify-center">
                        <div className="bg-white rounded shadow-sm border border-gray-200 p-3 w-full max-w-[200px] aspect-video">
                          <div className="text-xs font-bold text-gray-800 truncate">
                            {project.pptJson.slides[0].title || '无标题'}
                          </div>
                          <div className="text-[8px] text-gray-500 mt-1 line-clamp-2">
                            {project.pptJson.slides[0].mainConclusion || '无内容'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-400">
                        <FileText size={48} />
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="absolute top-3 right-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${statusInfo.color}`}>
                        <StatusIcon size={12} />
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-gray-900 mb-2 truncate">{project.title}</h3>

                    <div className="flex items-center gap-3 text-sm text-gray-500 mb-4">
                      {pageCount > 0 && (
                        <span>{pageCount} 页</span>
                      )}
                      {styleTag && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span className={`px-2 py-0.5 text-xs rounded ${styleTag.color}`}>
                            {styleTag.label}
                          </span>
                        </>
                      )}
                    </div>

                    <p className="text-sm text-gray-400 mb-4">
                      更新于 {new Date(project.updatedAt).toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/create?id=${project.id}`}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                      >
                        <Edit size={16} />
                        编辑
                      </Link>

                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === project.id ? null : project.id)}
                          className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          <MoreVertical size={18} className="text-gray-600" />
                        </button>

                        {openMenuId === project.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenMenuId(null)}
                            />
                            <div className="absolute right-0 top-full mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                              <button
                                onClick={() => { exportProject(project); setOpenMenuId(null); }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Download size={16} />
                                导出 JSON
                              </button>
                              <button
                                onClick={() => { duplicateProject(project); setOpenMenuId(null); }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Copy size={16} />
                                复制项目
                              </button>
                              <hr className="my-1 border-gray-100" />
                              <button
                                onClick={() => { deleteProject(project.id); setOpenMenuId(null); }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                <Trash2 size={16} />
                                删除
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
