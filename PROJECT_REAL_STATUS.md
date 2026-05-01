# AI PPT Generator 项目真实状态报告

**用途**：给下一个产品/架构 Agent 使用  
**原则**：以代码事实为准，宁可暴露问题  
**日期**：2026-05-01 17:20 CST  
**Commit**：`6c5a286`（本地，未推送）

---

## 一、项目基本信息

**项目名称**：AI PPT Generator  
**本地路径**：`/Users/magnus/code/ai-ppt-generator/`  
**远程**：`https://github.com/TabithaFanny/ai-ppt-maker.git`（push 因网络超时未完成）

| 类别 | 选型 |
|------|------|
| 前端框架 | Next.js 16.2.4 (App Router) |
| 样式方案 | Tailwind CSS 4 + Ant Design 6.3.6 + lucide-react |
| 状态管理 | Zustand 5.0.12 |
| 本地存储 | Dexie.js 4.4.2 (IndexedDB) |
| AI 文字（轻量） | MiniMax M2.7 (OpenAI 兼容) |
| AI 文字（深度） | DeepSeek v4-pro (OpenAI 兼容) |
| 图片生成 | GPT-Image-2 via Codesuc 中转 |
| PPT 解析 | JSZip 3.10.1 + XML 手动解析 |
| PPT 导出 | pptxgenjs 4.0.1 |
| 拖拽 | @dnd-kit |
| 数据校验 | Zod 4.4.1 |
| 测试 | Jest 30 + ts-jest |

**运行方式**：

```bash
pnpm install
pnpm dev              # → localhost:3000
pnpm test             # 125 tests ✅
npx tsc --noEmit      # 零错误 ✅
pnpm build            # 19 路由 ✅
```

**环境变量**（全部必需，全部无 mock fallback）：

| 变量 | 用途 | 必需？ | Fallback？ |
|------|------|--------|-----------|
| `MINIMAX_API_KEY` | MiniMax 调用 | ✅ | ❌ 无 |
| `DEEPSEEK_API_KEY` | DeepSeek 调用 | ✅ | ❌ 无 |
| `OPENAI_API_KEY` | GPT-Image-2 调用 | ✅ | ❌ 无 |

**代码状态**：
- 本地 commit `6c5a286` | GitHub push ❌（网络超时）
- 测试 ✅ 8 suites / 125 passed | Build ✅ 19 路由 | tsc ✅ 零错误
- Lint ⚠️ 31 errors（no-explicit-any）/ 75 warnings

---

## 二、核心文件与结构

**完整目录（3 层）**：

```
app/                    ★ 页面 + 16 个 API Routes（2356 行）
  page.tsx                首页
  create/page.tsx         五步流程
  projects/page.tsx       项目列表
  api/                    ★ 全部 15 个接口
    upload/               上传
    style-kit/extract/    风格提取（MiniMax）
    style-kit/distill/    风格蒸馏（DeepSeek）
    generate-stream/      SSE 流式生成（DeepSeek）
    edit-patch/           AI 改写（MiniMax）
    （+ 10 个其他）

components/             ★ React 组件（6272 行）
  EditStep.tsx             Step4（~250 行）
  GenerateStep.tsx         Step5（~305 行）
  EnhancedRequirementsForm.tsx  Step3（~400 行）
  style-kit/              StyleKit 组件组
    StyleKitWizard.tsx       ~440 行
    StyleKitReport.tsx       ~350 行
  SlideEditor.tsx          单页编辑（176 行）
  OutlineTree.tsx          大纲树（96 行）
  PropertyPanel.tsx        属性面板 ⚠️ 只读
  ElementCanvas.tsx        画布 ⚠️ 半实现
  AiEditPanel.tsx          AI 编辑

lib/                    ★ 核心业务逻辑（4691 行）
  api-client.ts            ★ AI 统一客户端
  claude.ts                ★ AI Pipeline（4 个函数）
  store.ts                 ★ Zustand 状态
  db.ts                    ★ IndexedDB CRUD
  pptx-parser.ts           ★ PPTX 解析
  export-pptx.ts           ★ PPTX 导出
  gpt-image.ts             ★ 图片生成
  render-spec.ts           ★ RenderSpec 构建
  style-bridge.ts          ⚠️ StyleKit↔StyleConfig 桥接
  deck-planner.ts          ★ DeckPlan 编排
  deck-resolver.ts         ★ DeckPlan→PPTJson
  layout-resolver.ts       ★ LayoutPlan zone 解析
  edit-patch.ts            ★ EditPatch 工厂
  edit-history.ts          ★ Undo/Redo
  auto-fixer.ts            ★ 自动修复器
  schemas.ts               ★ Zod Schema
  residual-checker.ts      残留检查

types/                  ★ 核心类型（935 行）
  project.ts               ★ Project / Slide / StyleConfig / PPTJson
  stylekit.ts              ★ StyleKit / StyleDNA
  elements.ts              ★ ContentBlock
  generation.ts            ★ DeckPlan / RenderSpec / EditPatch

__tests__/              13 个测试文件
  pipeline.test.ts
  edit-patch.test.ts
  auto-fixer.test.ts
  （+ 10 个）
```

