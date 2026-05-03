'use client';

import { useEffect, useState, lazy, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { projectService } from '@/lib/db';
import { isMockMode } from '@/lib/api-client';
import EnhancedRequirementsForm from '@/components/EnhancedRequirementsForm';
import StyleKitWizard from '@/components/style-kit/StyleKitWizard';
import { StyleKit } from '@/types';
import { styleKitToStyleConfig } from '@/lib/style-bridge';
import { useStyleKitInit } from '@/hooks/useStyleKitInit';
import { Check, Upload, FileText, Sparkles } from 'lucide-react';
import Header from '@/components/shell/Header';

const EditStep = lazy(() => import('@/components/EditStep'));
const GenerateStep = lazy(() => import('@/components/GenerateStep'));

// ====== Step 常量 ======
const STEPS = [
  { num: 1, label: '上传参考 PPT' },
  { num: 2, label: '分析风格' },
  { num: 3, label: '输入需求' },
  { num: 4, label: '编辑内容' },
  { num: 5, label: '导出' },
];

// ====== 状态文案 ======
function getStepStatus(step: number, currentStep: number, store: any): { status: 'done' | 'current' | 'pending' | 'disabled'; statusText: string } {
  const { currentProject } = store;
  const hasUploaded = !!currentProject?.templateFileId;
  const hasStyle = !!store.currentStyleKit || !!currentProject?.styleKitId;
  const hasSlides = !!(currentProject?.pptJson?.slides && currentProject.pptJson.slides.length > 0);
  const slideIndex = store.selectedSlideIndex ?? 1;

  // 前置条件
  const canAccess: Record<number, boolean> = {
    1: true,
    2: hasUploaded,
    3: hasUploaded && hasStyle,
    4: hasSlides,
    5: hasSlides,
  };

  const isDone: Record<number, boolean> = {
    1: hasUploaded,
    2: hasStyle,
    3: hasSlides,
    4: hasSlides,
    5: false,
  };

  const statusTexts: Record<number, Record<string, string>> = {
    1: { pending: '等待上传参考 PPT', current: '正在上传文件', done: '已上传 1 个文件' },
    2: { pending: '待分析风格', current: '正在提取视觉风格', done: '已识别 12 种元素' },
    3: { pending: '待输入需求', current: '正在填写需求', done: '已生成内容框架' },
    4: { pending: '待编辑内容', current: `正在编辑第 ${slideIndex} 页`, done: '内容已编辑' },
    5: { pending: '待导出 PPT', current: '准备导出 PPT', done: '已生成导出文件' },
  };

  if (step === currentStep) {
    return { status: 'current', statusText: statusTexts[step].current };
  }
  if (isDone[step]) {
    return { status: 'done', statusText: statusTexts[step].done };
  }
  if (canAccess[step]) {
    return { status: 'pending', statusText: statusTexts[step].pending };
  }
  return { status: 'disabled', statusText: statusTexts[step].pending };
}

export default function CreatePage() {
  const router = useRouter();
  const store = useStore();
  const { currentProject, currentStep, setCurrentProject, setCurrentStep } = store;
  const { isInitialized: styleKitReady } = useStyleKitInit();

  useEffect(() => {
    const initProject = async () => {
      if (!currentProject) {
        // 尝试恢复最近的项目（支持跨刷新持久化）
        const projects = await projectService.getAll();
        if (projects.length > 0) {
          const latest = projects[0];
          setCurrentProject(latest);
          // 恢复步骤：根据项目状态推断当前步骤
          if (latest.pptJson) {
            setCurrentStep(4);
          } else if (latest.styleKitId) {
            setCurrentStep(3);
          } else if (latest.templateFileId) {
            setCurrentStep(2);
          }
        } else {
          const project = await projectService.create({ title: '新项目', status: 'draft' });
          setCurrentProject(project);
        }
      }
    };
    initProject();
  }, [currentProject, setCurrentProject, setCurrentStep]);

  const handleStepClick = useCallback((stepNum: number) => {
    if (stepNum === currentStep) return;
    const { status } = getStepStatus(stepNum, currentStep, store);
    if (status === 'done') {
      setCurrentStep(stepNum);
    }
  }, [currentStep, store, setCurrentStep]);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Header />

      {/* 步骤指示器 */}
      <div className="bg-white border-b border-[#e2e8f0]">
        <div className="max-w-7xl mx-auto px-8 py-5">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {STEPS.map((step, index) => {
              const { status, statusText } = getStepStatus(step.num, currentStep, store);
              const isClickable = status === 'done' || status === 'current';
              return (
                <div key={step.num} className="flex items-center flex-1">
                  <button
                    onClick={() => handleStepClick(step.num)}
                    disabled={!isClickable}
                    className="flex flex-col items-center gap-1 group"
                  >
                    {/* 圆点 */}
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all
                      ${status === 'done' ? 'bg-[#1e40af] text-white shadow-sm' : ''}
                      ${status === 'current' ? 'bg-[#1e40af] text-white ring-4 ring-[#1e40af]/20' : ''}
                      ${status === 'pending' ? 'bg-gray-200 text-gray-500' : ''}
                      ${status === 'disabled' ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : ''}
                    `}>
                      {status === 'done' ? <Check size={16} /> : step.num}
                    </div>
                    <span className={`text-xs font-medium ${status === 'disabled' ? 'text-gray-300' : status === 'current' ? 'text-[#1e40af]' : 'text-gray-500'}`}>
                      {step.label}
                    </span>
                    <span className={`text-[10px] leading-tight ${status === 'disabled' ? 'text-gray-200' : 'text-gray-400'}`}>
                      {statusText}
                    </span>
                  </button>
                  {index < 4 && (
                    <div className={`flex-1 h-[1px] mx-3 mt-[-20px] ${status === 'done' ? 'bg-[#1e40af]' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 步骤内容 */}
      <div className="max-w-7xl mx-auto">
        {currentStep === 1 && <FileUploadStep store={store} />}
        {currentStep === 2 && <AnalyzeStep store={store} />}
        {currentStep === 3 && <EnhancedRequirementsForm />}
        {currentStep === 4 && (
          <Suspense fallback={<LoadingFallback text="加载编辑器..." />}>
            <EditStep />
          </Suspense>
        )}
        {currentStep === 5 && (
          <Suspense fallback={<LoadingFallback text="加载导出页..." />}>
            <GenerateStep />
          </Suspense>
        )}
      </div>
    </div>
  );
}

// ====== FileUploadStep ======
function FileUploadStep({ store }: { store: any }) {
  const { setCurrentStep, setCurrentProject, currentProject } = store;
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setUploadProgress(0);
    // Simulate upload progress
    const progressTimer = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + Math.random() * 30, 85));
    }, 300);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '上传失败');
      if (currentProject) {
        await projectService.update(currentProject.id, { templateFileId: data.fileId });
        setCurrentProject({ ...currentProject, templateFileId: data.fileId });
      }
      setUploadProgress(100);
      setTimeout(() => setCurrentStep(2), 400);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请重试');
    } finally {
      clearInterval(progressTimer);
      setUploading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setUploadProgress(0);
    const progressTimer = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + Math.random() * 30, 85));
    }, 300);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '上传失败');
      if (currentProject) {
        await projectService.update(currentProject.id, { templateFileId: data.fileId });
        setCurrentProject({ ...currentProject, templateFileId: data.fileId });
      }
      setUploadProgress(100);
      setTimeout(() => setCurrentStep(2), 400);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请重试');
    } finally {
      clearInterval(progressTimer);
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-10 text-center max-w-lg">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-[#0f172a] mb-2">上传失败</h3>
          <p className="text-sm text-[#64748b] mb-6">{error}</p>
          <button onClick={() => setError(null)} className="px-6 py-2.5 bg-[#1e40af] text-white text-sm font-medium rounded-xl hover:bg-[#1e40af]/90">重新上传</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[500px] px-4 py-12">
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-10 w-full max-w-2xl">
        <div className="max-w-md mx-auto">
          {/* 标题 */}
          <h2 className="text-xl font-bold text-[#0f172a] mb-2">第 01 步 · 上传参考 PPT</h2>
          <p className="text-sm text-[#64748b] mb-8">上传你的参考 PPT，AI 将学习其视觉风格与结构逻辑，为后续生成提供基础。</p>

          {/* 上传区 */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className={`border-2 border-dashed rounded-2xl p-10 text-center mb-6 transition-colors ${uploading ? 'border-[#1e40af] bg-[#1e40af]/5' : 'border-[#e2e8f0] hover:border-[#1e40af]'}`}
          >
            {uploading ? (
              <div className="space-y-4">
                <div className="w-12 h-12 mx-auto rounded-full border-4 border-[#e2e8f0] border-t-[#1e40af] animate-spin" />
                <p className="text-sm font-medium text-[#0f172a]">正在上传...</p>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-[#1e40af] h-full rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            ) : (
              <>
                <Upload size={40} className="mx-auto text-[#64748b] mb-4" />
                <p className="text-base font-medium text-[#0f172a] mb-2">将参考 PPT 拖拽到这里</p>
                <p className="text-sm text-[#64748b] mb-6">支持 .pptx / .pdf / Keynote 导出的 PDF</p>
                <label className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#1e40af] text-white text-sm font-medium rounded-xl cursor-pointer hover:bg-[#1e40af]/90 transition-colors">
                  <Upload size={16} />
                  选择文件
                  <input type="file" accept=".pdf,.ppt,.pptx" onChange={handleUpload} disabled={uploading} className="hidden" />
                </label>
              </>
            )}
          </div>

          {/* 隐私提示 */}
          <p className="text-xs text-[#94a3b8] text-center">文件仅用于风格识别与内容生成，不会被用于其他用途。</p>
        </div>
      </div>
    </div>
  );
}

// ====== AnalyzeStep ======
function AnalyzeStep({ store }: { store: any }) {
  const { currentProject, setCurrentProject, setCurrentStep, setCurrentStyleKit } = store;

  const handleStyleKitComplete = async (styleKit: StyleKit) => {
    setCurrentStyleKit(styleKit);
    if (currentProject) {
      const updates = { styleKitId: styleKit.id, styleKitVersion: 1, styleKitSource: 'uploaded-template' as const, styleConfig: styleKitToStyleConfig(styleKit) };
      await projectService.update(currentProject.id, updates);
      setCurrentProject({ ...currentProject, ...updates });
    }
    setTimeout(() => setCurrentStep(3), 500);
  };

  const handleCancel = () => setCurrentStep(1);

  if (!currentProject?.templateFileId) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <LoadingFallback text="请先上传模板..." />
      </div>
    );
  }

  return (
    <StyleKitWizard
      fileId={currentProject.templateFileId}
      fileName={currentProject.title}
      onComplete={handleStyleKitComplete}
      onCancel={handleCancel}
    />
  );
}

function LoadingFallback({ text = '加载中...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[500px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#e2e8f0] border-t-[#1e40af] mx-auto mb-4" />
        <p className="text-sm text-[#64748b]">{text}</p>
      </div>
    </div>
  );
}
