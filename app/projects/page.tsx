'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { projectService, workbenchService, type WorkbenchSnapshot } from '@/lib/db';
import { Project } from '@/types';
import {
  Plus, Trash2, Copy, Download, Upload, MoreVertical,
  Edit, CheckCircle2, Clock, AlertCircle, Sparkles, FileText
} from 'lucide-react';
import { importExportService } from '@/lib/import-export';
import Header from '@/components/shell/Header';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [snapshots, setSnapshots] = useState<Record<string, WorkbenchSnapshot>>({});

  const loadProjects = async () => {
    const data = await projectService.getAll();
    setProjects(data);
    // Load workbench snapshots for thumbnail previews (parallel)
    const snapshotMap: Record<string, WorkbenchSnapshot> = {};
    await Promise.all(data.map(async (p) => {
      const snap = await workbenchService.load(p.id);
      if (snap) snapshotMap[p.id] = snap;
    }));
    setSnapshots(snapshotMap);
    setLoading(false);
  };  useEffect(() => {
    loadProjects();
  }, []);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const deleteProject = async (id: string) => {
    if (!confirm('确定要删除这个项目吗？')) return;
    await projectService.delete(id);
    loadProjects();
  };

  const startRename = (project: Project) => {
    setRenamingId(project.id);
    setRenameValue(project.title);
    setOpenMenuId(null);
  };

  const confirmRename = async (id: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    await projectService.update(id, { title: trimmed });
    setRenamingId(null);
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

  // 搜索和筛选
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredProjects = projects.filter((p) => {
    const matchSearch = !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

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
    <div className="min-h-screen bg-[var(--color-surface)]">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8 md:px-8 md:py-10">
        {/* Page header */}
        <div className="mb-8 rounded-[28px] border border-[#e2e8f0] bg-gradient-to-br from-white via-[#f8fbff] to-[#eff6ff] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)] md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-white px-3 py-1 text-[11px] font-medium text-[#1d4ed8] shadow-sm">
              <Sparkles size={12} />
              项目工作区
            </div>
            <h1 className="mt-4 text-3xl font-bold text-gray-900 md:text-4xl">我的项目</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">统一查看、筛选、继续编辑和导出你的 AI PPT 项目。当前共 {projects.length} 个项目。</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              ref={fileInputRef}
              type="file"
              title="导入项目 JSON 文件"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Upload size={20} />
              {importing ? '导入中...' : '导入'}
            </button>
            {projects.length > 0 && (
              <button
                onClick={exportAll}
                className="flex items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Download size={20} />
                导出全部
              </button>
            )}
            <Link
              href="/create?new=1"
              className="flex items-center gap-2 rounded-2xl bg-[#1e40af] px-6 py-3 text-sm font-medium text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] hover:bg-blue-700"
            >
              <Plus size={20} />
              新建项目
            </Link>
          </div>
          </div>
        </div>

        {/* 搜索和筛选栏 */}
        {projects.length > 0 && (
          <div className="mb-6 rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索项目标题..."
                className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['all', 'draft', 'completed', 'generating'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    statusFilter === s
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {s === 'all' ? '全部' : s === 'draft' ? '草稿' : s === 'completed' ? '已完成' : '生成中'}
                </button>
              ))}
            </div>
            <span className="ml-auto rounded-full bg-[#f8fafc] px-3 py-1 text-sm text-gray-400">{filteredProjects.length} / {projects.length}</span>
            </div>
          </div>
        )}

        {/* Project Grid */}
        {filteredProjects.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[#cbd5e1] bg-white py-20 text-center shadow-sm">
            <FileText size={64} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-semibold text-gray-700 mb-2">还没有项目</p>
            <p className="mb-5 text-sm text-gray-500">从上传参考 PPT 开始，创建你的第一个 AI PPT 项目。</p>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={20} />
              创建第一个项目
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => {
              const statusInfo = getStatusInfo(project.status);
              const styleTag = getStyleTag(project);
              const pageCount = getPageCount(project);
              const StatusIcon = statusInfo.icon;

              return (
                <div
                  key={project.id}
                  className="overflow-hidden rounded-[24px] border border-[#e2e8f0] bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(15,23,42,0.12)]"
                >
                  {/* Thumbnail Preview */}
                  <div className="relative flex h-44 items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50">
                    {(() => {
                      const snap = snapshots[project.id];
                      const resultImg = snap?.generatedSlideResults?.[0]?.previewImage;
                      const refThumb = snap?.referenceSlides?.[0]?.thumbnailBase64;
                      const thumb = resultImg || refThumb;
                      if (thumb) {
                        return (
                          <img
                            src={thumb.startsWith('data:') ? thumb : `data:image/png;base64,${thumb}`}
                            alt={project.title}
                            className="w-full h-full object-contain p-2"
                          />
                        );
                      }
                      if (project.pptJson?.slides?.[0]) {
                        return (
                          <div className="w-full h-full p-4 flex items-center justify-center">
                            <div className="aspect-video w-full max-w-[200px] rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                              <div className="text-xs font-bold text-gray-800 truncate">
                                {project.pptJson.slides[0].title || '无标题'}
                              </div>
                              <div className="text-[8px] text-gray-500 mt-1 line-clamp-2">
                                {project.pptJson.slides[0].mainConclusion || '无内容'}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div className="text-gray-400">
                          <FileText size={48} />
                        </div>
                      );
                    })()}

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
                    {renamingId === project.id ? (
                      <div className="mb-2 flex items-center gap-1">
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(project.id); if (e.key === 'Escape') setRenamingId(null); }}
                          className="flex-1 rounded-lg border border-blue-300 px-2 py-1 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button onClick={() => confirmRename(project.id)} className="rounded-lg bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700">确定</button>
                        <button onClick={() => setRenamingId(null)} className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50">取消</button>
                      </div>
                    ) : (
                      <h2 className="mb-2 truncate text-lg font-bold text-gray-900">{project.title}</h2>
                    )}

                    <div className="mb-4 flex items-center gap-3 text-sm text-gray-500">
                      {pageCount > 0 && (
                        <span className="rounded-full bg-[#f8fafc] px-2 py-1 text-xs text-gray-600">{pageCount} 页</span>
                      )}
                      {styleTag && (
                        <>
                          <span className={`rounded-full px-2 py-1 text-xs ${styleTag.color}`}>
                            {styleTag.label}
                          </span>
                        </>
                      )}
                    </div>

                    <p className="mb-4 text-sm text-gray-400">
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
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        <Edit size={16} />
                        编辑
                      </Link>

                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === project.id ? null : project.id)}
                          className="rounded-xl border border-gray-200 p-2.5 hover:bg-gray-50"
                          title="更多操作"
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
                                onClick={() => startRename(project)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Edit size={16} />
                                重命名
                              </button>
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
      </main>
    </div>
  );
}
