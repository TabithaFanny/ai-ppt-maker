'use client';

import { useState, useEffect, useRef } from 'react';
import { Package, Upload, Download, Trash2, Sparkles, Palette } from 'lucide-react';
import Header from '@/components/shell/Header';
import { readStylePackFile, downloadStylePack, type StylePack } from '@/lib/style-pack';

const STORAGE_KEY = 'ai-ppt-template-library';

function loadPacks(): StylePack[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePacks(packs: StylePack[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(packs));
}

export default function TemplatesPage() {
  const [packs, setPacks] = useState<StylePack[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setPacks(loadPacks()); }, []);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const pack = await readStylePackFile(file);
    if (!pack) { alert('无效的风格包文件'); return; }
    const updated = [...packs, pack];
    savePacks(updated);
    setPacks(updated);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDelete = (index: number) => {
    if (!confirm('确定删除这个模板？')) return;
    const updated = packs.filter((_, i) => i !== index);
    savePacks(updated);
    setPacks(updated);
  };

  const handleExport = (pack: StylePack) => {
    downloadStylePack(pack);
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8 md:px-8 md:py-10">
        <div className="mb-8 rounded-[28px] border border-[#e2e8f0] bg-gradient-to-br from-white via-[#f8fbff] to-[#eff6ff] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)] md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#c7d2fe] bg-white px-3 py-1 text-[11px] font-medium text-[#4338ca] shadow-sm">
                <Package size={12} />
                风格包沉淀
              </div>
              <h1 className="mt-4 text-3xl font-bold text-gray-900 md:text-4xl">模板库</h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                从项目中导出的风格包会沉淀在这里，可以在新项目中一键导入复用。
              </p>
            </div>
            <div>
              <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 rounded-2xl bg-[#4338ca] px-6 py-3 text-sm font-medium text-white shadow-[0_10px_24px_rgba(99,102,241,0.24)] hover:bg-[#3730a3]"
              >
                <Upload size={16} />
                导入风格包
              </button>
            </div>
          </div>
        </div>

        {packs.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[#cbd5e1] bg-white py-20 text-center shadow-sm">
            <Package size={64} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-semibold text-gray-700 mb-2">还没有模板</p>
            <p className="mb-5 text-sm text-gray-500">在工作台完成风格分析后，点击&quot;导出风格包&quot;即可沉淀到这里。</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packs.map((pack, index) => {
              const colors = pack.masterTemplate?.colorSystem;
              const slideCount = pack.referenceSlidePrompts?.length || 0;
              return (
                <div key={index} className="overflow-hidden rounded-[24px] border border-[#e2e8f0] bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(15,23,42,0.12)]">
                  {/* Color strip preview */}
                  <div className="h-24 flex items-center justify-center gap-3 p-4" style={{ background: colors?.background || '#f8fafc' }}>
                    {colors && (
                      <>
                        <div className="w-10 h-10 rounded-xl shadow-sm" style={{ backgroundColor: colors.primary }} title="主色" />
                        <div className="w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: colors.secondary }} title="辅色" />
                        {colors.accent && <div className="w-6 h-6 rounded-md shadow-sm" style={{ backgroundColor: colors.accent }} title="强调色" />}
                      </>
                    )}
                    {pack.thumbnails?.[0] && (
                      <img src={pack.thumbnails[0]} alt="" className="h-16 rounded-lg object-cover shadow-sm" />
                    )}
                  </div>

                  <div className="p-5">
                    <h2 className="mb-1 truncate text-lg font-bold text-gray-900">{pack.name}</h2>
                    <p className="mb-3 text-sm text-gray-500 line-clamp-2">{pack.description}</p>

                    <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
                      <span className="rounded-full bg-[#eef2ff] px-2 py-1 text-[#4338ca]">{slideCount} 页分析</span>
                      {pack.masterTemplate?.styleTags?.slice(0, 2).map((tag) => (
                        <span key={tag} className="rounded-full bg-gray-100 px-2 py-1 text-gray-600">{tag}</span>
                      ))}
                    </div>

                    <p className="mb-4 text-xs text-gray-400">
                      {new Date(pack.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleExport(pack)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#4338ca] px-3 py-2.5 text-sm font-medium text-white hover:bg-[#3730a3]"
                      >
                        <Download size={14} />
                        下载
                      </button>
                      <button
                        onClick={() => handleDelete(index)}
                        className="rounded-xl border border-gray-200 p-2.5 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
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