---

## 三、产品流程真实状态

| 目标功能 | 当前状态 | 真实可用？ | 主要缺口 | 优先级 |
|----------|----------|-----------|----------|--------|
| 首页 | 真实可用 | ✅ | 右半空屏 | P2 |
| 五步流程 | 半实现 | ⚠️ | StepIndicator 不可点击跳回 | P2 |
| 上传 PPT | 真实可用 | ✅ | 无拖拽，无模板预览 | P2 |
| 风格分析 | 真实可用 | ✅ | 慢(20-40s)，字体不准 | P1 |
| 分析报告 | 真实可用 | ✅ | — | P2 |
| 封面预览 | 真实可用 | ✅ | 图片不保存 | P2 |
| 需求输入 | 真实可用 | ✅ | 字段太多 | P2 |
| AI Prompt 预览 | 真实可用 | ✅ | 文本拼接，非 AI 生成 | P2 |
| 生成 DeckPlan | 真实可用 | ✅ | 输出不稳 | P1 |
| 生成 slides | 真实可用 | ✅ | 内容模板化 | P1 |
| 页面大纲 | 真实可用 | ✅ | — | — |
| 单页编辑 | 真实可用 | ✅ | — | — |
| 讲稿备注 | 未实现 | ❌ | 完全缺失 | P1 |
| 画布视图 | 半实现 | ⚠️ | 拖拽不完整 | P2 |
| 拖拽/resize | 半实现 | ⚠️ | 数字坐标 | P2 |
| 属性设置 | UI 壳 | ❌ | 全部只读 | P2 |
| AI 改写 | 真实可用 | ⚠️ | 输出不稳，无语气模式 | P1 |
| AI 配图 | 真实可用 | ✅ | 不写入 PPTX | P1 |
| Step4 逐页生图 | 未实现 | ❌ | TODO-4 | P1 |
| 导出 PPTX | 半实现 | ⚠️ | 风格丢失，不含 AI 图 | P1 |
| 导出 PDF | 未实现 | ❌ | — | P2 |
| 项目列表 | 真实可用 | ✅ | 本地不跨设备 | P1 |
| 设置页 | 未实现 | ❌ | — | P3 |
| 本地持久化 | 真实可用 | ✅ | IndexedDB | — |

---

## 四、API / 后端接口真实状态

**15 个 API Route，全部真实可用，全部无 Mock。**

| 接口 | 方法 | 功能 | 依赖 AI | 真实？ |
|------|------|------|---------|--------|
| `/api/upload` | POST | 上传文件 | 否 | ✅ |
| `/api/analyze` | POST | 旧风格分析 | MiniMax | ✅ |
| `/api/generate-ppt` | POST | 旧 PPT 生成 | DeepSeek | ✅ |
| `/api/generate-stream` | POST | SSE 流式生成 | DeepSeek | ✅ |
| `/api/generate-slide-image` | POST | AI 配图 | GPT-Image-2 | ✅ |
| `/api/generate-image` | POST | 独立生图 | GPT-Image-2 | ✅ |
| `/api/edit-patch` | POST | AI 改写 | MiniMax | ⚠️ |
| `/api/style-kit/extract` | POST | 风格提取 | MiniMax | ✅ |
| `/api/style-kit/distill` | POST | 风格蒸馏 | DeepSeek | ✅ |
| `/api/style-kit/jobs` | GET/POST | 分析任务管理 | 否 | ✅ |
| `/api/reverse-visual-prompt` | POST | 逆向视觉 Prompt | MiniMax | ✅ |
| `/api/extract-assets` | POST | 素材提取 | 否 | ✅ |
| `/api/extract-slide-images` | POST | 幻灯片图片提取 | 否 | ✅ |
| `/api/verify-residual` | POST | 残留检查 | 否 | ✅ |
| `/api/distill-template-prompt` | POST | Prompt 蒸馏 | MiniMax | ✅ |

