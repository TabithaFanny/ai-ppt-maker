'use client';

import Header from '@/components/shell/Header';
import Link from 'next/link';
import { ArrowLeft, Upload, Sparkles, FileText, Download, Settings } from 'lucide-react';

const helpSections = [
  {
    title: '第一步：上传参考 PPT',
    icon: Upload,
    description: '上传一个你想要模仿风格的 PPT 文件。系统会分析其视觉元素，包括配色、字体、布局等。',
    tips: ['支持 .pptx / .pdf 文件', '文件大小建议不超过 20MB', 'PPT 页数建议 5-30 页效果最佳'],
  },
  {
    title: '第二步：AI 风格分析',
    icon: Sparkles,
    description: 'AI 会分析参考 PPT 的设计语言，提取 StyleKit（风格DNA），包括配色方案、字体搭配、布局模式等。',
    tips: ['分析过程通常需要 10-30 秒', '可以在此处暂停，稍后继续', '分析结果会自动保存'],
  },
  {
    title: '第三步：输入需求',
    icon: FileText,
    description: '告诉 AI 你想要什么样的 PPT 内容。你可以输入主题、关键点、想要的风格描述等。',
    tips: ['越详细的描述生成效果越好', '可以指定特定的页面数量', '支持中英文混合输入'],
  },
  {
    title: '第四步：编辑与调整',
    icon: Settings,
    description: 'AI 生成初稿后，你可以对每一页进行精细编辑，包括修改文字、调整布局、设置属性等。',
    tips: ['使用左侧工具栏切换页面', '双击文本可直接编辑', '按 Ctrl+Z 撤销，Ctrl+Shift+Z 重做'],
  },
  {
    title: '第五步：导出 PPTX',
    icon: Download,
    description: '编辑完成后，一键导出为标准 PPTX 文件。导出的文件保持可编辑状态，可以在 PowerPoint 或 Keynote 中继续修改。',
    tips: ['导出时间取决于页数，通常 5-30 秒', 'AI 生成的图片也会一并嵌入', '建议导出后检查第一页和最后一页'],
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-[#64748b] hover:text-[#1e40af] mb-6">
            <ArrowLeft size={16} />
            返回首页
          </Link>
          <h1 className="text-3xl font-bold text-[#0f172a] mb-3">使用帮助</h1>
          <p className="text-[#64748b]">了解 AI PPT Generator 的完整使用流程</p>
        </div>

        <div className="space-y-6">
          {helpSections.map((section, index) => {
            const Icon = section.icon;
            return (
              <div key={index} className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#1e40af]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon size={24} className="text-[#1e40af]" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-[#0f172a] mb-2">
                      {index + 1}. {section.title}
                    </h2>
                    <p className="text-sm text-[#64748b] mb-4">{section.description}</p>
                    <ul className="space-y-2">
                      {section.tips.map((tip, tipIndex) => (
                        <li key={tipIndex} className="flex items-start gap-2 text-sm text-[#475569]">
                          <span className="w-1.5 h-1.5 bg-[#1e40af] rounded-full mt-2 flex-shrink-0" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 p-6 bg-[#f8fafc] rounded-2xl border border-[#e2e8f0]">
          <h3 className="font-semibold text-[#0f172a] mb-3">常见问题</h3>
          <div className="space-y-4">
            <div>
              <p className="font-medium text-sm text-[#0f172a] mb-1">Q: 上传的文件安全吗？</p>
              <p className="text-sm text-[#64748b]">A: 文件仅用于风格识别与内容生成，不会被上传到任何外部服务器或共享给第三方。</p>
            </div>
            <div>
              <p className="font-medium text-sm text-[#0f172a] mb-1">Q: 导出后的 PPT 可以继续编辑吗？</p>
              <p className="text-sm text-[#64748b]">A: 可以，导出的 PPTX 是标准的原生格式，所有文字、形状、图片都可以在 PowerPoint 或 Keynote 中继续编辑。</p>
            </div>
            <div>
              <p className="font-medium text-sm text-[#0f172a] mb-1">Q: 支持多语言吗？</p>
              <p className="text-sm text-[#64748b]">A: 支持中文和英文输入，生成的 PPT 语言会跟随你的输入内容。</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}