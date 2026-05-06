'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Sparkles, Download, Settings, Save, Image, X, Upload, FileText, Package, ArrowRight } from 'lucide-react';
import { useStore } from '@/lib/store';
import { assetService } from '@/lib/db';
import { exportRenderSpecToPPTX } from '@/lib/export-pptx';
import { buildRenderSpec } from '@/lib/render-spec';
import { exportWorkbenchToPPTX } from '@/lib/export-workbench-pptx';
import { exportStylePack, downloadStylePack, readStylePackFile } from '@/lib/style-pack';

export default function WorkbenchHeader() {
  const store = useStore();
  const { currentProject, currentStyleKit, referenceSlides, referenceSlidePrompts, generatedSlidePrompts, generatedSlideResults, masterTemplate, saveStatus, saveWorkbench, assetLibrary, addAsset, removeAsset, setMasterTemplate, setReferenceSlidePrompts } = store;
  const [exporting, setExporting] = useState(false);
  const [assetPanelOpen, setAssetPanelOpen] = useState(false);
  const [assetUploading, setAssetUploading] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const refCount = referenceSlides.length;
  const newCount = generatedSlidePrompts.length;
  const analyzedCount = referenceSlidePrompts.length;
  const generatedCount = generatedSlideResults.filter((r) => r.status === 'generated' || r.status === 'confirmed').length;

  const nextAction = (() => {
    if (refCount === 0) return '下一步：上传参考 PPT';
    if (analyzedCount < refCount) return `下一步：等待参考页分析完成 ${analyzedCount}/${refCount}`;
    if (newCount === 0) return '下一步：告诉 AI 你要做什么 PPT';
    if (generatedCount < newCount) return `下一步：生成剩余页面 ${generatedCount}/${newCount}`;
    return '下一步：检查结果并导出 PPTX';
  })();

  useEffect(() => {
    const el = document.createElement('div');
    el.id = 'asset-panel-portal';
    document.body.appendChild(el);
    setPortalContainer(el);
    return () => {
      try {
        // Clear children first to avoid React removeChild race
        el.innerHTML = '';
        if (el.parentNode) el.parentNode.removeChild(el);
      } catch {
        // Ignore if already removed
      }
    };
  }, []);

  const workbenchResults = generatedSlideResults.filter((r) => r.status === 'generated' || r.status === 'confirmed');
  const canExport = !exporting && (!!currentProject?.pptJson || workbenchResults.length > 0);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // Prefer workbench results if available
      if (workbenchResults.length > 0) {
        const warnings = await exportWorkbenchToPPTX(
          workbenchResults,
          generatedSlidePrompts,
          { fileName: currentProject?.title || 'output', masterTemplate },
        );
        if (warnings.length > 0) console.warn('[ExportPPTX]', warnings);
        return;
      }
      // Fallback: old wizard flow
      if (!currentProject?.pptJson) return;
      const styleConfig = currentProject.styleConfig ?? undefined;
      const style = styleConfig || currentStyleKit;
      if (!style) return;
      const spec = buildRenderSpec(currentProject.pptJson, style);
      await exportRenderSpecToPPTX(spec, { fileName: currentProject.title || 'output' });
    } catch (err) {
      console.error('[ExportPPTX] failed', err);
    } finally {
      setExporting(false);
    }
  };

  const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !currentProject) return;
    setAssetUploading(true);
    try {
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const assetId = await assetService.getNextAssetId(currentProject.id);
        const type = file.type.startsWith('image/') ? 'image' as const : 'image' as const;
        const asset = {
          projectId: currentProject.id,
          assetId,
          name: file.name.replace(/\.[^.]+$/, ''),
          type,
          url: dataUrl,
          description: `上传于 ${new Date().toLocaleDateString('zh-CN')}`,
        };
        await assetService.save(asset);
        addAsset({ assetId, name: asset.name, type: asset.type, url: asset.url, description: asset.description });
      }
      await saveWorkbench();
    } finally {
      setAssetUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveAsset = async (assetId: string) => {
    const assets = await assetService.getByProject(currentProject!.id);
    const dbAsset = assets.find((a) => a.assetId === assetId);
    if (dbAsset) await assetService.delete(dbAsset.id);
    removeAsset(assetId);
  };

  return (
    <header className="relative border-b border-[#e2e8f0] bg-[#f8fafc]/95 backdrop-blur-sm">
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1e40af] shadow-[0_8px_20px_rgba(37,99,235,0.28)]">
              <Sparkles size={14} className="text-white" />
            </div>
            <span className="hidden text-sm font-semibold text-[var(--color-text-primary)] sm:inline">
              AI PPT Generator
            </span>
          </Link>
          <div className="hidden h-8 w-px bg-[#e2e8f0] sm:block" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--color-text-primary)] max-w-[220px]">
              {currentProject?.title || '新项目'}
            </p>
            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[#64748b]">
              <span className="rounded-full bg-white px-2 py-0.5 border border-[#e2e8f0]">
                参考 {refCount} 页
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 border border-[#e2e8f0]">
                新稿 {newCount} 页
              </span>
              {currentStyleKit && (
                <span className="rounded-full bg-[#dbeafe] px-2 py-0.5 text-[#1d4ed8] border border-[#bfdbfe]">
                  StyleKit 已关联
                </span>
              )}
            </div>
          </div>
          <div className="hidden min-w-0 items-center gap-2 rounded-lg border border-[#bfdbfe] bg-white px-3 py-2 text-[11px] font-medium text-[#1d4ed8] xl:flex">
            <ArrowRight size={13} className="flex-shrink-0" />
            <span className="truncate max-w-[260px]">{nextAction}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
          {/* Document upload button */}
          <button
            onClick={async () => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.docx,.doc,.pdf';
              input.multiple = true;
              input.onchange = async (e) => {
                const files = (e.target as HTMLInputElement).files;
                if (!files || files.length === 0) return;
                for (const file of Array.from(files)) {
                  try {
                    const formData = new FormData();
                    formData.append('file', file);
                    const res = await fetch('/api/upload', { method: 'POST', body: formData });
                    const json = await res.json();
                    if (!res.ok) { alert(json.error || `上传 ${file.name} 失败`); continue; }
                    const fileId = json.data?.fileId || json.fileId;
                    const res2 = await fetch('/api/extract-document', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ fileId }),
                    });
                    const json2 = await res2.json();
                    if (!res2.ok) { alert(json2.error || `提取 ${file.name} 失败`); continue; }
                    const extractedText = (json2.data as { text?: string } | undefined)?.text || '';
                    store.addUploadedDocument({ docId: fileId, name: file.name, text: extractedText });
                  } catch (err) {
                    alert(`处理 ${file.name} 时出错: ${err instanceof Error ? err.message : '未知错误'}`);
                  }
                }
                await store.saveWorkbench();
              };
              input.click();
            }}
            className="flex items-center gap-1 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-xs text-[var(--color-text-secondary)] transition-colors hover:bg-slate-50"
          >
            <FileText size={12} />
            <span>上传文档</span>
          </button>
          {/* Asset Library button */}
          <button
            onClick={() => setAssetPanelOpen(!assetPanelOpen)}
            className={`flex items-center gap-1 rounded-xl border px-3 py-2 text-xs transition-colors ${
              assetPanelOpen
                ? 'border-[#bfdbfe] bg-[#dbeafe] text-[#1e40af]'
                : 'border-[#e2e8f0] bg-white text-[var(--color-text-secondary)] hover:bg-slate-50'
            }`}
          >
            <Image size={12} />
            <span>资产库</span>
            {assetLibrary.length > 0 && (
              <span className="bg-[#1e40af] text-white text-[9px] px-1 rounded-full">{assetLibrary.length}</span>
            )}
          </button>
          {/* Style Pack export/import */}
          {masterTemplate && (
            <button
              onClick={() => {
                if (!masterTemplate) return;
                const pack = exportStylePack(
                  currentProject?.title || '未命名风格',
                  `从 ${referenceSlides.length} 页参考页提取`,
                  masterTemplate,
                  referenceSlidePrompts,
                  referenceSlides.map((s) => s.thumbnailBase64).filter(Boolean),
                );
                downloadStylePack(pack);
              }}
              className="flex items-center gap-1 rounded-xl border border-[#c7d2fe] bg-[#eef2ff] px-3 py-2 text-xs text-[#4338ca] hover:bg-[#e0e7ff] transition-colors"
            >
              <Package size={12} />
              <span className="hidden sm:inline">导出风格包</span>
            </button>
          )}
          <button
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.json';
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                const pack = await readStylePackFile(file);
                if (!pack) { alert('无效的风格包文件'); return; }
                setMasterTemplate(pack.masterTemplate);
                if (pack.referenceSlidePrompts?.length && setReferenceSlidePrompts) {
                  setReferenceSlidePrompts(pack.referenceSlidePrompts);
                }
                await saveWorkbench();
                alert(`已导入风格包「${pack.name}」(${pack.referenceSlidePrompts.length} 页分析)`);
              };
              input.click();
            }}
            className="flex items-center gap-1 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:bg-slate-50 transition-colors"
          >
            <Upload size={12} />
            <span className="hidden sm:inline">导入风格包</span>
          </button>
          <button
            onClick={() => setShowTemplateLibrary(true)}
            className="flex items-center gap-1 rounded-xl border border-[#c7d2fe] bg-[#eef2ff] px-3 py-2 text-xs text-[#4338ca] hover:bg-[#e0e7ff] transition-colors"
          >
            <Package size={12} />
            <span className="hidden sm:inline">从模板库导入</span>
          </button>
          <button
            onClick={saveWorkbench}
            disabled={saveStatus === 'saving'}
            className={`flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
              saveStatus === 'saved'
                ? 'border border-green-200 bg-green-100 text-green-700 hover:bg-green-200'
                : 'border border-[#e2e8f0] bg-white text-[var(--color-text-secondary)] hover:bg-slate-50'
            }`}
          >
            <Save size={12} />
            <span>{saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '已保存' : '保存'}</span>
          </button>
          <button
            onClick={handleExport}
            disabled={!canExport}
            className="flex items-center gap-1 rounded-xl bg-[#1e40af] px-3 py-2 text-xs font-medium text-white shadow-[0_8px_18px_rgba(37,99,235,0.24)] hover:bg-[#1e40af]/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={12} />
            <span className="hidden sm:inline">{exporting ? '导出中...' : '导出 PPTX'}</span>
          </button>
          <Link
            href="/settings"
            className="rounded-xl border border-[#e2e8f0] bg-white p-2 text-[var(--color-text-secondary)] hover:bg-slate-50"
          >
            <Settings size={16} />
          </Link>
        </div>

        {/* Template library modal */}
        {showTemplateLibrary && (
          <TemplateLibraryModal
            onSelect={async (pack) => {
              setMasterTemplate(pack.masterTemplate);
              if (pack.referenceSlidePrompts?.length && setReferenceSlidePrompts) {
                setReferenceSlidePrompts(pack.referenceSlidePrompts);
              }
              await saveWorkbench();
              setShowTemplateLibrary(false);
              alert(`已导入风格包「${pack.name}」`);
            }}
            onClose={() => setShowTemplateLibrary(false)}
          />
        )}

        {portalContainer && assetPanelOpen && createPortal(
          <div className="fixed right-4 top-[72px] z-[99999] w-72 rounded-2xl border border-[var(--color-border)] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.16)]">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
              <span className="text-xs font-semibold">资产库</span>
              <button onClick={() => setAssetPanelOpen(false)} title="关闭资产库" className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </div>
            <div className="p-2 max-h-64 overflow-y-auto space-y-1.5">
              {assetLibrary.length === 0 ? (
                <p className="text-[10px] text-gray-400 text-center py-4">暂无资产，点击下方上传</p>
              ) : (
                assetLibrary.map((asset) => (
                  <div key={asset.assetId} className="flex items-center gap-2 p-1.5 rounded border border-gray-100 hover:border-gray-200">
                    <img src={asset.url} alt={asset.name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium text-gray-700 truncate">{asset.name}</p>
                      <p className="text-[8px] text-gray-400">[{asset.assetId}] · {asset.type}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveAsset(asset.assetId)}
                      title={`删除资产 ${asset.name}`}
                      className="text-gray-300 hover:text-red-500 flex-shrink-0"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))
              )}
              <label className="flex items-center gap-1 w-full p-2 rounded border border-dashed border-gray-300 text-center cursor-pointer hover:border-[#1e40af] transition-colors text-[10px] text-gray-400">
                <Upload size={10} />
                <span>{assetUploading ? '上传中...' : '上传图片/Logo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleAssetUpload}
                  disabled={assetUploading}
                  className="hidden"
                />
              </label>
            </div>
          </div>,
          portalContainer
        )}
      </div>
    </header>
  );
}

