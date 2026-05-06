'use client';

import { useState, useCallback, useEffect } from 'react';
import { Upload, Loader2, FileStack, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { ElementType, ReferenceSlide } from '@/types';
import { extractMasterTemplate } from '@/lib/master-template';

const ELEMENT_TYPES = new Set<string>([
  'title', 'subtitle', 'body', 'bullet_list', 'image', 'icon', 'shape', 'chart', 'table', 'decoration', 'page_number', 'line', 'logo', 'card', 'progress_bar',
]);

const ANALYZE_SLIDE_TIMEOUT_MS = 310_000;
const ANALYZE_CONCURRENCY = 3;

function normalizeElementType(type: unknown): ElementType {
  return ELEMENT_TYPES.has(String(type)) ? String(type) as ElementType : 'shape';
}

function isValidAnalyzedPrompt(prompt: { elements?: unknown[]; reusablePrompt?: string; referenceAnalysisRaw?: Record<string, unknown> }) {
  const source = (prompt.referenceAnalysisRaw?.source || {}) as Record<string, unknown>;
  if (source.fallbackFromVision) return false;
  return Array.isArray(prompt.elements) && prompt.elements.length >= 3 && Boolean(prompt.reusablePrompt?.trim());
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  onSettled?: (result: PromiseSettledResult<R>, item: T, index: number) => Promise<void> | void
) {
  const results: Array<PromiseSettledResult<R> | undefined> = new Array(items.length);
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      try {
        const settled: PromiseSettledResult<R> = { status: 'fulfilled', value: await worker(items[index], index) };
        results[index] = settled;
        await onSettled?.(settled, items[index], index);
      } catch (reason) {
        const settled: PromiseSettledResult<R> = { status: 'rejected', reason };
        results[index] = settled;
        await onSettled?.(settled, items[index], index);
      }
    }
  });
  await Promise.all(runners);
  return results as PromiseSettledResult<R>[];
}

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
    if (err.code === 'VISION_TIMEOUT') {
      return [
        err.code,
        err.message || '视觉分析请求超时。',
        '建议：减少一次上传的页数、稍后重试，或在 Vercel 环境变量中调大 VISION_REQUEST_TIMEOUT_MS。',
      ].join('｜');
    }
    return [err.code, err.message || fallback, err.detail ? `详情：${err.detail.slice(0, 160)}` : ''].filter(Boolean).join('｜');
  }
  if (typeof error === 'string') return error;
  if (typeof json.message === 'string') return json.message;
  return fallback;
}