**关键缺失**：
- ❌ 提取每页缩略图 — 函数存在但返回空 base64
- ❌ 导出 PDF
- ❌ 设置保存

---

## 五、AI Pipeline 真实状态

### 模型分配

| 模型 | 用途 | 调用方法 |
|------|------|----------|
| MiniMax M2.7 | 视觉分析、逆向视觉、编辑 Patch、Prompt 蒸馏 | `minimaxChat()` |
| DeepSeek v4-pro | 风格蒸馏、需求转译、JSON 生成、DeckPlan | `deepseekChat()` |
| GPT-Image-2 | 全部图片生成 | `generateImage()` |

### Pipeline 流程图（真实）

```
上传 POST /api/upload → uploads/{fileId}.pptx
  ↓
[旧] POST /api/analyze
  → pptx-parser 解压→XML→文本+图片 base64
  → MiniMax analyzeStyle()
  → StyleConfig JSON
  ↓
[新] POST /api/style-kit/extract（逐页图片→MiniMax 视觉分析）
  → StyleDNAResult[]（每页配色/字体/排版）
  ↓
POST /api/style-kit/distill（DeepSeek 融合）
  → Zod 校验 → StyleKit JSON
  ↓
[用户输入需求]（纯前端，无 AI）
  ↓
POST /api/generate-stream（主链路）
  → generateDeckPlan() → DeepSeek → Zod
  → translateRequirements() → DeepSeek → 自然语言
  → generatePPTJson() → DeepSeek → Zod
  → SSE 流式返回进度
  ↓
[Step4 编辑]（前端，IndexedDB 保存，可选 AI 改写）
  ↓
[Step5 AI 配图] → GPT-Image-2
  ↓
[导出] → buildRenderSpec() → exportRenderSpecToPPTX() → pptxgenjs → 下载
```

### 重要特征

| 特征 | 状态 |
|------|------|
| 真实大模型 | ✅ |
| Streaming/SSE | ✅ `/api/generate-stream` |
| 中断/超时 | ✅ AbortController 120s |
| Retry | ✅ `withRetry(fn, 3)` |
| Token/Cost/Latency | ❌ 全无 |
| Mock 模式 | ❌ 无 |
| Zod Schema 校验 | ⚠️ 部分有（distill/PPTJson/DeckPlan/EditPatch，其他无） |

### 最容易失败的调用
**`POST /api/style-kit/extract`**（MiniMax 视觉分析）。大文件 base64 易超时，无 timeout 保护，无 mock fallback。

---

## 六、PPT 风格继承能力真实状态

### 6.1 能否读取参考 PPT？
✅ `lib/pptx-parser.ts` 用 JSZip 解压 PPTX，读 XML 提取文本和图片。

### 6.2 能提取哪些风格信息？

| 维度 | 可确认？ | 准确性 |
|------|----------|--------|
| 配色 | ✅ 真实可确认 | 中，HEX 格式 |
| 字体 | ⚠️ 部分可确认 | 低，AI 猜的可能完全错 |
| 字号 | ⚠️ 部分可确认 | 中，估计值 |
| 布局 | ✅ 真实可确认 | 能识别单栏/双栏/居中 |
| 图片风格 | ❌ 不可确认 | 只有文字描述 |
| 形状/卡片 | ❌ 不可确认 | XML 有但未提取 |
| 动效/转场 | ❌ 不可确认 | 未解析 |

### 6.3 数据类型

