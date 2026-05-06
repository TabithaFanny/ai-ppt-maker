# PROJECT_BRIEF — AI PPT Generator

## 核心定位
AI PPT Generator 是一款**风格继承式 PPT 生成工具**。用户上传参考 PPT，AI 分析其视觉风格（颜色、字体、布局、装饰元素），根据用户需求生成新 PPT，保持一致的视觉语言。

**核心价值**：不是模板套用，而是"风格 DNA 继承 + 内容生成"。

## 核心用户流程
1. 上传参考 PPT → 提取缩略图
2. AI 分析风格 → 每页反推 Prompt + 生成 StyleKit
3. 对话规划 → 用户描述需求，AI 规划整套 PPT 页面结构
4. 单页生成 → AI 根据每页 Prompt 和参考页风格生成具体页面
5. 编辑微调 → 文字、布局、配图修改
6. 导出 PPTX → 生成可编辑 PowerPoint

## 技术栈
- Next.js 15 (App Router) + React 19 + TypeScript
- Zustand (状态管理)
- Dexie (IndexedDB，本地持久化)
- Tailwind CSS
- pptxgenjs (PPTX 导出)
- AI: DeepSeek (chat) + GPT-4o (vision) via `/lib/api-client.ts`

## 项目路径
`/Volumes/E/ai-ppt-generator`