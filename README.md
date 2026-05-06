# AI PPT Generator

AI 驱动的 PPT 生成系统。上传参考 PPT → AI 拆解风格 → 对话式创作 → 导出可编辑 PPTX。

## 核心功能

- **参考页分析** — 上传 PPT，Vision API 逐页拆解：版式类型、配色、字体、元素布局、装饰
- **全局母版提取** — 自动聚合跨页共性（MasterTemplate）：配色系统、背景、Logo、装饰、字体
- **AI 对话式创作** — DeepSeek + 流式输出（SSE），根据参考风格生成新 PPT 每页 Prompt
- **一键生成** — 单页/批量/全部生成，支持 GPT-Image-2 图片生成
- **多轮编辑** — 重新生成 → 版本历史对比 → 回滚 → 确认
- **可编辑 PPTX 导出** — 背景图铺底 + 元素级文本框 + 母版页码/Logo
- **风格包** — masterTemplate + referenceSlidePrompts 打包为 JSON，跨项目/跨用户复用

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | Next.js (App Router) |
| UI | React + TailwindCSS + Lucide Icons |
| 状态 | Zustand + IndexedDB 持久化 |
| AI 对话 | DeepSeek Chat API (SSE Streaming) |
| 视觉分析 | GPT-4o Vision API (BLT Relay) |
| 图片生成 | GPT-Image-2 / DALL-E 3 |
| PPTX 导出 | pptxgenjs |
| PPT 解析 | jszip + xml2js |

## 快速开始

```bash
# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env.local
# 填入 API Keys（见下方说明）

# 开发模式
pnpm dev
# 访问 http://localhost:3456

# Mock 模式（无需 API Key）
AI_MOCK=true pnpm dev
```

## 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API Key，用于 AI 对话 |
| `BLT_API_KEY` | ✅ | BLT Relay Key，用于 Vision 分析和图片生成 |
| `MINIMAX_API_KEY` | 可选 | MiniMax API Key，备用 AI 模型 |
| `AI_MOCK` | 可选 | 设为 `true` 启用 Mock 模式 |

## 项目结构

```
app/
├── api/
│   ├── analyze-slide/      # Vision API 逐页分析
│   ├── workbench-chat/     # AI 对话 (SSE Streaming)
│   ├── generate-slide-image/ # 图片生成
│   ├── generate-image/     # 通用图片生成
│   ├── health/             # API 健康检查
│   └── upload/             # 文件上传
├── create/
│   └── workbench/          # Workbench 主页面
components/
├── workbench/
│   ├── ReferenceSlidePanel  # 左一：参考页上传与缩略图
│   ├── ReferencePromptPanel # 左二：分析结果 + 母版卡片
│   ├── WorkbenchChat        # 中间：AI 对话
│   ├── GeneratedPromptPanel # 右一：新 PPT 每页 Prompt
│   ├── GeneratedResultPanel # 右二：生成结果 + 版本历史
│   ├── MasterTemplateCard   # 母版可视化组件
│   └── WorkbenchHeader      # 顶栏：保存/导出/风格包
lib/
├── store.ts                # Zustand 全局状态
├── db.ts                   # IndexedDB (Dexie) 持久化
├── master-template.ts      # MasterTemplate 提取算法
├── export-workbench-pptx.ts # Workbench PPTX 导出
├── export-pptx.ts          # RenderSpec PPTX 导出
├── style-pack.ts           # 风格包导入导出
├── shared-assets.ts        # 共享资产生成管线
├── gpt-image.ts            # GPT-Image-2 客户端
├── api-client.ts           # 前端 API 客户端
└── render-spec.ts          # RenderSpec 构建器
types/
├── workbench.ts            # Workbench 核心类型
└── index.ts                # 类型导出
```

## 工作流

```
上传参考 PPT
    ↓
API 健康检查 → Vision API 逐页分析 → 全局母版提取
    ↓
AI 对话（注入 masterPrompt + 紧凑参考摘要）
    ↓
生成每页 Prompt（元素级拆解 + 色彩规则 + 布局结构）
    ↓
单页/批量/全部生成 → 图片预览
    ↓
多轮微调（重新生成 → 版本历史 → 回滚 → 确认）
    ↓
导出 PPTX（元素级定位 + 母版页码/Logo）
    ↓
风格包导出 → 跨项目复用
```

## License

Private
