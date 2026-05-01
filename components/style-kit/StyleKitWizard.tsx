'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { AnalysisJob, StyleKit, StyleDNA, SlideImage } from '@/types';
import { StyleKitReport } from '@/components/style-kit';
import { Sparkles, Loader2, AlertCircle, FileText, Palette, Type, Check, ChevronRight } from 'lucide-react';
import { analysisJobService } from '@/lib/db';

type WizardStep = 'extracting' | 'extracting-dna' | 'distilling' | 'complete' | 'error';
const PIPELINE_VERSION = 'stylekit-v1';

interface StyleKitWizardProps {
  fileId: string;
  fileName?: string;
  onComplete?: (styleKit: StyleKit) => void;
  onCancel?: () => void;
}

interface ExtractResult {
  styleDNAResults: Array<{
    id: string;
    slideIndex: number;
    palette: StyleDNA['palette'];
    typography: StyleDNA['typography'];
    spacing: StyleDNA['spacing'];
    effects: StyleDNA['effects'];
    mood: StyleDNA['mood'];
    moodDescription: string;
    layoutType: string;
    visualPrompt: string;
    styleTags: string[];
  }>;
}

interface DistillResult {
  success: boolean;
  styleKit: StyleKit;
  analysisSummary: {
    totalSlides: number;
    mood: string;
    styleTags: string[];
    layoutPatternsFound: number;
  };
}

interface ExtractedSlide extends SlideImage {
  slideXML?: string;
  textContent?: string;
  colorScheme?: Record<string, string>;
  fontInfo?: { titleFont?: string; bodyFont?: string };
}

