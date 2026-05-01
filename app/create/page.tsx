'use client';

import { useEffect, useState, lazy, Suspense } from 'react';
import { useStore } from '@/lib/store';
import { projectService } from '@/lib/db';
import EnhancedRequirementsForm from '@/components/EnhancedRequirementsForm';
import { StyleKitWizard } from '@/components/style-kit';
import { StyleKit } from '@/types';
import { styleKitToStyleConfig } from '@/lib/style-bridge';

const EditStep = lazy(() => import('@/components/EditStep'));
const GenerateStep = lazy(() => import('@/components/GenerateStep'));

export default function CreatePage() {
  const { currentProject, currentStep, setCurrentProject } = useStore();

  useEffect(() => {
    // 初始化项目
    const initProject = async () => {
      if (!currentProject) {
        const project = await projectService.create({
          title: '新项目',
          status: 'draft',
        });
        setCurrentProject(project);
      }
    };
    initProject();
  }, [currentProject, setCurrentProject]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 步骤指示器 */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: '上传模板' },
              { num: 2, label: '分析风格' },
              { num: 3, label: '输入需求' },
              { num: 4, label: '编辑内容' },
              { num: 5, label: '生成预览' },
            ].map((step, index) => (
              <div key={step.num} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    currentStep >= step.num
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step.num}
                </div>
                <span className="ml-2 text-sm font-medium">{step.label}</span>
                {index < 4 && <div className="w-12 h-0.5 bg-gray-300 mx-4" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 步骤内容 */}
      <div className="max-w-7xl mx-auto">
        {currentStep === 1 && <FileUploadStep />}
        {currentStep === 2 && <AnalyzeStep />}
        {currentStep === 3 && <EnhancedRequirementsForm />}
        {currentStep === 4 && (
          <Suspense fallback={<LoadingFallback />}>
            <EditStep />
          </Suspense>
        )}
        {currentStep === 5 && (
          <Suspense fallback={<LoadingFallback />}>
            <GenerateStep />
          </Suspense>
        )}
      </div>
    </div>
  );
}

function FileUploadStep() {
  const { setCurrentStep, setCurrentProject, currentProject } = useStore();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '上传失败');

      if (currentProject) {
        await projectService.update(currentProject.id, {
          templateFileId: data.fileId,
        });
        setCurrentProject({ ...currentProject, templateFileId: data.fileId });
      }

      setCurrentStep(2);
    } catch (error) {
      console.error('上传失败:', error);
      const message = error instanceof Error ? error.message : '上传失败，请重试';
      const { useToast } = await import('@/lib/toast');
      useToast.getState().show('error', message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[600px]">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">上传 PPT 模板</h2>
        <p className="text-gray-600 mb-8">支持 PDF、PPT、PPTX 格式，最大 50MB</p>
        <label className="inline-block px-8 py-4 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700">
          {uploading ? '上传中...' : '选择文件'}
          <input
            type="file"
            accept=".pdf,.ppt,.pptx"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}

function AnalyzeStep() {
  const { currentProject, setCurrentProject, setCurrentStep, setCurrentStyleKit } = useStore();

  const handleStyleKitComplete = async (styleKit: StyleKit) => {
    setCurrentStyleKit(styleKit);
    if (currentProject) {
      const updates = {
        styleKitId: styleKit.id,
        styleKitVersion: 1,
        styleKitSource: 'uploaded-template' as const,
        styleConfig: styleKitToStyleConfig(styleKit),
      };
      await projectService.update(currentProject.id, updates);
      setCurrentProject({ ...currentProject, ...updates });
    }
    // Auto continue to next step after a short delay
    setTimeout(() => setCurrentStep(3), 1500);
  };

  const handleCancel = () => {
    setCurrentStep(1);
  };

  if (!currentProject?.templateFileId) {
    return <LoadingFallback text="请先上传模板..." />;
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
    <div className="flex items-center justify-center min-h-[600px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">{text}</p>
      </div>
    </div>
  );
}