**两套类型系统并行**：

旧 `StyleConfig`（`types/project.ts`，更早，字段更少）：
```typescript
{ overallStyle, palette(5色), typography(4字段), layout(3字段) }
```

新 `StyleKit`（`types/stylekit.ts`，260 行，更完整）：
```typescript
{ styleDNA(配色/字体/间距/效果/情绪), layoutPatterns[], scenarioAdapters[] }
```

`lib/style-bridge.ts` 负责转换。**代码中两套混用**。

### 6.4 StyleKit 是否进入生成链路？
✅ `deck-resolver.ts`（布局）→ `render-spec.ts`（配色/字体）→ `export-pptx.ts`（导出）。

### 6.5 是否真的继承风格？
- ✅ 颜色：背景色、文字色
- ⚠️ 字体：AI 猜的名在 pptxgenjs 中可能无效
- ❌ 布局：用的是预设 zone 模板，不是参考 PPT 的版式
- ❌ 图片风格：未继承
- ❌ 形状/卡片：未继承

### 6.6 最薄弱环节
**"分析→生成"中间断层**。StyleKit 有风格信息，但生成阶段的 prompt 只要求"用这个风格"，没有精确的版式/布局控制。

### 6.7 测试
❌ 无测试验证风格继承效果。`style-bridge.test.ts` 只测类型转换。

---

## 七、内容生成与 DeckPlan 状态

### 7.1 能否生成 DeckPlan？
✅ `lib/claude.ts` → `generateDeckPlan()` → DeepSeek → Zod `DeckPlanSchema`。

### 7.2 DeckPlan 数据结构
```typescript
{ id, projectId, title, scenario, audience,
  slidePlans: [{ id, index, role, title, mainConclusion, contentOutline[], layoutHint? }],
  metadata: { totalPages, generatedAt } }
```

### 7.3 能否生成每页内容？
- ✅ 标题
- ✅ 核心结论
- ✅ 内容模块（text/list/chart）
- ❌ 讲稿备注

### 7.4 DeckPlan→slides 转换
`lib/deck-resolver.ts` → `resolveDeckPlan()`：用 `layout-resolver` 分配 zone → 生成 `ContentBlock[]` → 组装 `Slide[]`。

### 7.5 支持编辑后保存？
✅ IndexedDB 自动保存（1000ms debounce）。

### 7.6 支持逐页重新生成？
✅ Step5 单张重生成（Prompt 编辑弹窗 → GPT-Image-2 → 替换图片）。

### 7.7 支持 AI 改写？
✅ `/api/edit-patch` → MiniMax → `EditPatch[]` → 用户手动应用。**无语气模式**。

### 7.8 最大问题
**内容模板化 + 缺少图片**。每页结构类似，生成内容中 contentType 几乎全是 `text`，`image` 和 `chart` 极少。

---

## 八、PPT 编辑器能力真实状态

| 能力 | 状态 | 文件 | 可撤销？ | 问题 |
|------|------|------|---------|------|
| 页面大纲 | 真实实现 | `OutlineTree.tsx` | N/A | 无二级大纲 |
| 切换页面 | 真实实现 | `OutlineTree.tsx` | N/A | — |
| 添加页面 | 真实实现 | `EditStep.tsx` | N/A | — |
| 删除页面 | 真实实现 | `EditStep.tsx` | ❌ | 不可 undo |
| 调整顺序 | 真实实现 | `OutlineTree.tsx` | N/A | @dnd-kit |
| 编辑标题 | 真实实现 | `SlideEditor.tsx` | ✅ | — |
| 编辑结论 | 真实实现 | `SlideEditor.tsx` | ✅ | — |
| 编辑内容块 | 真实实现 | `SlideEditor.tsx` | ✅ | — |
| 讲稿备注 | 未实现 | — | — | 完全缺失 |
| 自动保存 | 真实实现 | `EditStep.tsx` | N/A | 无保存状态 UI |
| undo/redo | 真实实现 | `edit-history.ts` | ✅ | 文本修改有效 |
| 画布编辑 | 半实现 | `ElementCanvas.tsx` | ✅位置 | 拖拽不流畅 |
| 拖拽 | 半实现 | `ElementCanvas` | ✅ | 数字坐标 |
| resize | 半实现 | `PropertyPanel` | ✅ | 数字坐标 |
| 属性面板 | UI 壳 | `PropertyPanel.tsx` | — | 全部只读 |
| 实时预览 | 半实现 | 预览模式 | N/A | 无精确视觉 |
| AI 修改 | 真实实现 | `AiEditPanel.tsx` | ✅ | 输出不稳 |
| diff preview | 半实现 | `patch-diff.ts` | N/A | 前端无 UI |
| PatchValidator | 真实实现 | `validate-patch.ts` | N/A | — |
| AutoFix | 真实实现 | `auto-fixer.ts` | N/A | 空标题/结论修复 |