export default function StyleKitWizard({
  fileId,
  fileName,
  onComplete,
  onCancel,
}: StyleKitWizardProps) {
  const { addStyleKit, createStyleKitJob, updateJobProgress, completeJob, failJob } = useStore();
  const [step, setStep] = useState<WizardStep>('extracting');
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [error, setError] = useState<string | null>(null);
  const [styleKit, setStyleKit] = useState<StyleKit | null>(null);
  const [extractMeta, setExtractMeta] = useState<{ hadFailures?: boolean; wasSampled?: boolean; processedSlides?: number }>({});
  const [slideImages, setSlideImages] = useState<ExtractedSlide[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);

  useEffect(() => {
    void initializeAnalysis();
  }, [fileId]);

  async function initializeAnalysis() {
    const existingJob = await analysisJobService.getRecoverableByFileId(fileId, PIPELINE_VERSION);

    if (existingJob) {
      setJobId(existingJob.id);

      if (existingJob.result?.slideImages) {
        setSlideImages(existingJob.result.slideImages);
      }

      if (existingJob.status === 'completed' && existingJob.result?.styleKit) {
        addStyleKit(existingJob.result.styleKit);
        setStyleKit(existingJob.result.styleKit);
        setStep('complete');
        setProgress({
          current: existingJob.progress.totalSlides + 4,
          total: existingJob.progress.totalSlides + 4,
          message: '已恢复已完成的分析结果',
        });
        onComplete?.(existingJob.result.styleKit);
        return;
      }

      if (existingJob.status === 'processing' || existingJob.status === 'pending') {
        await runAnalysis(existingJob.id, existingJob.result?.slideImages, existingJob.result?.styleDNAResults);
        return;
      }
    }

    const newJob = await analysisJobService.create({
      fileId,
      pipelineVersion: PIPELINE_VERSION,
      status: 'pending',
      progress: {
        currentStep: 'initialized',
        processedSlides: 0,
        totalSlides: 0,
      },
    });
    createStyleKitJob(newJob);
    setJobId(newJob.id);
    await runAnalysis(newJob.id);
  }

  async function persistJobSnapshot(
    currentJobId: string,
    updates: {
      status?: 'pending' | 'processing' | 'completed' | 'failed';
      progress?: {
        currentStep?: string;
        processedSlides?: number;
        totalSlides?: number;
        estimatedTimeRemaining?: number;
      };
      result?: AnalysisJob['result'];
      error?: { code: string; message: string; recoverable: boolean };
    }
  ) {
    await analysisJobService.update(currentJobId, updates);
    if (updates.progress) {
      updateJobProgress(currentJobId, updates.progress);
    }
    if (updates.status === 'completed' && updates.result) {
      completeJob(currentJobId, updates.result);
    }
    if (updates.status === 'failed' && updates.error) {
      failJob(currentJobId, updates.error);
    }
  }

  async function runAnalysis(
    currentJobId: string,
    existingSlides?: ExtractedSlide[],
    existingStyleDNAResults?: ExtractResult['styleDNAResults']
  ) {
    try {
      // Step 1: Extract slide images
      setStep('extracting');
      setProgress({ current: 0, total: 10, message: '正在提取幻灯片...' });

      let allSlides: ExtractedSlide[] | undefined = existingSlides;
      if (!allSlides || allSlides.length === 0) {
        const extractResponse = await fetch('/api/extract-slide-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId }),
        });

        if (!extractResponse.ok) {
          throw new Error('提取幻灯片失败');
        }

        const { slides } = await extractResponse.json();
        allSlides = (slides as ExtractedSlide[]).slice(0, 10);
        await persistJobSnapshot(currentJobId, {
          status: 'processing',
          progress: {
            currentStep: 'extracting',
            processedSlides: 0,
            totalSlides: allSlides.length,
          },
          result: {
            slideImages: allSlides,
          },
        });
      }

      if (!allSlides) {
        throw new Error('未能恢复或提取幻灯片');
      }

      setSlideImages(allSlides);

      setProgress({ current: 2, total: allSlides.length + 2, message: `已提取 ${allSlides.length} 页幻灯片` });

      // Step 2: Extract StyleDNA from each slide
      setStep('extracting-dna');
      const styleDNAResults: ExtractResult['styleDNAResults'] = existingStyleDNAResults ? [...existingStyleDNAResults] : [];
      const processedSlideIndexes = new Set(styleDNAResults.map((item) => item.slideIndex));

      for (let i = 0; i < allSlides.length; i++) {
        const slide = allSlides[i];
        if (processedSlideIndexes.has(slide.slideIndex)) {
          continue;
        }
        setProgress({
          current: 3 + i,
          total: allSlides.length + 2,
          message: `正在分析第 ${slide.slideIndex} 页... (${i + 1}/${allSlides.length})`,
        });

        const dnaResponse = await fetch('/api/style-kit/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slides: [{
              slideIndex: slide.slideIndex,
              imageBase64: slide.imageBase64,
              slideXML: slide.slideXML,
              textContent: slide.textContent,
              colorScheme: slide.colorScheme,
              fontInfo: slide.fontInfo,
            }],
            sourceFileId: fileId,
            sourceFileName: fileName,
          }),
        });

        if (dnaResponse.ok) {
          const data: any = await dnaResponse.json();
          // 保存 extract 元信息
          if (data.hadFailures || data.wasSampled || data.processedSlides) {
            setExtractMeta({ hadFailures: data.hadFailures, wasSampled: data.wasSampled, processedSlides: data.processedSlides });
          }
          if (data.styleDNAResults && data.styleDNAResults.length > 0) {
            styleDNAResults.push(data.styleDNAResults[0]);
            await persistJobSnapshot(currentJobId, {
              status: 'processing',
              progress: {
                currentStep: 'extracting-dna',
                processedSlides: styleDNAResults.length,
                totalSlides: allSlides.length,
              },
              result: {
                slideImages: allSlides,
                styleDNAResults,
              },
            });
          }
        }
      }

      if (styleDNAResults.length === 0) {
        throw new Error('StyleDNA 提取失败');
      }

      setProgress({
        current: allSlides.length + 3,
        total: allSlides.length + 4,
        message: '正在提炼风格包...',
      });

      // Step 3: Distill StyleKit
      setStep('distilling');

      const distillResponse = await fetch('/api/style-kit/distill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          styleDNAResults,
          sourceFileId: fileId,
          sourceFileName: fileName,
        }),
      });

      if (!distillResponse.ok) {
        throw new Error('StyleKit 提炼失败');
      }

      const distillData: DistillResult = await distillResponse.json();

      // Step 4: Save to store (will persist to IndexedDB)
      const newStyleKit = distillData.styleKit;
      addStyleKit(newStyleKit);
      await persistJobSnapshot(currentJobId, {
        status: 'completed',
        progress: {
          currentStep: 'completed',
          processedSlides: allSlides.length,
          totalSlides: allSlides.length,
        },
        result: {
          slideImages: allSlides,
          styleDNAResults,
          styleKit: newStyleKit,
          layoutPatterns: newStyleKit.layoutPatterns,
        },
      });

      setStyleKit(newStyleKit);
      setStep('complete');
      setProgress({
        current: allSlides.length + 4,
        total: allSlides.length + 4,
        message: '完成！',
      });

      onComplete?.(newStyleKit);
    } catch (err) {
      console.error('StyleKit analysis failed:', err);
      const message = err instanceof Error ? err.message : '分析失败';
      if (currentJobId) {
        await persistJobSnapshot(currentJobId, {
          status: 'failed',
          error: {
            code: 'STYLEKIT_ANALYSIS_FAILED',
            message,
            recoverable: true,
          },
        });
      }
      setError(message);
      setStep('error');
    }
  }

  function handleRetry() {
    setError(null);
    setStyleKit(null);
    if (jobId) {
      void runAnalysis(jobId);
    } else {
      void initializeAnalysis();
    }
  }

  // Render based on step
  if (step === 'complete' && styleKit) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <StyleKitReport
          styleKit={styleKit}
          totalSlides={slideImages.length}
          onConfirm={() => onComplete?.(styleKit)}
          onCancel={onCancel}
          onRetry={handleRetry}
          hadFailures={extractMeta.hadFailures}
          wasSampled={extractMeta.wasSampled}
          processedSlides={extractMeta.processedSlides}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Sparkles className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">AI 正在提取参考 PPT 的视觉风格 DNA</h2>
              <p className="text-indigo-100 text-sm">从 {fileName || fileId} 中提取设计语言</p>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="p-6">
          <div className="space-y-4">
            <ProgressStep
              icon={<FileText size={18} />}
              title="读取页面布局"
              description="正在分析页面结构与排版"
              active={step === 'extracting'}
              done={step !== 'extracting' && progress.current > 0}
            />
            <ProgressArrow />
            <ProgressStep
              icon={<Palette size={18} />}
              title="提取配色方案"
              description="正在识别主色与辅助色"
              active={step === 'extracting-dna'}
              done={step === 'distilling' || step === 'complete'}
            />
            <ProgressArrow />
            <ProgressStep
              icon={<Type size={18} />}
              title="识别字体层级"
              description="正在分析字体与层级关系"
              active={false}
              done={step === 'distilling' || step === 'complete'}
            />
            <ProgressArrow />
            <ProgressStep
              icon={<Sparkles size={18} />}
              title="总结风格规则"
              description="正在整理视觉风格关键词"
              active={step === 'distilling'}
              done={step === 'complete'}
            />
          </div>

          {/* Progress bar */}
          {step !== 'complete' && step !== 'error' && (
            <div className="mt-6">
              <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                <div
                  className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 10}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 text-center">{progress.message}</p>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-8">
              <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">分析失败</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={onCancel}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  重试
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProgressStep({ icon, title, description, active, done }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className={`flex items-center gap-4 p-3 rounded-xl transition-colors ${active ? 'bg-indigo-50 border border-indigo-100' : done ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-gray-100'}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-green-500 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
        {done ? <Check size={18} /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${done ? 'text-green-800' : active ? 'text-indigo-900' : 'text-gray-600'}`}>{title}</p>
        <p className="text-xs text-gray-500">{active ? description : ''}</p>
      </div>
      {active && <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
    </div>
  );
}

function ProgressArrow() {
  return <div className="flex justify-center"><ChevronRight size={16} className="text-gray-300 rotate-90" /></div>;
}
