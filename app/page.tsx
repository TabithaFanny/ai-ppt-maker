'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles, FolderOpen } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* 全局导航 */}
      <header className="bg-white border-b border-[#e2e8f0]">
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#1e40af] rounded-lg flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <span className="text-base font-semibold text-[#0f172a]">AI PPT Generator</span>
          </div>
          <nav className="flex items-center gap-8">
            <Link href="/" className="text-sm text-[#1e40af] border-b-2 border-[#1e40af] pb-1">首页</Link>
            <Link href="/create" className="text-sm text-[#64748b] hover:text-[#0f172a] transition-colors">创建</Link>
            <Link href="/projects" className="text-sm text-[#64748b] hover:text-[#0f172a] transition-colors">项目</Link>
          </nav>
        </div>
      </header>

      {/* Hero 区 */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-lg">
          <h1 className="text-4xl md:text-5xl font-bold text-[#0f172a] mb-5 tracking-tight">
            AI PPT Generator
          </h1>
          <p className="text-base text-[#64748b] leading-relaxed mb-8">
            上传你喜欢的 PPT，让 AI 学习其设计风格，<br />
            并生成全新内容的演示文稿，保持一致的视觉语言。
          </p>
          <div className="flex items-center justify-center gap-4 mb-16">
            <Link
              href="/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#1e40af] text-white text-sm font-medium rounded-xl hover:bg-[#1e40af]/90 transition-colors shadow-sm"
            >
              上传参考 PPT
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#0f172a] text-sm font-medium rounded-xl border border-[#e2e8f0] hover:bg-gray-50 transition-colors"
            >
              <FolderOpen size={16} />
              查看项目
            </Link>
          </div>

          {/* 能力卡片 */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-6 max-w-md mx-auto text-left">
            <div className="w-10 h-10 bg-[#1e40af]/10 rounded-xl flex items-center justify-center mb-4">
              <Sparkles size={20} className="text-[#1e40af]" />
            </div>
            <h3 className="text-base font-semibold text-[#0f172a] mb-2">核心能力</h3>
            <p className="text-sm text-[#64748b] leading-relaxed">
              通过学习与继承设计风格，实现内容的智能生成，而非普通模板套用。
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