---

## 九、AI 配图与逐页生图状态

| 能力 | 状态 | 说明 |
|------|------|------|
| AI 配图 | ✅ 真实可用 | Step4/Step5 入口 |
| 模型 | GPT-Image-2 | via Codesuc |
| 单页生成 | ✅ | Step5 独立 |
| 编辑 Prompt | ✅ | 弹窗可改 |
| 替换图片 | ✅ | 新图覆盖 |
| 保存图片 | ⚠️ React state | 刷新丢失 |
| 写入 PPTX | ❌ | 不写入 |
| 失败重试 | ❌ | Toast 提示 |
| 耗时 | 5-15s | 无记录 |
| **TODO-4 (Step4 逐页生图)** | ❌ 未实现 | — |
| **DreamKit** | ❌ 未实现 | 只有概念笔记 |

---

## 十、PPTX / PDF 导出状态

| 能力 | 状态 | 说明 |
|------|------|------|
| 导出 PPTX | ✅ | pptxgenjs 4.0.1 |
| 导出 PDF | ❌ | pdf-lib 未用 |
| 基于 RenderSpec | ✅ | `exportRenderSpecToPPTX()` |
| 包含编辑内容 | ✅ | 从 PPTJson |
| 包含 AI 图片 | ❌ | 不写入 |
| 保留风格 | ⚠️ 仅颜色 | 背景色+文字色 |
| 多页 | ✅ | 逐页 |
| 进度反馈 | ✅ | TopBar |
| 失败处理 | ⚠️ | Toast 提示 |
| 文件生成 | 浏览器下载 | 无服务器文件 |
| 测试 | ❌ 无 | — |
| 兼容性验证 | ❌ | — |

---

## 十一、核心数据模型

### 真实存在的结构

| 结构 | 位置 | 说明 |
|------|------|------|
| `Project` | `types/project.ts` | 核心，含 styleKitId/styleConfig/userInput/pptJson |
| `StyleConfig` | `types/project.ts` | 旧风格，5 色/4 字体/3 布局 |
| `StyleKit` | `types/stylekit.ts` | 新风格，更完整，260 行 |
| `StyleDNA` | `types/stylekit.ts` | 配色/字体/间距/效果/情绪 |
| `DeckPlan` | `types/generation.ts` | 大纲，含 slidePlans[] |
| `LayoutPlan` | `types/generation.ts` | zone 布局 |
| `RenderSpec` | `types/generation.ts` | 渲染规格（Web+PPTX 唯一真源）|
| `EditPatch` | `types/generation.ts` | 原子操作 patch |
| `PatchDiff` | `types/generation.ts` | diff 结构 |
| `Slide` | `types/project.ts` | 核心，含 title/mainConclusion/content[] |
| `ContentBlock` | `types/elements.ts` | 含 type/content/position/style |
| `AnalysisJob` | `types/project.ts` | 异步分析任务 |
| `UserInput` | `types/project.ts` | 表单输入 |

### 缺失的结构
- ❌ `ExportStatus` — 无独立类型
- ❌ `RewriteSuggestion` — 改写结果用 patch 数组
- ❌ `SlideStyle` — 样式混在 ContentBlock.style 中
- ❌ 讲稿备注 — 无字段

---

## 十二、Mock 与真实功能边界

