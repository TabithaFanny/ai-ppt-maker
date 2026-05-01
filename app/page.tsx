'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles, Upload, FileEdit, Download, CheckCircle2, Layers, Palette, Type, Layout } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">AI PPT</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/create" className="text-gray-600 hover:text-gray-900 transition">
              开始创建
            </Link>
            <Link href="/projects" className="text-gray-600 hover:text-gray-900 transition">
              我的项目
            </Link>
          </nav>
          <Link
            href="/create"
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          >
            开始使用
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Hero Text */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                <Sparkles size={16} />
                <span>上传参考模板，AI 生成同风格 PPT</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                不再从零开始
                <br />
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  专业PPT
                </span>
              </h1>

              <p className="text-lg md:text-xl text-gray-600 leading-relaxed max-w-lg">
                自动提取模板的配色、版式、字体与视觉节奏，
                <br className="hidden md:block" />
                将其应用到你的新内容，生成可交付的专业演示文稿。
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/create"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-600/25"
                >
                  <Upload size={20} />
                  开始创建 PPT
                  <ArrowRight size={20} />
                </Link>
                <Link
                  href="/projects"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-gray-700 text-lg font-semibold rounded-xl hover:bg-gray-50 transition border border-gray-200"
                >
                  查看我的项目
                </Link>
              </div>
            </div>

            {/* Right: 空（保持布局对称，lg下展示空白） */}
            <div className="hidden lg:block" />

          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-100/50 to-transparent pointer-events-none" />
      </section>

      {/* Five Step Flow */}
      <section className="border-t bg-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">五步生成专业 PPT</h2>
            <p className="text-gray-600">从模板到成品，每个步骤清晰可控</p>
          </div>

          <div className="grid md:grid-cols-5 gap-4 md:gap-6">
            {[
              { icon: Upload, step: 1, title: '上传模板', desc: 'PDF/PPT/PPTX' },
              { icon: Sparkles, step: 2, title: '分析风格', desc: '配色+字体+排版' },
              { icon: FileEdit, step: 3, title: '输入需求', desc: '主题+受众+要点' },
              { icon: Layers, step: 4, title: '编辑内容', desc: '调整+AI配图' },
              { icon: Download, step: 5, title: '导出完成', desc: 'PPTX/JSON' },
            ].map((item, i) => (
              <div key={item.step} className="relative">
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm text-center hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <item.icon size={20} className="text-blue-600" />
                  </div>
                  <div className="text-xs font-medium text-gray-400 mb-1">{item.step}</div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
                {i < 4 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                    <ArrowRight size={16} className="text-gray-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value Section */}
      <section className="border-t bg-gray-50 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">为什么选择 AI PPT</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Palette,
                title: '风格继承',
                description: '自动分析模板的配色方案，提取主色、辅色和强调色',
              },
              {
                icon: Layout,
                title: '版式复用',
                description: '学习模板的布局模式，保持视觉一致性',
              },
              {
                icon: Type,
                title: '字体搭配',
                description: '识别标题和正文的字体、字号层级关系',
              },
              {
                icon: Layers,
                title: '视觉节奏',
                description: '理解每页的重点元素密度和留白比例',
              },
              {
                icon: CheckCircle2,
                title: '内容原创',
                description: '内容100%来自你的输入，只继承风格不复制内容',
              },
              {
                icon: Sparkles,
                title: 'AI 配图',
                description: '自动生成与内容匹配的配图，增强视觉效果',
              },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <item.icon size={24} className="text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>AI PPT 生成平台 · 让创作更高效</p>
        </div>
      </footer>
    </div>
  );
}

// DemoShowcase 已移除 — 首页保持简洁
