'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { Copy, RefreshCw, Loader2, Check, ChevronDown, ChevronRight, Save } from 'lucide-react';
import type { RefSlidePrompt, VisualElement, ElementBackground, ElementType } from '@/types';
import MasterTemplateCard from './MasterTemplateCard';

const ELEMENT_TYPES = new Set<string>([
  'shape',
  'image',
  'text',
  'table',
  'chart',
  'graph',
  'diagram',
  'icon',
  'logo',
]);

async function readApiResponse(res: Response) {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {
      error: `${res.status} ${res.statusText || 'HTTP Error'}: ${text.slice(0, 300)}`,
    };
  }
}

function getApiErrorMessage(json: Record<string, unknown>, fallback: string) {
  const error = json.error;
  if (error && typeof error === 'object') {
    const err = error as { code?: string; message?: string; detail?: string };
    return [err.code, err.message || fallback, err.detail ? `详情：${err.detail.slice(0, 160)}` : ''].filter(Boolean).join('｜');
  }
  if (typeof error === 'string') return error;
  if (typeof json.message === 'string') return json.message;
  return fallback;
}

/** Convert numeric font weight to CSS-style label */
function weightLabel(w: number | string | undefined): string {
  if (typeof w === 'string') return w;
  const map: Record<number, string> = {
    100: 'thin', 200: 'extralight', 300: 'light', 400: 'normal',
    500: 'medium', 600: 'semibold', 700: 'bold', 800: 'extrabold', 900: 'black',
  };
  if (typeof w === 'number') return map[Math.round(w / 100) * 100] || w.toString();
  return 'bold';
}