| 功能 | 前端状态 | 后端状态 | 数据状态 | 当前问题 | 建议 |
|------|----------|----------|----------|----------|------|
| 首页 | ✅ 真实 | N/A | 纯静态 | 右侧空 | 改布局 |
| 上传 | ✅ 真实 | ✅ 真实 | 真实 | 无拖拽 | 加拖拽区 |
| 风格分析 | ✅ 真实 | ✅ 真实AI | 真实 | 慢/超时 | 加 timeout |
| 封面预览 | ✅ 真实 | ✅ 真实AI | 真实 | — | — |
| 需求输入 | ✅ 真实 | N/A | 纯前端 | 字段多 | 折叠 |
| 内容生成 | ✅ 真实 | ✅ 真实AI | 真实 | 输出不稳 | 加强校验 |
| 大纲 | ✅ 真实 | N/A | 真实 | — | — |
| 单页编辑 | ✅ 真实 | N/A | 真实 | 无备注 | 加字段 |
| 画布 | ⚠️ 半成品 | N/A | 只读 | 拖拽弱 | 砍掉或用三方库 |
| 属性面板 | ⚠️ 半成品 | N/A | 只读 | 全只读 | 砍掉或加编辑 |
| AI 改写 | ⚠️ 半成品 | ✅ 真实AI | 真实 | 输出不稳 | 加强 schema |
| AI 配图 | ✅ 真实 | ✅ 真实AI | 真实 | 不进PPTX | 加 base64 写入 |
| PPTX 导出 | ✅ 真实 | N/A | 真实 | 风格丢失 | 加强渲染 |
| PDF 导出 | ❌ 没有 | ❌ 没有 | — | — | pdf-lib |
| 项目列表 | ✅ 真实 | N/A | IndexedDB | 本地 | 加远程 |
| 设置页 | ❌ 没有 | ❌ 没有 | — | — | 按需 |

---

## 十三、测试与质量状态

| 项目 | 结果 |
|------|------|
| 单元测试 | ✅ 13 个文件 |
| 集成测试 | ❌ 无 |
| E2E 测试 | ❌ 无 |
| 最近结果 | ✅ 8 suites / 125 passed |
| 核心流程有测试 | EditPatch、AutoFix、RenderSpec、style-bridge、pipeline |
| 核心流程无测试 | 风格提取→蒸馏→内容生成→导出的完整链路 |
| 如何运行 | `pnpm test` |
| 能否 build | ✅ |
| 本地启动 | ✅ |
| Lint | ⚠️ 31 errors（no-explicit-any）+ 75 warnings |
| TypeScript | ✅ 零错误 |
| 测试盲区 | 风格继承效果、AI 输出稳定性、超时重试、跨页面流程 |

---

## 十四、已知问题与技术债

### P0：阻塞运行

| 问题 | 文件 | 影响 | 修复 |
|------|------|------|------|
| 所有 AI 调用无 mock fallback | `lib/api-client.ts` | 网络不通全挂 | 加 AI_MOCK 环境变量 |
| DeepSeek 输出格式不稳定 | `lib/claude.ts` | 内容生成失败 | 更严格 Zod + fallback 到 MiniMax |

### P1：影响主要体验

| 问题 | 文件 | 影响 | 修复 |
|------|------|------|------|
| AI 图片不写入 PPTX | `GenerateStep.tsx` + `export-pptx.ts` | 配图白做 | 导出时 URL 转 base64 嵌入 |
| StyleConfig/StyleKit 双系统 | `style-bridge.ts` + 多处 | 代码复杂度 | 统一为 StyleKit |
| StyleKit 字体猜测不准确 | `style-kit/extract` | 风格继承差 | 从 XML 直接提取字体 |
| 大模板分析超时（>30 页） | `style-kit/extract` | 无法分析 | 分页提取 + timeout |
| No TODO-4 (Step4 逐页生图) | — | 功能缺失 | 加预览按钮 |
| No DreamKit | — | 风格→生图断层 | 先写 SPEC |

### P2：不影响运行

| 问题 | 文件 | 范围 |
|------|------|------|
| StepIndicator 不可点击跳回 | `app/create/page.tsx` | 导航 |
| Hero 右侧空白 | `app/page.tsx` | 视觉 |
| 无讲稿备注 | `types/project.ts` | 功能 |
| 移动端 Step3 拥挤 | `EnhancedRequirementsForm.tsx` | 移动端 |
| 上传无拖拽 | `app/create/page.tsx` | 体验 |

