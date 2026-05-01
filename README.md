# AI PPT 生成平台

基于 Next.js + Claude API 的智能 PPT 生成工具

## 功能特性

- ✅ 上传 PPT 模板（支持 PDF/PPT/PPTX）
- ✅ AI 自动分析设计风格
- ✅ 输入需求生成新 PPT
- ✅ 可视化编辑器（拖拽排序）
- ✅ 导出 PPTX 文件
- ✅ 本地数据存储（IndexedDB）

## 技术栈

- **前端**: Next.js 16 + React 19 + TypeScript
- **状态管理**: Zustand
- **数据库**: Dexie.js (IndexedDB)
- **AI**: Claude Sonnet 4.6
- **拖拽**: @dnd-kit
- **导出**: pptxgenjs
- **样式**: Tailwind CSS

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

创建 `.env.local` 文件：

```bash
ANTHROPIC_API_KEY=your_api_key_here
```

### 3. 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000

## 使用流程

1. **上传模板** - 支持 PDF、PPT、PPTX 格式
2. **AI 分析风格** - 自动提取设计 DNA
3. **输入需求** - 填写主题和关键要点
4. **编辑内容** - 可视化编辑器，拖拽排序
5. **生成预览** - 导出 PPTX 文件

## 项目结构

```
ai-ppt-generator/
├── app/                      # Next.js App Router
├── components/               # React 组件
├── lib/                      # 工具库
├── types/                    # TypeScript 类型
└── uploads/                  # 上传文件目录
```

## 许可证

MIT