export default function ReferencePromptPanel() {
  const store = useStore();
  const {
    referenceSlides,
    selectedRefSlideIndex,
    referenceSlidePrompts,
    upsertReferenceSlidePrompt,
    referenceSlideAnalysisStatus,
    referenceSlideAnalysisErrors,
    setReferenceSlideAnalysisStatus,
    addTemplatePrompt,
  } = store;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedAsTemplate, setSavedAsTemplate] = useState(false);

  const selectedSlide = referenceSlides.find(
    (s) => s.slideIndex === selectedRefSlideIndex
  );

  const currentPrompt = referenceSlidePrompts.find(
    (p) => p.slideIndex === selectedRefSlideIndex
  );
  const currentAnalysisStatus = selectedRefSlideIndex ? referenceSlideAnalysisStatus[selectedRefSlideIndex] || 'idle' : 'idle';
  const currentAnalysisError = selectedRefSlideIndex ? referenceSlideAnalysisErrors[selectedRefSlideIndex] || null : null;

  const analyzeSlide = useCallback(async () => {
    if (!selectedSlide) return;
    if (currentAnalysisStatus === 'queued' || currentAnalysisStatus === 'analyzing' || currentAnalysisStatus === 'done') return;
    if (currentPrompt) return; // Already analyzed, skip

    setLoading(true);
    setError(null);
    setReferenceSlideAnalysisStatus(selectedSlide.slideIndex, 'analyzing');

    try {
      if (!selectedSlide.thumbnailBase64?.trim()) {
        throw new Error('MISSING_IMAGE_BASE64｜该页缺少图像，无法分析。');
      }
      const res = await fetch('/api/analyze-slide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slideIndex: selectedSlide.slideIndex,
          imageBase64: selectedSlide.thumbnailBase64,
          textContent: selectedSlide.extractedText || '',
          slideXML: selectedSlide.slideXML || '',
        }),
      });

      const json = await readApiResponse(res);
      if (!res.ok) throw new Error(getApiErrorMessage(json, '分析失败'));

      const data = json.data || json;

      // Detect schema version by checking for nested vs flat structure
      // v1: has styleAnalysis/pageIdentity nested objects (old format)
      // v2: has slideType/layout/colorSystem flat top-level (new format)
      const isV1Nested = !!(data.styleAnalysis && data.pageIdentity);

      let prompt: RefSlidePrompt;

      if (isV1Nested) {
        // ===== v1 nested format (old reference analyzer) =====
        const style = data.styleAnalysis || {};
        const palette = (style.colorPalette || []) as Array<Record<string, string>>;
        const allColors = palette.map((c) => c.hex || '').filter(Boolean);
        const typo = style.typography || {};

        // Map boundingBox (0-1) to rect (0-100) for backward compatibility
        const mappedElements: VisualElement[] = (data.elements || []).map((el: Record<string, unknown>) => {
          const bb = (el.boundingBox || { x: 0, y: 0, w: 1, h: 1 }) as Record<string, number>;
          const st = (el.style || {}) as Record<string, unknown>;
          return {
            type: (el.type as ElementType) || 'shape',
            rect: {
              x: Math.round((bb.x || 0) * 100),
              y: Math.round((bb.y || 0) * 100),
              w: Math.round((bb.w || 0) * 100),
              h: Math.round((bb.h || 0) * 100),
            },
            content: {
              text: ((el.content as Record<string, unknown>)?.text as string) || '',
              imageDescription: ((el.content as Record<string, unknown>)?.imageDescription as string) || '',
            },
            style: {
              fontSize: st.fontSize ? parseInt(String(st.fontSize)) : undefined,
              fontWeight: (st.fontWeight as string) || undefined,
              color: (st.textColor as string) || (st.fill as string) || undefined,
              textAlign: (st.alignment as 'left' | 'center' | 'right' | 'justify') || undefined,
              borderRadius: st.borderRadius ? parseInt(String(st.borderRadius)) : undefined,
              opacity: st.opacity as number | undefined,
            },
            purpose: ((el.content as Record<string, unknown>)?.semanticMeaning as string) || (el.role as string) || '',
          };
        });

        prompt = {
          slideIndex: selectedSlide.slideIndex,
          pageType: (data.pageIdentity as Record<string, unknown>)?.detectedPageType as string || '内容页',
          visualDescription: (data.layoutPattern as Record<string, unknown>)?.structureSummary as string || '',
          layoutStructure: (data.layoutPattern as Record<string, unknown>)?.name as string || 'single',
          colorRules: {
            primary: palette.find((c) => c.role === 'primary')?.hex || '#1e40af',
            secondary: palette.find((c) => c.role === 'secondary')?.hex || '#60a5fa',
            accent: palette.find((c) => c.role === 'accent')?.hex || '#f59e0b',
            background: palette.find((c) => c.role === 'background')?.hex || '#ffffff',
            text: palette.find((c) => c.role === 'text')?.hex || '#1f2937',
          },
          fontHierarchy: {
            titleSize: parseInt((typo.title as Record<string, string>)?.fontSizeEstimate || '36'),
            bodySize: parseInt((typo.body as Record<string, string>)?.fontSizeEstimate || '16'),
            titleWeight: (typo.title as Record<string, string>)?.fontWeight || 'bold',
          },
          reusablePrompt: (data.prompts as Record<string, unknown>)?.slideVisualPrompt as string || '',
          styleTags: (style.overallStyle as string[]) || [],
          background: {
            type: 'solid',
            colors: allColors.slice(0, 3),
            description: '',
          },
          elements: mappedElements,
          layoutPatternDescription: (data.layoutPattern as Record<string, unknown>)?.structureSummary as string || '',
          styleSummary: {
            allColors,
            fontSystem: [
              (typo.title as Record<string, string>)?.fontFamilyGuess,
              (typo.title as Record<string, string>)?.fontWeight,
              `${typo.title?.fontSizeEstimate || '36'}pt titles`,
              '·',
              (typo.body as Record<string, string>)?.fontFamilyGuess,
              `${typo.body?.fontSizeEstimate || '16'}pt body`,
            ].filter(Boolean).join(' '),
            spacing: 'Standard spacing',
            effects: (style.shapeLanguage as string[]) || [],
          },
          referenceAnalysisRaw: data as Record<string, unknown>,
        };
      } else {
        // ===== v2 flat format: slideType/layout/colorSystem/typography =====
        const colorSys = (data.colorSystem || {}) as Record<string, unknown>;
        const typ = (data.typography || {}) as Record<string, unknown>;
        const bg = (data.background || {}) as Record<string, unknown>;
        const sem = (data.semantic || {}) as Record<string, unknown>;
        const vis = (data.visualElements || []) as Array<Record<string, unknown>>;
        const layout = (data.layout || {}) as Record<string, unknown>;

        const getHex = (arr: unknown): string[] => {
          if (Array.isArray(arr)) {
            return arr.map((c) => typeof c === 'string' ? c : (c as Record<string, unknown>)?.hex as string || '').filter(Boolean);
          }
          return [];
        };

        const allColors = [...getHex(colorSys.primary), ...getHex(colorSys.secondary), ...getHex(colorSys.accent), ...getHex(colorSys.background)];

        prompt = {
          slideIndex: selectedSlide.slideIndex,
          pageType: (data.slideType as string) || '内容页',
          visualDescription: (layout.structure as string) || '',
          layoutStructure: (layout.grid as string) || 'single',
          colorRules: {
            primary: getHex(colorSys.primary)[0] || '#1e40af',
            secondary: getHex(colorSys.secondary)[0] || '#60a5fa',
            accent: getHex(colorSys.accent)[0] || '#f59e0b',
            background: getHex(colorSys.background)[0] || '#ffffff',
            text: '#1f2937',
          },
          fontHierarchy: {
            titleSize: parseInt((typ.title as Record<string, unknown>)?.fontSize as string || '36'),
            bodySize: parseInt((typ.body as Record<string, unknown>)?.fontSize as string || '16'),
            titleWeight: (typ.title as Record<string, unknown>)?.fontWeight as string || 'bold',
          },
          // slideVisualPrompt: the KEY field that tells AI how to generate this page
          reusablePrompt: (data.slideVisualPrompt as string) || '',
          styleTags: (sem.tone as string[]) || [],
          background: {
            type: (bg.type as 'solid' | 'gradient' | 'image' | 'pattern') || 'solid',
            colors: getHex(colorSys.background).slice(0, 3),
            description: [bg.style, bg.lighting, bg.texture].filter(Boolean).join(' '),
          },
          elements: vis.map((el) => {
            const rect = (el.rect || {}) as Record<string, number>;
            const content = (el.content || {}) as Record<string, unknown>;
            const elStyle = (el.elementStyle || {}) as Record<string, unknown>;
            return {
              type: (el.type as ElementType) || 'shape',
              rect: {
                x: rect.x ?? 0,
                y: rect.y ?? 0,
                w: rect.w ?? 0,
                h: rect.h ?? 0,
              },
              content: {
                text: (content.text as string) || '',
                imageDescription: (content.imageDescription as string) || '',
              },
              style: {
                fontSize: elStyle.fontSize ? Number(elStyle.fontSize) : undefined,
                fontWeight: (elStyle.fontWeight as string) || undefined,
                color: (elStyle.color as string) || (elStyle.fill as string) || undefined,
                textAlign: (elStyle.textAlign as 'left' | 'center' | 'right' | 'justify') || undefined,
                borderRadius: elStyle.borderRadius ? Number(elStyle.borderRadius) : undefined,
                opacity: elStyle.opacity as number | undefined,
              },
              purpose: (el.purpose as string) || (el.rebuildInstruction as string) || (el.positionHint as string) || '',
            };
          }) as RefSlidePrompt['elements'],
          layoutPatternDescription: (layout.structure as string) || '',
          styleSummary: {
            allColors,
            fontSystem: [
              (typ.title as Record<string, unknown>)?.fontFamily || '微软雅黑',
              (typ.title as Record<string, unknown>)?.fontWeight || 'bold',
              `${(typ.title as Record<string, unknown>)?.fontSize || '36'}pt titles`,
              '·',
              (typ.body as Record<string, unknown>)?.fontFamily || '微软雅黑',
              `${(typ.body as Record<string, unknown>)?.fontSize || '16'}pt body`,
            ].filter(Boolean).join(' '),
            spacing: (layout.padding as string) || 'Standard spacing',
            effects: ((data.compositionRules as Record<string, unknown>)?.mustFollow as string[]) || [],
          },
          referenceAnalysisRaw: data as Record<string, unknown>,
        };
      }
      upsertReferenceSlidePrompt(prompt);
      setReferenceSlideAnalysisStatus(selectedSlide.slideIndex, 'done');
      // Persist immediately so data survives refresh
      await store.saveWorkbench();
    } catch (err) {
      const message = err instanceof Error ? err.message : '分析失败';
      setError(message);
      setReferenceSlideAnalysisStatus(selectedSlide.slideIndex, 'error', message);
      await store.saveWorkbench();
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAnalysisStatus, selectedSlide?.slideIndex, setReferenceSlideAnalysisStatus, upsertReferenceSlidePrompt, store]);

  // Auto-analyze when selecting a new slide (only when prompt is missing AND status is idle)
  useEffect(() => {
    if (selectedSlide && !currentPrompt && !loading && currentAnalysisStatus === 'idle') {
      analyzeSlide();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlide?.slideIndex]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <PanelWrapper title="参考页拆解">
      {!selectedSlide ? (
        <div className="flex flex-1 flex-col p-4 gap-3 overflow-y-auto">
          <MasterTemplateCard />
          <div className="flex flex-1 items-center justify-center text-center">
            <div className="w-full rounded-[22px] border border-dashed border-[#cbd5e1] bg-gradient-to-br from-[#f8fafc] to-white p-6">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#dbeafe] text-[#1d4ed8]">
                <ChevronRight size={22} />
              </div>
              <p className="text-sm font-semibold text-[#0f172a]">等待选择参考页</p>
              <p className="mt-1 text-xs leading-relaxed text-[#64748b]">
                点击左侧任意参考页后，这里会展示页面背景、元素拆分、色彩和可复用 Prompt。
              </p>
            </div>
          </div>
        </div>
      ) : currentPrompt ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#f8fafc]">
          <MasterTemplateCard />
          {/* 非致命错误提示：元素拆解失败但风格分析已保存 */}
          {(error || currentAnalysisError) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-700">
              {error || currentAnalysisError}
            </div>
          )}

          <div className="rounded-2xl border border-[#dbeafe] bg-gradient-to-br from-[#eff6ff] to-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#0f172a]">第 {selectedSlide.slideIndex} 页拆解完成</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[#64748b]">
                  可直接复制复用 Prompt，或查看背景、元素和完整风格摘要。
                </p>
              </div>
              <button
                onClick={() => handleCopy(currentPrompt.reusablePrompt)}
                className="inline-flex items-center gap-1 rounded-xl border border-[#bfdbfe] bg-white px-3 py-1.5 text-[11px] font-medium text-[#1d4ed8] hover:bg-[#eff6ff]"
              >
                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                {copied ? '已复制' : '复制 Prompt'}
              </button>
            </div>
          </div>

          {/* 背景 */}
          {currentPrompt.background && (
            <BackgroundCard background={currentPrompt.background} />
          )}

          {/* 元素列表 */}
          {currentPrompt.elements && currentPrompt.elements.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-[#e2e8f0] bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="font-medium text-[#475569]">元素列表</span>
                <span className="rounded-full bg-[#eff6ff] px-2 py-0.5 text-[10px] text-[#1d4ed8]">{currentPrompt.elements.length} 个</span>
              </div>
              {currentPrompt.elements.map((el, i) => (
                <ElementCard key={`${el.type}-${i}`} element={el} index={i} />
              ))}
            </div>
          )}

          {/* 布局描述 */}
          {currentPrompt.layoutPatternDescription && (
            <Field label="布局关系" value={currentPrompt.layoutPatternDescription} />
          )}

          {/* Style Summary */}
          {currentPrompt.styleSummary && (
            <CollapsibleSection title="完整风格摘要" defaultOpen={false}>
              <div className="space-y-2">
                <div className="text-[10px]">
                  <span className="text-gray-400">色彩</span>
                  <div className="flex gap-1 mt-0.5">
                    {currentPrompt.styleSummary.allColors.map((c) => (
                      <div key={c} className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: c }} />
                        <span className="text-[9px] text-gray-500">{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-[10px]">
                  <span className="text-gray-400">字体系统</span>
                  <p className="text-gray-600">{currentPrompt.styleSummary.fontSystem}</p>
                </div>
                <div className="text-[10px]">
                  <span className="text-gray-400">间距</span>
                  <p className="text-gray-600">{currentPrompt.styleSummary.spacing}</p>
                </div>
                {currentPrompt.styleSummary.effects.length > 0 && (
                  <div className="text-[10px]">
                    <span className="text-gray-400">效果</span>
                    <p className="text-gray-600">{currentPrompt.styleSummary.effects.join(', ')}</p>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* 色彩规则速览 */}
          <div className="rounded-2xl border border-[#e2e8f0] bg-white p-3 text-xs shadow-sm">
            <span className="text-gray-400">色彩规则</span>
            <div className="flex gap-1 mt-1 flex-wrap">
              {Object.entries(currentPrompt.colorRules).map(([name, hex]) => (
                <div key={name} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: hex }} title={name} />
                  <span className="text-[10px] text-gray-500">{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 复用 Prompt */}
          <div className="rounded-2xl border border-[#e2e8f0] bg-white p-3 text-xs shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-400">可复用生成 Prompt</span>
              <button
                onClick={() => handleCopy(currentPrompt.reusablePrompt)}
                className="p-0.5 hover:bg-gray-100 rounded"
              >
                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-gray-400" />}
              </button>
            </div>
            <p className="text-[11px] text-gray-600 bg-gray-50 p-2 rounded border leading-relaxed max-h-32 overflow-y-auto">
              {currentPrompt.reusablePrompt}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={analyzeSlide}
              className="flex items-center gap-1 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-[10px] text-gray-500 hover:text-[#1e40af] shadow-sm"
            >
              <RefreshCw size={10} />
              重新拆解
            </button>
            <button
              onClick={async () => {
                if (!currentPrompt) return;
                const allColors = [
                  currentPrompt.colorRules.primary,
                  currentPrompt.colorRules.secondary,
                  currentPrompt.colorRules.accent,
                  currentPrompt.colorRules.background,
                  currentPrompt.colorRules.text,
                ].filter(Boolean);
                addTemplatePrompt({
                  id: `tpl-${Date.now()}`,
                  name: `第 ${currentPrompt.slideIndex} 页 - ${currentPrompt.pageType}`,
                  sourceFileId: '',
                  overallStyle: 'business',
                  colorPalette: allColors.map((hex, i) => ({
                    name: ['主色', '辅色', '强调', '背景', '文字'][i] || `色${i + 1}`,
                    hex,
                    role: (['primary', 'secondary', 'accent', 'background', 'text'] as const)[i] || 'primary',
                  })),
                  typography: {
                    titleFont: '',
                    bodyFont: '',
                    titleSize: currentPrompt.fontHierarchy.titleSize,
                    bodySize: currentPrompt.fontHierarchy.bodySize,
                  },
                  universalPrompt: currentPrompt.reusablePrompt,
                  slidePrompts: [],
                  usageCount: 0,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                });
                await useStore.getState().saveWorkbench();
                setSavedAsTemplate(true);
                setTimeout(() => setSavedAsTemplate(false), 2000);
              }}
              className="flex items-center gap-1 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-[10px] text-green-700 hover:bg-green-100 shadow-sm"
            >
              {savedAsTemplate ? <Check size={10} /> : <Save size={10} />}
              {savedAsTemplate ? '已保存' : '保存为模板'}
            </button>
          </div>
        </div>
      ) : currentAnalysisStatus === 'queued' ? (
        <div className="flex flex-1 flex-col items-center justify-center p-5 gap-3">
          <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-500">
              <Loader2 size={18} className="animate-spin" />
            </div>
            <p className="text-sm font-semibold text-[#0f172a]">第 {selectedSlide.slideIndex} 页正在排队</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              系统最多同时拆解 3 页，前面的页面完成后会自动继续这一页。
            </p>
          </div>
        </div>
      ) : loading || currentAnalysisStatus === 'analyzing' ? (
        <AnalyzingProgress key={selectedSlide.slideIndex} slideIndex={selectedSlide.slideIndex} />
      ) : (error || currentAnalysisError) ? (
        <div className="flex flex-1 flex-col items-center justify-center p-5 gap-3">
          <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-amber-600">
              <RefreshCw size={18} />
            </div>
            <p className="text-sm font-semibold text-[#0f172a]">拆解暂时失败</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-700">{error || currentAnalysisError}</p>
            <button onClick={analyzeSlide} className="mt-4 inline-flex items-center gap-1 rounded-xl bg-[#1e40af] px-4 py-2 text-xs font-medium text-white hover:bg-[#1e40af]/90">重试拆解</button>
          </div>
        </div>
      ) : null}
    </PanelWrapper>
  );
}

// ====== Sub-components ======

const ANALYSIS_STAGES = [
  { label: '识别页面类型', desc: '判断封面、内容页、数据页等版式类型', duration: 10 },
  { label: '读取文字内容', desc: '逐字识别标题、正文、标签等所有中文文字', duration: 20 },
  { label: '拆解视觉元素', desc: '拆出 8-25 个元素：图片、图标、色块、装饰和卡片', duration: 25 },
  { label: '分析配色与构图', desc: '提取主色、辅色、渐变、背景和禁止项规则', duration: 15 },
  { label: '生成复用 Prompt', desc: '输出 400-800 字完整复刻描述和逐元素重建方案', duration: 20 },
];
const TOTAL_ESTIMATED_SEC = ANALYSIS_STAGES.reduce((s, st) => s + st.duration, 0);

function AnalyzingProgress({ slideIndex }: { slideIndex: number }) {
  const status = useStore((s) => s.referenceSlideAnalysisStatus[slideIndex]);
  const [elapsed, setElapsed] = useState(0);
  const isDone = status === 'done' || status === 'error';

  useEffect(() => {
    if (isDone) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [isDone]);

  // Determine current stage based on elapsed time
  let accumulated = 0;
  let activeStage = 0;
  for (let i = 0; i < ANALYSIS_STAGES.length; i++) {
    accumulated += ANALYSIS_STAGES[i].duration;
    if (elapsed < accumulated) { activeStage = i; break; }
    if (i === ANALYSIS_STAGES.length - 1) activeStage = i;
  }
  const progress = isDone ? 100 : Math.min(95, Math.round((elapsed / TOTAL_ESTIMATED_SEC) * 100));

  return (
    <div className="flex flex-1 flex-col p-4">
      <div className="rounded-2xl border border-[#bfdbfe] bg-gradient-to-br from-[#eff6ff] to-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#dbeafe] text-[#1d4ed8]">
            <Loader2 size={18} className="animate-spin" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#0f172a]">正在拆解第 {slideIndex} 页</p>
            <p className="text-[11px] text-[#64748b]">
              预计 {TOTAL_ESTIMATED_SEC} 秒 · 已用 {elapsed} 秒
            </p>
          </div>
          <span className="text-xs font-bold text-[#2563eb]">{progress}%</span>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-1.5 w-full rounded-full bg-[#dbeafe] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#2563eb] transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <div className="mt-4 space-y-1.5">
        {ANALYSIS_STAGES.map((stage, index) => {
          const isDone = index < activeStage;
          const isActive = index === activeStage;
          return (
            <div
              key={stage.label}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
                isActive ? 'border-[#bfdbfe] bg-[#eff6ff]' : isDone ? 'border-green-200 bg-green-50' : 'border-[#e2e8f0] bg-white'
              }`}
            >
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${
                isDone ? 'bg-green-100 text-green-600' : isActive ? 'bg-[#dbeafe] text-[#2563eb]' : 'bg-gray-100 text-gray-400'
              }`}>
                {isDone ? <Check size={12} /> : isActive ? <Loader2 size={12} className="animate-spin" /> : index + 1}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className={`text-[11px] font-medium ${isDone ? 'text-green-700' : isActive ? 'text-[#0f172a]' : 'text-gray-400'}`}>
                  {stage.label}
                </p>
                <p className={`text-[9px] truncate ${isActive ? 'text-[#64748b]' : 'text-gray-300'}`}>{stage.desc}</p>
              </div>
              <span className="text-[9px] text-gray-300 flex-shrink-0">~{stage.duration}s</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BackgroundCard({ background }: { background: ElementBackground }) {
  return (
    <div className="rounded-2xl border border-[#e2e8f0] bg-white p-3 text-xs shadow-sm">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] text-gray-400">背景</span>
        <span className="text-[10px] px-1 py-0.5 rounded bg-white border text-gray-600">
          {background.type}
        </span>
      </div>
      <div className="flex gap-1 mb-1">
        {background.colors.map((c) => (
          <div key={c} className="w-4 h-4 rounded border" style={{ backgroundColor: c }} title={c} />
        ))}
      </div>
      <p className="text-[10px] text-gray-500">{background.description}</p>
    </div>
  );
}

const ELEMENT_TYPE_LABELS: Record<string, string> = {
  title: '标题', subtitle: '副标题', body: '正文', bullet_list: '列表',
  image: '图片', icon: '图标', shape: '形状', chart: '图表',
  table: '表格', decoration: '装饰', page_number: '页码', line: '分割线',
  logo: 'Logo', card: '卡片', progress_bar: '进度条',
};

function ElementCard({ element, index }: { element: VisualElement; index: number }) {
  const label = ELEMENT_TYPE_LABELS[element.type] || element.type;
  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-[#fcfdff] p-2.5 text-xs">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[10px] text-gray-400">#{index + 1}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e40af]/10 text-[#1e40af] font-medium">
          {label}
        </span>
        {/* Position mini-bar */}
        <span className="text-[9px] text-gray-400 ml-auto">
          ({element.rect.x}%, {element.rect.y}%) {element.rect.w}%x{element.rect.h}%
        </span>
      </div>

      {/* Content */}
      {element.content.text && (
        <p className="text-[11px] text-gray-700 mb-1 line-clamp-2">{element.content.text}</p>
      )}
      {element.content.imageDescription && (
        <p className="text-[10px] text-gray-500 italic mb-1">{element.content.imageDescription}</p>
      )}

      {/* Style chips */}
      {element.style && (
        <div className="flex flex-wrap gap-1 mb-1">
          {element.style.fontSize && (
            <span className="text-[9px] bg-gray-100 text-gray-600 px-1 rounded">{element.style.fontSize}pt</span>
          )}
          {element.style.fontWeight && (
            <span className="text-[9px] bg-gray-100 text-gray-600 px-1 rounded">{element.style.fontWeight}</span>
          )}
          {element.style.color && (
            <span className="flex items-center gap-0.5 text-[9px] bg-gray-100 text-gray-600 px-1 rounded">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: element.style.color }} />
              {element.style.color}
            </span>
          )}
          {element.style.textAlign && (
            <span className="text-[9px] bg-gray-100 text-gray-600 px-1 rounded">{element.style.textAlign}</span>
          )}
          {element.style.borderRadius !== undefined && (
            <span className="text-[9px] bg-gray-100 text-gray-600 px-1 rounded">r={element.style.borderRadius}</span>
          )}
          {element.style.opacity !== undefined && (
            <span className="text-[9px] bg-gray-100 text-gray-600 px-1 rounded">{Math.round(element.style.opacity * 100)}%</span>
          )}
        </div>
      )}

      {/* Purpose */}
      <p className="text-[10px] text-gray-400">{element.purpose}</p>
    </div>
  );
}

function CollapsibleSection({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="text-xs">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-0.5 text-gray-400 hover:text-gray-600 w-full text-left"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="text-[10px]">{title}</span>
      </button>
      {open && <div className="mt-1 ml-4">{children}</div>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs">
      <span className="text-gray-400">{label}</span>
      <p className="text-[11px] text-gray-700 mt-0.5">{value}</p>
    </div>
  );
}

function PanelWrapper({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full border-r border-[var(--color-border)]">
      <div className="px-3 py-2 border-b border-[var(--color-border)]">
        <h3 className="text-xs font-semibold text-[var(--color-text-primary)]">{title}</h3>
      </div>
      {children}
    </div>
  );
}