const TEMPLATE_STORAGE_KEY = 'ai-ppt-template-library';

function TemplateLibraryModal({ onSelect, onClose }: {
  onSelect: (pack: import('@/lib/style-pack').StylePack) => void;
  onClose: () => void;
}) {
  const [packs, setPacks] = useState<import('@/lib/style-pack').StylePack[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
      if (raw) setPacks(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  return (
    <div className="fixed inset-0 z-[99998] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-[500px] max-h-[70vh] rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-sm font-bold text-gray-900">从模板库导入风格包</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[55vh] space-y-3">
          {packs.length === 0 ? (
            <div className="text-center py-10">
              <Package size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500">模板库为空</p>
              <p className="text-xs text-gray-400 mt-1">在工作台点击&quot;导出风格包&quot;后，模板会沉淀在这里。</p>
            </div>
          ) : packs.map((pack, i) => (
            <button
              key={i}
              onClick={() => onSelect(pack)}
              className="flex w-full items-center gap-4 rounded-xl border border-gray-200 p-3 text-left transition-all hover:border-[#4338ca] hover:bg-[#eef2ff]"
            >
              <div className="flex gap-1">
                {pack.masterTemplate?.colorSystem && (
                  <>
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: pack.masterTemplate.colorSystem.primary }} />
                    <div className="w-5 h-5 rounded" style={{ backgroundColor: pack.masterTemplate.colorSystem.secondary }} />
                  </>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{pack.name}</p>
                <p className="text-xs text-gray-500 truncate">{pack.description}</p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-400">
                  <span>{pack.referenceSlidePrompts?.length || 0} 页分析</span>
                  <span>{new Date(pack.createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
