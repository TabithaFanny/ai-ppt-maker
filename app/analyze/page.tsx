'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { StyleReport as StyleReportType, ColorGroup } from '@/types';
import { useRouter } from 'next/navigation';
import { ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function AnalyzePage() {
  const { currentProject, styleReport, updateStyleReport, setCurrentStep } = useStore();
  const router = useRouter();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<StyleReportType | null>(null);

  useEffect(() => {
    if (styleReport) {
      setReport(styleReport);
    } else if (currentProject?.styleConfig) {
      // Generate mock style report from styleConfig for demo
      const mockReport = generateMockReport(currentProject.styleConfig);
      setReport(mockReport);
      updateStyleReport(mockReport);
    }
  }, [currentProject, styleReport]);

  const handleContinue = () => {
    setCurrentStep(3);
    router.push('/create');
  };

  const handleReAnalyze = async () => {
    if (!currentProject?.templateFileId) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: currentProject.templateFileId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '分析失败');
      // Convert StyleConfig to StyleReport format
      const newReport = convertToStyleReport(data);
      setReport(newReport);
      updateStyleReport(newReport);
    } catch (error) {
      console.error('分析失败:', error);
      const { useToast } = await import('@/lib/toast');
      useToast.getState().show('error', '分析失败，请重试');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">正在分析模板风格...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">模板风格分析报告</h1>
            <p className="text-gray-500 mt-1">AI 已分析你的模板，提取了以下设计 DNA</p>
          </div>
          <button
            onClick={handleReAnalyze}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={18} className={isAnalyzing ? 'animate-spin' : ''} />
            {isAnalyzing ? '重新分析中...' : '重新分析'}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Color Palette */}
        <section className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">主色系</h2>
          <div className="flex flex-wrap gap-4">
            {report.palette.map((color, index) => (
              <ColorSwatch key={index} color={color} />
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-4">
            共提取 {report.palette.length} 个颜色，包括主色、辅色、强调色和背景色
          </p>
        </section>

        {/* Typography */}
        <section className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">字体风格</h2>
            <ConfidenceBadge confidence={report.confidence} />
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-gray-500 mb-1">标题字体</div>
              <div className="text-xl font-bold text-gray-900" style={{ fontFamily: report.typography.titleFont }}>
                {report.typography.titleFont} {report.typography.titleSize}pt
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">正文字体</div>
              <div className="text-lg text-gray-700" style={{ fontFamily: report.typography.bodyFont }}>
                {report.typography.bodyFont} {report.typography.bodySize}pt
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-sm text-gray-500 mb-2">行高</div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: `${(report.typography.lineHeight / 3) * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-700">{report.typography.lineHeight}</span>
            </div>
          </div>
        </section>

        {/* Layout DNA */}
        <section className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">布局 DNA</h2>
          <div className="flex flex-wrap gap-3">
            <LayoutTag label={report.layoutDNA.type} />
            <LayoutTag label={report.layoutDNA.alignment} />
            {report.layoutDNA.hasHeader && <LayoutTag label="有页眉" />}
            {report.layoutDNA.hasSidebar && <LayoutTag label="有侧边栏" />}
            {report.layoutDNA.gridColumns && (
              <LayoutTag label={`${report.layoutDNA.gridColumns} 栏网格`} />
            )}
          </div>
        </section>

        {/* Page Rhythm */}
        <section className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">页面节奏</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-500 mb-1">平均每页元素数</div>
              <div className="text-2xl font-bold text-gray-900">
                {report.pageRhythm.avgElementsPerSlide}
                <span className="text-sm font-normal text-gray-500 ml-2">个</span>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">视觉密度</div>
              <div className="flex items-center gap-2">
                <DensityIndicator density={report.pageRhythm.visualDensity} />
                <span className="text-lg font-medium text-gray-700">
                  {report.pageRhythm.visualDensity === 'light' ? '轻盈' :
                   report.pageRhythm.visualDensity === 'medium' ? '适中' : '紧凑'}
                </span>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">留白比例</div>
              <div className="text-2xl font-bold text-gray-900">
                {Math.round(report.pageRhythm.whitespaceRatio * 100)}
                <span className="text-sm font-normal text-gray-500 ml-2">%</span>
              </div>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => router.push('/create')}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            上一步
          </button>
          <button
            onClick={handleContinue}
            className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
          >
            继续：定义任务
            <ArrowRight size={20} />
          </button>
        </div>
      </main>
    </div>
  );
}

function ColorSwatch({ color }: { color: ColorGroup }) {
  const roleLabels: Record<string, string> = {
    primary: '主色',
    secondary: '辅色',
    accent: '强调',
    background: '背景',
    text: '文字',
    neutral: '中性',
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <div
        className="w-12 h-12 rounded-lg shadow-inner"
        style={{ backgroundColor: color.hex }}
      />
      <div>
        <div className="text-sm font-mono text-gray-900">{color.hex}</div>
        <div className="text-xs text-gray-500">{roleLabels[color.role] || color.role}</div>
      </div>
    </div>
  );
}

function LayoutTag({ label }: { label: string }) {
  return (
    <span className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg border border-blue-100">
      {label}
    </span>
  );
}

function DensityIndicator({ density }: { density: 'light' | 'medium' | 'dense' }) {
  const levels = {
    light: { bars: 2, color: 'bg-green-500' },
    medium: { bars: 3, color: 'bg-yellow-500' },
    dense: { bars: 4, color: 'bg-red-500' },
  };
  const { bars, color } = levels[density];

  return (
    <div className="flex items-end gap-0.5 h-6">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`w-2 rounded-sm ${i <= bars ? color : 'bg-gray-200'}`}
          style={{ height: `${i * 25}%` }}
        />
      ))}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const getColor = () => {
    if (confidence >= 80) return 'bg-green-100 text-green-700 border-green-200';
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${getColor()}`}>
      <CheckCircle2 size={16} />
      <span>置信度 {confidence}%</span>
    </div>
  );
}

// Helper functions
function generateMockReport(config: any): StyleReportType {
  return {
    palette: [
      { hex: config.palette.primary, name: 'Primary', role: 'primary' },
      { hex: config.palette.secondary, name: 'Secondary', role: 'secondary' },
      { hex: config.palette.accent, name: 'Accent', role: 'accent' },
      { hex: config.palette.background, name: 'Background', role: 'background' },
      { hex: config.palette.text, name: 'Text', role: 'text' },
      { hex: '#6b7280', name: 'Neutral', role: 'neutral' },
    ],
    typography: {
      titleFont: config.typography.titleFont,
      bodyFont: config.typography.bodyFont,
      titleSize: config.typography.titleSize,
      bodySize: config.typography.bodySize,
      lineHeight: 1.5,
      fontWeight: {
        title: 'bold',
        body: 'normal',
      },
    },
    layoutDNA: {
      type: config.layout.type,
      alignment: 'left',
      hasHeader: true,
      hasSidebar: false,
    },
    pageRhythm: {
      avgElementsPerSlide: 3.2,
      visualDensity: 'medium',
      whitespaceRatio: 0.3,
    },
    confidence: 87,
  };
}

function convertToStyleReport(config: any): StyleReportType {
  return {
    palette: [
      { hex: config.palette.primary, name: 'Primary', role: 'primary' },
      { hex: config.palette.secondary, name: 'Secondary', role: 'secondary' },
      { hex: config.palette.accent, name: 'Accent', role: 'accent' },
      { hex: config.palette.background, name: 'Background', role: 'background' },
      { hex: config.palette.text, name: 'Text', role: 'text' },
    ],
    typography: {
      titleFont: config.typography.titleFont,
      bodyFont: config.typography.bodyFont,
      titleSize: config.typography.titleSize,
      bodySize: config.typography.bodySize,
      lineHeight: 1.5,
      fontWeight: { title: 'bold', body: 'normal' },
    },
    layoutDNA: {
      type: config.layout.type,
      alignment: 'left',
      hasHeader: true,
    },
    pageRhythm: {
      avgElementsPerSlide: 3.2,
      visualDensity: 'medium',
      whitespaceRatio: 0.3,
    },
    confidence: 87,
  };
}
