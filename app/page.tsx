'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles, FolderOpen, LayoutTemplate, Wand2, FileStack } from 'lucide-react';
import Header from '@/components/shell/Header';

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex flex-col">
      <Header activeHref="/" />

      <main className="flex-1 px-4 py-10 md:px-8 md:py-14">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <section className="rounded-[32px] border border-[#e2e8f0] bg-gradient-to-br from-white via-[#f8fbff] to-[#eff6ff] p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)] md:p-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-white px-3 py-1 text-[11px] font-medium text-[#1d4ed8] shadow-sm">
              <Sparkles size={12} />
              基于参考风格的 AI PPT 工作流
            </div>

            <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight text-[#0f172a] md:text-6xl">
              AI PPT Generator
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#64748b] md:text-lg">
              上传你喜欢的 PPT，让 AI 学习其设计语言、版式结构与元素风格，
              再生成全新内容的演示文稿，保持统一、专业、可编辑的输出结果。
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/create?new=1"
                className="inline-flex items-center gap-2 rounded-2xl bg-[#1e40af] px-6 py-3.5 text-sm font-medium text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)] transition-colors hover:bg-[#1e40af]/90"
              >
                上传参考 PPT
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/projects"
                className="inline-flex items-center gap-2 rounded-2xl border border-[#dbeafe] bg-white px-6 py-3.5 text-sm font-medium text-[#0f172a] transition-colors hover:bg-[#f8fafc]"
              >
                <FolderOpen size={16} />
                查看项目
              </Link>
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-3">
              {[
                { icon: LayoutTemplate, title: '风格继承', desc: '从参考页中抽取版式、字体与色彩规则。' },
                { icon: Wand2, title: '智能规划', desc: '根据需求自动生成页面结构与 Prompt。' },
                { icon: FileStack, title: '可编辑导出', desc: '结果可继续编辑并导出为 PPTX。' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="rounded-2xl border border-[#e2e8f0] bg-white/90 p-4 shadow-sm">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#eff6ff] text-[#1d4ed8]">
                    <Icon size={18} />
                  </div>
                  <h2 className="text-sm font-semibold text-[#0f172a]">{title}</h2>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#64748b]">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-[28px] border border-[#e2e8f0] bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.08)] md:p-8">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1e40af]/10 text-[#1e40af]">
              <Sparkles size={22} />
            </div>
            <h2 className="text-xl font-semibold text-[#0f172a]">推荐开始方式</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#64748b]">
              如果你第一次使用，建议直接上传一份参考 PPT，体验完整的风格分析与生成链路。
            </p>

            <div className="mt-6 space-y-3">
              {[
                '上传参考 PPT / PDF，自动拆页与风格分析',
                '在 Workbench 中生成新 PPT 页面 Prompt',
                '逐页查看结果并导出可编辑 PPTX',
              ].map((item, index) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-[#1d4ed8] border border-[#dbeafe]">
                    {index + 1}
                  </div>
                  <p className="text-[13px] leading-relaxed text-[#475569]">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-[#dbeafe] bg-[#eff6ff] px-4 py-3">
              <p className="text-[11px] font-medium text-[#1d4ed8]">提示</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#475569]">
                上传参考 PPT 后，AI 将自动分析其设计风格，并帮你快速生成新 PPT。
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