### P3：后续优化
- `uploads/` 无自动清理
- 无 API 速率限制
- 无 token/cost 记录
- 无用户鉴权
- 项目列表无远程存储

---

## 十五、与目标前端流程的差距

| 目标功能 | 当前具备？ | 文件 | 差距 | 优先级 |
|----------|-----------|------|------|--------|
| 首页 | ✅ 有 | `app/page.tsx` | 右侧空 | P2 |
| 五步流程 | ✅ 有 | `app/create/page.tsx` | 不可跳回 | P2 |
| Step1 上传 | ✅ 有 | create内联 | 无拖拽 | P2 |
| Step2 分析 | ✅ 有 | StyleKitWizard | 慢(20-40s) | P1 |
| 封面预览 | ✅ 有 | StyleKitReport | — | — |
| Step3 需求 | ✅ 有 | EnhancedRequirementsForm | 字段多 | P2 |
| Prompt 预览 | ✅ 有 | Step3 | 文本拼接 | P2 |
| 生成 slides | ✅ 有 | 后端 Pipeline | 输出不稳 | P1 |
| 页面大纲 | ✅ 有 | OutlineTree | — | — |
| 单页编辑 | ✅ 有 | SlideEditor | 无备注 | P1 |
| 讲稿备注 | ❌ 无 | — | 完全缺失 | P1 |
| 画布视图 | ⚠️ 半成品 | ElementCanvas | 拖拽弱 | P2 |
| AI 改写 | ⚠️ 部分 | AiEditPanel | 无语气模式 | P1 |
| 属性设置 | ⚠️ 只读 | PropertyPanel | 不可编辑 | P2 |
| AI 配图 | ✅ 有 | GPT-Image-2 | 不进PPTX | P1 |
| Step4 逐页生图 | ❌ 无 | — | TODO-4 | P1 |
| 导出 PPTX | ⚠️ 半实现 | export-pptx | 风格丢失 | P1 |
| 导出 PDF | ❌ 无 | — | — | P2 |
| 项目列表 | ✅ 有 | `/projects` | 本地 | P1 |
| 设置页 | ❌ 无 | — | — | P3 |
| 本地持久化 | ✅ 有 | IndexedDB | — | — |

### 结论
1. **五步流程完成度**：~80%（流程框架完整，但各步骤体验有 gap）
2. **前端最应该对齐**：Step4 编辑器（加讲稿备注、修只读属性）
3. **最适合复用**：AI 客户端、PPT 解析、EditPatch 系统、IndexedDB 持久化
4. **最不该扩展**：ElementCanvas + PropertyPanel（半成品，重做成本 > 价值）

---

## 十六、改造建议

### Phase A：稳定基线（1 天）
- 加 AI mock fallback（`AI_MOCK=true` 返回预设数据）
- DeepSeek 失败时 fallback 到 MiniMax
- 加 extract 超时保护

### Phase B：前端对齐（1 天）
- StepIndicator 可点击跳回
- Hero 右侧布局修复
- Step3 字段折叠

### Phase C：编辑器补齐（1 天）
- 加讲稿备注字段
- 砍掉 PropertyPanel 只读展示（或用简单编辑替代）
- AI 改写加语气模式

### Phase D：TODO-4 逐页生图（0.5 天）
- EditStep 加"预览本页"按钮
- 调 GPT-Image-2 → 弹窗展示预览图
- 不能绕开 RenderSpec

### Phase E：DreamKit SPEC（0.5 天）
- 写 `DREAMKIT_SPEC.md`
- 定义结构化输出（visualLanguage / imagePromptTemplates / keywordsForImageGen）
- 不要直接大规模实现

### Phase F：导出增强（1 天）
- AI 图片 base64 嵌入 PPTX
- 加强 pptxgenjs 渲染（字体/布局）
- （可选）pdf-lib 集成 PDF 导出

### Phase G：测试（持续）
- 加风格分析→内容生成→导出的集成测试
- 加 mock 模式的 E2E 测试

---

