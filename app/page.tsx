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

            {/* Right: Demo Showcase */}
            <div className="relative">
              <DemoShowcase />
            </div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-100/50 to-transparent pointer-events-none" />
      </section>

      {/* Three Step Flow */}
      <section className="border-t bg-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">三步生成专业 PPT</h2>
            <p className="text-gray-600">简单直观的创作流程，让每一页都保持专业水准</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {[
              {
                icon: Upload,
                step: 1,
                title: '上传模板',
                description: '上传你喜欢的 PPT 作为参考，可以是 PDF、PPT 或 PPTX 格式',
                color: 'blue',
              },
              {
                icon: FileEdit,
                step: 2,
                title: '定义任务',
                description: '输入你的主题和要点，选择使用场景和目标受众',
                color: 'purple',
              },
              {
                icon: Download,
                step: 3,
                title: '生成导出',
                description: 'AI 自动生成，保持模板风格，一键导出 PPTX 文件',
                color: 'green',
              },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className={`bg-${item.color}-50 rounded-2xl p-8 border border-${item.color}-100`}>
                  <div className={`w-14 h-14 bg-${item.color}-600 rounded-xl flex items-center justify-center mb-6`}>
                    <item.icon size={28} className="text-white" />
                  </div>
                  <div className="text-sm font-medium text-gray-500 mb-2">步骤 {item.step}</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{item.description}</p>
                </div>
                {item.step < 3 && (
                  <div className="hidden md:block absolute top-1/2 -right-6 transform -translate-y-1/2">
                    <ArrowRight size={24} className="text-gray-300" />
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

function DemoShowcase() {
  return (
    <div className="relative">
      {/* Before/After comparison */}
      <div className="bg-white rounded-2xl shadow-2xl shadow-gray-200/50 overflow-hidden border border-gray-100">
        {/* Template (Before) */}
        <div className="p-6 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <span className="ml-2 text-sm text-gray-500">参考模板</span>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex gap-4">
              {/* Color palette preview */}
              <div className="flex gap-1">
                {['#1a73e8', '#34a853', '#fbbc04', '#ea4335'].map((color, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              {/* Typography preview */}
              <div className="flex-1">
                <div className="text-lg font-bold text-gray-800">标题字体 Arial</div>
                <div className="text-sm text-gray-500">正文 Helvetica 18pt</div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <div className="flex-1 h-8 bg-gray-100 rounded" />
              <div className="flex-1 h-8 bg-gray-100 rounded" />
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 py-3 flex items-center justify-center">
          <div className="flex items-center gap-2 text-white text-sm font-medium">
            <Sparkles size={16} />
            <span>AI 分析风格 DNA</span>
          </div>
        </div>

        {/* Generated (After) */}
        <div className="p-6 bg-gradient-to-br from-slate-50 to-blue-50">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-gray-500">生成结果</span>
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
              87% 置信度
            </span>
          </div>
          <div className="bg-white rounded-lg p-4 border-2 border-blue-200 shadow-lg">
            <div className="flex gap-4">
              {/* Same color palette */}
              <div className="flex gap-1">
                {['#1a73e8', '#34a853', '#fbbc04', '#ea4335'].map((color, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              {/* Typography preview */}
              <div className="flex-1">
                <div className="text-lg font-bold text-gray-800">新标题 保持一致</div>
                <div className="text-sm text-gray-500">新内容 相同排版</div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <div className="flex-1 h-8 bg-blue-50 rounded border border-blue-100" />
              <div className="flex-1 h-8 bg-blue-50 rounded border border-blue-100" />
            </div>
          </div>
        </div>
      </div>

      {/* Floating label */}
      <div className="absolute -bottom-4 -right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
        <span className="text-sm font-medium">风格完美继承</span>
      </div>
    </div>
  );
}