export default function ReferenceSlidePanel() {
  const store = useStore();
  const {
    referenceSlides,
    selectedRefSlideIndex,
    setReferenceSlides,
    setSelectedRefSlide,
    upsertReferenceSlidePrompt,
    setReferenceSlideAnalysisStatus,
    resetReferenceSlideAnalysisState,
    referenceSlideAnalysisStatus,
    referenceSlideAnalysisErrors,
    saveWorkbench,
    setMasterTemplate,
  } = store;
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{ done: number; total: number } | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [healthWarning, setHealthWarning] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setFatalError(null);
    setHealthWarning(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const json = await readApiResponse(res);
      if (!res.ok) throw new Error(json.error || '上传失败');
      const fileId = json.data?.fileId || json.fileId;

      setAnalyzing(true);
      const extractRes = await fetch('/api/extract-slide-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      });
      const extractJson = await readApiResponse(extractRes);
      if (!extractRes.ok) throw new Error(extractJson.error || extractJson.message || '提取幻灯片失败');

      const slides: ReferenceSlide[] = (extractJson.data?.slides || extractJson.slides || []).map(
        (s: Record<string, unknown>) => ({
          id: `ref-${s.slideIndex}`,
          slideIndex: s.slideIndex as number,
          thumbnailBase64: (s.imageBase64 as string) || '',
          title: `第 ${s.slideIndex} 页`,
          extractedText: (s.textContent as string) || '',
          slideXML: (s.slideXML as string) || '',
          layoutType: (s.layout as string) || 'single',
        })
      );

      setReferenceSlides(slides);
      if (slides.length > 0) {
        setSelectedRefSlide(slides[0].slideIndex);
      }
      resetReferenceSlideAnalysisState();
      await saveWorkbench();

      // Pre-flight API health check
      try {
        const healthRes = await fetch('/api/health');
        const healthData = await readApiResponse(healthRes);
        if (!healthData.ok) {
          const failedApis = Object.entries(healthData.checks || {})
            .filter(([, v]) => !(v as { ok: boolean }).ok)
            .map(([k, v]) => `${k}: ${(v as { error?: string }).error || '不可用'}`)
            .join('；');
          setHealthWarning(`API 健康检查未通过（${failedApis}），分析会继续尝试；失败页面会在列表中标出。`);
        }
      } catch {
        // Health check failed — continue anyway
      }

      // Auto-analyze all slides with a sliding concurrency window
      const totalSlides = slides.length;
      setAnalysisProgress({ done: 0, total: totalSlides });
      slides.forEach((slide) => {
        setReferenceSlideAnalysisStatus(slide.slideIndex, 'queued');
      });

      // Sliding queue: at most ANALYZE_CONCURRENCY requests run at once;
      // whenever one finishes, the next slide starts automatically.
      let completedCount = 0;

      const allResults = await runWithConcurrency(slides, ANALYZE_CONCURRENCY, async (slide) => {
        setReferenceSlideAnalysisStatus(slide.slideIndex, 'analyzing');
        if (!slide.thumbnailBase64?.trim()) {
          return {
            slideIndex: slide.slideIndex,
            error: 'MISSING_IMAGE_BASE64｜该页缺少图像，无法分析。',
          };
        }
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), ANALYZE_SLIDE_TIMEOUT_MS);
        try {
          const analyzeRes = await fetch('/api/analyze-slide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              slideIndex: slide.slideIndex,
              imageBase64: slide.thumbnailBase64 || null,
              textContent: slide.extractedText || '',
              slideXML: slide.slideXML || '',
            }),
          });
          const analyzeJson = await readApiResponse(analyzeRes);
          if (!analyzeRes.ok) {
            return {
              slideIndex: slide.slideIndex,
              error: getApiErrorMessage(analyzeJson, '页面风格分析失败，请检查 AI 配置或稍后重试。'),
            };
          }
          const data = analyzeJson.data || analyzeJson;

            // Parse v1 or v2 format
            const isV1 = !!(data.styleAnalysis && data.pageIdentity);
            if (isV1) {
              const style = data.styleAnalysis || {};
              const palette = (style.colorPalette || []) as Array<Record<string, string>>;
              const allColors = palette.map((c) => c.hex || '').filter(Boolean);
              const typo = style.typography || {};
              const titleSizeRaw = ((typo.title as Record<string, unknown>)?.fontSizeEstimate as string | number | undefined) || 44;
              const bodySizeRaw = ((typo.body as Record<string, unknown>)?.fontSizeEstimate as string | number | undefined) || 18;
              const mappedElements = ((data.elements || []) as Array<Record<string, unknown>>).map((el) => {
                const bb = (el.boundingBox || { x: 0, y: 0, w: 1, h: 1 }) as Record<string, number>;
                const st = (el.style || {}) as Record<string, unknown>;
                const content = (el.content || {}) as Record<string, unknown>;
                return {
                  type: normalizeElementType(el.type),
                  rect: {
                    x: Math.round((bb.x || 0) * 100),
                    y: Math.round((bb.y || 0) * 100),
                    w: Math.round((bb.w || 0) * 100),
                    h: Math.round((bb.h || 0) * 100),
                  },
                  content: {
                    text: (content.text as string) || '',
                    imageDescription: (content.imageDescription as string) || '',
                  },
                  style: {
                    fontSize: st.fontSize ? parseInt(String(st.fontSize), 10) : undefined,
                    fontWeight: (st.fontWeight as string) || undefined,
                    color: (st.textColor as string) || (st.fill as string) || undefined,
                    textAlign: (st.alignment as 'left' | 'center' | 'right' | 'justify') || undefined,
                    borderRadius: st.borderRadius ? parseInt(String(st.borderRadius), 10) : undefined,
                    opacity: st.opacity as number | undefined,
                  },
                  purpose: (content.semanticMeaning as string) || (el.role as string) || (el.reproductionInstruction as string) || '',
                };
              });
              return {
                slideIndex: slide.slideIndex,
                pageType: (data.pageIdentity as Record<string, unknown>)?.detectedPageType as string || '内容页',
                visualDescription: (data.pageIdentity as Record<string, unknown>)?.coreMessage as string || '',
                layoutStructure: (data.layoutPattern as Record<string, unknown>)?.structureSummary as string || '',
                colorRules: {
                  primary: allColors[0] || '#1a56db',
                  secondary: allColors[1] || '#34a853',
                  accent: allColors[2] || '#fbbc04',
                  background: '#ffffff',
                  text: '#202124',
                },
                fontHierarchy: {
                  titleSize: typeof titleSizeRaw === 'number' ? titleSizeRaw : parseInt(titleSizeRaw, 10) || 44,
                  bodySize: typeof bodySizeRaw === 'number' ? bodySizeRaw : parseInt(bodySizeRaw, 10) || 18,
                  titleWeight: ((typo.title as Record<string, string>)?.fontWeight as string) || 'bold',
                },
                reusablePrompt: [
                  (data.prompts as Record<string, string>)?.slideVisualPrompt,
                  (data.prompts as Record<string, string>)?.elementRebuildPrompt,
                ].filter(Boolean).join('\n\n'),
                styleTags: (style.overallStyle as string[]) || (style.designKeywords as string[]) || [],
                background: {
                  type: 'solid' as const,
                  colors: allColors.slice(0, 3),
                  description: ((style.decorationSystem as Record<string, unknown>)?.backgroundLayers as unknown[] | undefined)?.join('；') || '',
                },
                elements: mappedElements,
                layoutPatternDescription: (data.layoutPattern as Record<string, string>)?.structureSummary || '',
                styleSummary: {
                  allColors,
                  fontSystem: JSON.stringify(typo),
                  spacing: (data.layoutPattern as Record<string, string>)?.structureSummary || '',
                  effects: (data.shapeLanguage as string[]) || [],
                },
                referenceAnalysisRaw: data,
              };
            }
            // v2 flat format
            const v2TitleSizeRaw = ((data.typography as Record<string, unknown>)?.title as Record<string, unknown> | undefined)?.fontSize as string | number | undefined;
            const v2BodySizeRaw = ((data.typography as Record<string, unknown>)?.body as Record<string, unknown> | undefined)?.fontSize as string | number | undefined;
            const v2ColorSystem = (data.colorSystem as Record<string, unknown>) || {};
            const getHex = (arr: unknown): string[] => {
              if (!Array.isArray(arr)) return [];
              return arr.map((c) => typeof c === 'string' ? c : ((c as Record<string, unknown>)?.hex as string) || '').filter(Boolean);
            };
            const v2Background = (data.background as Record<string, unknown>) || {};
            const v2Layout = (data.layout as Record<string, unknown>) || {};
            const v2Elements = ((data.visualElements || []) as Array<Record<string, unknown>>).map((el) => {
              const rect = (el.rect || {}) as Record<string, number>;
              const content = (el.content || {}) as Record<string, unknown>;
              const elementStyle = (el.elementStyle || {}) as Record<string, unknown>;
              return {
                type: normalizeElementType(el.type),
                rect: {
                  x: rect.x ?? 0,
                  y: rect.y ?? 0,
                  w: rect.w ?? 0,
                  h: rect.h ?? 0,
                },
                content: {
                  text: (content.text as string) || (el.description as string) || '',
                  imageDescription: (content.imageDescription as string) || '',
                },
                style: {
                  fontSize: elementStyle.fontSize ? Number(elementStyle.fontSize) : undefined,
                  fontWeight: (elementStyle.fontWeight as string) || undefined,
                  color: (elementStyle.color as string) || (elementStyle.fill as string) || undefined,
                  textAlign: (elementStyle.textAlign as 'left' | 'center' | 'right' | 'justify') || undefined,
                  borderRadius: elementStyle.borderRadius ? Number(elementStyle.borderRadius) : undefined,
                  opacity: elementStyle.opacity as number | undefined,
                },
                purpose: (el.purpose as string) || (el.rebuildInstruction as string) || (el.positionHint as string) || (el.style as string) || '',
              };
            });
            return {
              slideIndex: slide.slideIndex,
              pageType: (data.slideType as string) || '内容页',
              visualDescription: (data.slideVisualPrompt as string) || '',
              layoutStructure: (v2Layout.structure as string) || '',
              colorRules: {
                primary: getHex(v2ColorSystem.primary)[0] || '#1a56db',
                secondary: getHex(v2ColorSystem.secondary)[0] || '#34a853',
                accent: getHex(v2ColorSystem.accent)[0] || '#fbbc04',
                background: getHex(v2ColorSystem.background)[0] || '#ffffff',
                text: '#0f172a',
              },
              fontHierarchy: {
                titleSize: typeof v2TitleSizeRaw === 'number' ? v2TitleSizeRaw : parseInt(v2TitleSizeRaw || '44', 10) || 44,
                bodySize: typeof v2BodySizeRaw === 'number' ? v2BodySizeRaw : parseInt(v2BodySizeRaw || '18', 10) || 18,
                titleWeight: 'bold',
              },
              reusablePrompt: (data.slideVisualPrompt as string) || '',
              styleTags: (data.styleTags as string[]) || [],
              background: {
                type: (v2Background.type as 'solid' | 'gradient' | 'image' | 'pattern') || 'solid',
                colors: getHex(v2ColorSystem.background).slice(0, 3),
                description: [v2Background.style, v2Background.lighting, v2Background.texture].filter(Boolean).join(' '),
              },
              elements: v2Elements,
              layoutPatternDescription: (v2Layout.structure as string) || '',
              styleSummary: {
                allColors: [
                  ...getHex(v2ColorSystem.primary),
                  ...getHex(v2ColorSystem.secondary),
                  ...getHex(v2ColorSystem.accent),
                  ...getHex(v2ColorSystem.background),
                ],
                fontSystem: (data.fontSystem as string) || '',
                spacing: (data.spacing as string) || '',
                effects: (data.effects as string[]) || [],
              },
              referenceAnalysisRaw: data,
            };
          } catch (err) {
            const isTimeout = err instanceof Error && err.name === 'AbortError';
            const detail = err instanceof Error ? err.message : String(err);
            return {
              slideIndex: slide.slideIndex,
              error: isTimeout
                ? `页面分析超时（${ANALYZE_SLIDE_TIMEOUT_MS / 1000}秒），已跳过并继续后续页面。`
                : `分析失败：${detail.slice(0, 120)}`,
            };
          } finally {
            window.clearTimeout(timeoutId);
            completedCount += 1;
            setAnalysisProgress({ done: completedCount, total: totalSlides });
          }
        }, async (settledResult, slide) => {
        if (settledResult.status === 'rejected') {
          setReferenceSlideAnalysisStatus(
            slide.slideIndex,
            'error',
            settledResult.reason instanceof Error && settledResult.reason.name === 'AbortError'
              ? '页面分析超时，已跳过。'
              : '页面风格分析失败，已跳过。'
          );
          return;
        }

        const result = settledResult.value;
        if ('error' in result) {
          setReferenceSlideAnalysisStatus(result.slideIndex, 'error', result.error);
          return;
        }
        if (!isValidAnalyzedPrompt(result)) {
          setReferenceSlideAnalysisStatus(
            result.slideIndex,
            'error',
            '分析结果不完整：未获得有效视觉元素或复用 Prompt，已拒绝写入模板。'
          );
          return;
        }

        upsertReferenceSlidePrompt(result);
        setReferenceSlideAnalysisStatus(result.slideIndex, 'done');
        await saveWorkbench();
      });
      await saveWorkbench();

      // Extract master template from valid vision-analyzed slides only
      const latestPrompts = useStore.getState().referenceSlidePrompts;
      const validPrompts = latestPrompts.filter(isValidAnalyzedPrompt);
      if (validPrompts.length >= 2) {
        const master = extractMasterTemplate(validPrompts);
        if (master) {
          setMasterTemplate(master);
          console.log('[MasterTemplate] Extracted from', master.sourceSlideCount, 'slides');
          await saveWorkbench();
        }
      }

      setAnalysisProgress(null);
    } catch (err) {
      setFatalError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  }, [resetReferenceSlideAnalysisState, saveWorkbench, setReferenceSlides, setReferenceSlideAnalysisStatus, setSelectedRefSlide, upsertReferenceSlidePrompt, setMasterTemplate]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  // Close zoom on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomedImage(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const isBusy = uploading || analyzing;
  const showBusyPlaceholder = isBusy && referenceSlides.length === 0;

  if (fatalError) {
    return (
      <>
        <PanelWrapper title="参考 PPT">
          <div className="p-4 text-center">
            <p className="text-xs text-red-600 mb-2">{fatalError}</p>
            <button
              onClick={() => setFatalError(null)}
              className="text-xs text-[#1e40af] underline"
            >
              重试
            </button>
          </div>
        </PanelWrapper>
        <ZoomModal image={zoomedImage} onClose={() => setZoomedImage(null)} />
      </>
    );
  }

  return (
    <>
      <PanelWrapper title={`参考 PPT${referenceSlides.length > 0 ? ` (${referenceSlides.length}页)` : ''}`}>
      {healthWarning && (
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
          {healthWarning}
        </div>
      )}
      {showBusyPlaceholder ? (
        <div className="flex h-full flex-col p-4">
          <div className="rounded-2xl border border-[#bfdbfe] bg-gradient-to-br from-[#eff6ff] to-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#dbeafe] text-[#1d4ed8]">
                <Loader2 size={18} className="animate-spin" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0f172a]">
                  {uploading ? '正在上传参考文件' : '正在解析并分析参考页'}
                </p>
                <p className="text-[11px] text-[#64748b]">
                  {uploading ? '文件上传完成后会自动拆分每一页并写入缓存。' : '分析结果会逐页进入左侧列表，完成后点击即可立即查看。'}
                </p>
              </div>
            </div>
            {analysisProgress && (
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-[11px] text-[#475569]">
                  <span>参考页分析进度</span>
                  <span>{analysisProgress.done}/{analysisProgress.total}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#dbeafe]">
                  <div
                    className="h-full rounded-full bg-[#2563eb] transition-all"
                    style={{ width: `${analysisProgress.total > 0 ? (analysisProgress.done / analysisProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 grid gap-2">
            {referenceSlides.slice(0, 4).map((slide) => (
              <div key={slide.id} className="flex items-center gap-3 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2">
                <div className="h-12 w-16 overflow-hidden rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                  {slide.thumbnailBase64 ? (
                    <img src={slide.thumbnailBase64} alt={`幻灯片 ${slide.slideIndex}`} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[#0f172a]">第 {slide.slideIndex} 页</p>
                  <p className="text-[10px] text-[#64748b]">
                    {referenceSlideAnalysisStatus[slide.slideIndex] === 'done'
                      ? '已写入缓存，可直接查看'
                      : referenceSlideAnalysisStatus[slide.slideIndex] === 'error'
                        ? '分析失败，可稍后重试'
                        : '正在处理中'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : referenceSlides.length > 0 ? (
        <div className="flex h-full min-h-0 flex-col">
          <div className="border-b border-[#e2e8f0] bg-[#f8fafc] px-3 py-3">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-[#dbeafe] text-[#1d4ed8]">
                <FileStack size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#0f172a]">参考页库</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-[#64748b]">
                  {analyzing ? '正在后台逐页分析，列表可正常滚动和查看。' : '点击任意已分析页，右侧立即展示拆解结果；分析中的页会持续更新状态。'}
                </p>
              </div>
            </div>
            {analysisProgress && (
              <div className="mt-3 rounded-xl border border-[#bfdbfe] bg-white px-3 py-2">
                <div className="mb-1 flex items-center justify-between text-[10px] text-[#475569]">
                  <span>后台分析进度</span>
                  <span>{analysisProgress.done}/{analysisProgress.total}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#dbeafe]">
                  <div
                    className="h-full rounded-full bg-[#2563eb] transition-all"
                    style={{ width: `${analysisProgress.total > 0 ? (analysisProgress.done / analysisProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#93c5fd] bg-white px-3 py-2 text-[11px] font-medium text-[#1d4ed8] transition-colors hover:bg-[#eff6ff]">
              <Upload size={13} />
              更换参考 PPT
              <input type="file" accept=".pdf,.ppt,.pptx" onChange={handleFileInput} className="hidden" />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
          {referenceSlides.map((slide) => (
            (() => {
              const status = referenceSlideAnalysisStatus[slide.slideIndex];
              const failureReason = referenceSlideAnalysisErrors[slide.slideIndex];
              return (
            <button
              key={slide.id}
              onClick={() => setSelectedRefSlide(slide.slideIndex)}
              className={`group w-full text-left rounded-2xl border p-2.5 transition-all ${
                selectedRefSlideIndex === slide.slideIndex
                  ? 'border-[#2563eb] bg-[#eff6ff] shadow-[0_8px_22px_rgba(37,99,235,0.16)] ring-1 ring-[#bfdbfe]'
                  : 'border-[#e2e8f0] bg-white hover:-translate-y-0.5 hover:border-[#bfdbfe] hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]'
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[#0f172a]">第 {slide.slideIndex} 页</p>
                  <p className="text-[10px] text-[#64748b]">{slide.layoutType || 'single'} 布局</p>
                </div>
                <StatusPill status={status} />
              </div>
              {status === 'error' && failureReason ? (
                <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] leading-relaxed text-amber-800">
                  {failureReason}
                </div>
              ) : null}
              {slide.thumbnailBase64 ? (
                <div className="relative overflow-hidden rounded-xl border border-[#e2e8f0] bg-[#f8fafc]">
                  <img
                    src={slide.thumbnailBase64}
                    alt={`幻灯片 ${slide.slideIndex}`}
                    className="aspect-[4/3] w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                    onDoubleClick={() => setZoomedImage(slide.thumbnailBase64)}
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-2 py-2 text-[10px] text-white">
                    双击可放大查看
                  </div>
                </div>
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-xs text-[#94a3b8]">
                  无预览
                </div>
              )}
              <div className="mt-2 flex items-center justify-between text-[10px] text-[#64748b]">
                <span>{selectedRefSlideIndex === slide.slideIndex ? '当前查看' : '点击查看拆解'}</span>
                <span>{slide.extractedText ? '含文本' : '纯视觉页'}</span>
              </div>
            </button>
              );
            })()
          ))}
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex flex-1 flex-col items-center justify-center p-4 text-center"
        >
          <div className="w-full rounded-[24px] border border-dashed border-[#93c5fd] bg-gradient-to-br from-[#eff6ff] via-white to-[#f8fafc] p-6 shadow-sm transition-colors hover:border-[#2563eb]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dbeafe] text-[#1d4ed8]">
              <Sparkles size={24} />
            </div>
            <p className="mt-4 text-sm font-semibold text-[#0f172a]">上传参考 PPT / PDF</p>
            <p className="mt-1 text-xs leading-relaxed text-[#64748b]">
              系统会自动拆页、分析视觉风格，并把每页结果逐页缓存到工作台中。
            </p>
            <label className="mt-4 inline-flex items-center gap-1 rounded-xl bg-[#1e40af] px-4 py-2 text-xs font-medium text-white cursor-pointer hover:bg-[#1e40af]/90">
              <Upload size={12} />
              选择文件
              <input type="file" accept=".pdf,.ppt,.pptx" onChange={handleFileInput} className="hidden" />
            </label>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5 text-[10px] text-[#64748b]">
              <span className="rounded-full border border-[#dbeafe] bg-white px-2 py-1">.ppt / .pptx</span>
              <span className="rounded-full border border-[#dbeafe] bg-white px-2 py-1">.pdf 参考页</span>
            </div>
          </div>
        </div>
      )}
    </PanelWrapper>
      <ZoomModal image={zoomedImage} onClose={() => setZoomedImage(null)} />
    </>
  );
}

function PanelWrapper({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <h3 className="text-xs font-semibold tracking-[0.02em] text-[var(--color-text-primary)]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function StatusPill({ status }: { status?: 'idle' | 'queued' | 'analyzing' | 'done' | 'error' }) {
  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">
        <CheckCircle2 size={11} />
        已分析
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700">
        <AlertTriangle size={11} />
        失败
      </span>
    );
  }

  if (status === 'analyzing') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700">
        <Loader2 size={11} className="animate-spin" />
        分析中
      </span>
    );
  }

  if (status === 'queued') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600">
        排队中
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-500">
      待处理
    </span>
  );
}

function ZoomModal({ image, onClose }: { image: string | null; onClose: () => void }) {
  if (!image) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white text-sm"
      >
        Esc 关闭
      </button>
      <img
        src={image}
        alt="幻灯片放大预览"
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