## 十七、给下一个 Agent 的对齐清单

### 不能动的核心链路
1. **不要绕过 StyleKit** — 所有风格信息必须经过 `types/stylekit.ts` 的数据结构
2. **不要绕过 RenderSpec** — `lib/render-spec.ts` 是 Web 预览和 PPTX 导出的唯一真源
3. **不要绕过 EditPatch 系统** — 所有编辑操作必须走 `lib/edit-patch.ts`（支持 undo/redo）
4. **不要绕过 Zod Schema** — AI 输出必须经过 `lib/schemas.ts` 的 `validateAIOutput()`

### 可以复用的模块
1. `lib/api-client.ts` — AI 统一客户端（已封装 retry/routing）
2. `lib/pptx-parser.ts` — PPTX 解析（已稳定）
3. `lib/edit-patch.ts` + `lib/edit-history.ts` — 撤销/重做系统
4. `lib/db.ts` — IndexedDB 持久化
5. `lib/auto-fixer.ts` — 自动修复器
6. `lib/schemas.ts` — Zod Schema 模板
7. 5 步流程前端框架（`app/create/page.tsx`）

### 必须先确认的文件
1. `types/stylekit.ts` — StyleKit 数据结构（不要改，只会增加字段）
2. `types/generation.ts` — DeckPlan / RenderSpec / EditPatch
3. `lib/api-client.ts` — 模型路由
4. `lib/claude.ts` — AI Pipeline
5. `lib/store.ts` — Zustand state 定义
6. `.env.local` — API Key 配置
7. `types/project.ts` — 注意 StyleConfig 和 StyleKit 是两套

### 新前端必须接入的状态/接口

从 `lib/store.ts`（Zustand）：
```
currentProject, currentStep, currentStyleKit,
updateUserInput, updatePPTJson, updateDeckPlan,
pushPatch, undo, redo
```

从 API Routes：
```
POST /api/upload, /api/style-kit/extract, /api/style-kit/distill,
/api/generate-stream, /api/edit-patch, /api/generate-slide-image
```

### 不能绕开的约束
1. **不要把预览图当最终 PPTX** — GPT-Image-2 生成的图片是展示用，不是最终输出的 PPT 页
2. **不要让 AI 直接输出 SVG** — 当前架构没有 SVG 渲染路径
3. **不要让 AI 直接修改 PPTX** — 所有编辑通过 EditPatch 系统
4. **不要新增一套平行数据结构** — 当前已经有 StyleConfig/StyleKit 两套混用，不要再加第三套
5. **不要把 mock 当真实能力** — 当前所有 mock 都不存在

### 当前最危险的误区
1. **"风格继承很好"** — 实际上只继承了颜色，字体和布局几乎没继承
2. **"AI 配图功能完善"** — 能生图但不写入 PPTX，等于没用
3. **"编辑器功能完整"** — 画布和属性面板是半成品/UI 壳，实际能用的只有内容编辑
4. **"PPTX 导出工作正常"** — 能导出但风格丢失严重

---

## 十八、执行摘要

1. **完成度**：~65%（前端 85%，后端 80%，风格继承 40%，编辑器 40%，PPTX 导出 40%，测试 30%）
2. **最应该先修**：AI mock fallback → AI 图片写入 PPTX → StyleKit 统一
3. **最适合复用**：AI 客户端、PPT 解析、EditPatch 系统、5 步流程框架、IndexedDB 持久化
4. **最不该扩展**：ElementCanvas（画布编辑器，半成品）、PropertyPanel（只读属性面板）
5. **下一步最小可交付**：让新人上传 PPT → 分析风格 → 输入主题 → 编辑 → 导出带风格和 AI 图的 PPTX，完整流程 10 分钟内跑通

**是否建议先做 TODO-4**：建议 P1，在核心问题（mock fallback、图片写入 PPTX）修复后再做。

**是否建议先做 DreamKit**：不建议现在直接实现。建议先写 `DREAMKIT_SPEC.md`，不要在项目当前阶段大规模引入新架构。

**是否建议先重构前端**：不建议大重构。当前 5 步流程框架是正确的，只需要在现有框架内补齐缺口（备注、预览、属性可编辑）。
