## 六、PPT 风格继承能力现状

### 6.1 是否真的能读取用户上传的参考 PPT？

**是**。`/api/upload` 接收文件保存到本地 `uploads/` 目录；`lib/pptx-parser.ts` 用 JSZip 解压 PPTX（ZIP 格式），读 `ppt/slides/slideN.xml` 提取文本，读 `ppt/media/` 提取图片。

### 6.2 能提取哪些风格信息？

| 维度 | 能提取？ | 提取方式 | 准确性 |
|------|----------|----------|--------|
| 配色 | ✅ 提取 | AI 视觉分析识别主色/辅色/强调色/背景色/文字色 | 中—AI 可能误判 |
| 字体 | ✅ 提取 | AI 从图片中识别标题/正文字体 | 低—字体名可能猜错 |
| 字号 | ✅ 提取 | AI 估计 | 中—估计值不精确 |
| 页面布局 | ✅ 提取 | XML `<p:ph>` 占位符分析 + AI 视觉判断 | 中 |
| 图片风格 | ⚠️ 仅描述 | AI 用文字描述，无量化指标 | 低 |
| 导航样式 | ❌ 无法 | PPTX 无独立导航信息 | — |
| 形状/卡片样式 | ⚠️ 部分 | XML 可读形状属性，但未完全解析 | 低 |
| 动效/转场 | ❌ 无法 | 未解析动画节点 | — |

### 6.3 风格分析结果的数据结构

两条路径（两套结构）：

**路径 A：旧 StyleConfig（`/api/analyze` 返回）**
```typescript
interface StyleConfig {
  overallStyle: 'business' | 'tech' | 'creative' | 'academic';
  palette: {
    primary: string;    // HEX
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  typography: {
    titleFont: string;
    bodyFont: string;
    titleSize: number;
    bodySize: number;
  };
  layout: {
    type: 'single' | 'double' | 'full' | 'centered';
    spacing: number;    // px
    padding: number;    // px
  };
  designPrinciples: string[];   // 自由文本原则
}
```

**路径 B：StyleKit（`/api/style-kit/extract` + `/api/style-kit/distill` 返回）**
```typescript
interface StyleKit {
  id: string;
  name: string;
  sourceFileId: string;
  styleDNA: {
    palette: { primary, secondary, accent, background, text };  // HEX
    typography: { titleFont, bodyFont, titleSize, subtitleSize, bodySize, captionSize };
    spacing: { slidePadding, contentMargin, elementGap };  // px
    effects: { shadowEnabled, shadowType, borderRadius, gradientEnabled };
    mood: 'professional' | 'creative' | 'academic' | 'casual';
    moodDescription: string;   // 自然语言描述
  };
  layoutPatterns: LayoutPattern[];    // 来自模板的典型版式
  scenarioAdapters: ScenarioAdapter[];
  stats: { usageCount, successCount, lastUsedAt };
}
```

两条路径存在 `lib/style-bridge.ts` 做转换，但代码中两套系统混用。

### 6.4 是否能用于新 PPT 生成？

**部分能**。StyleConfig 的 palette / typography 字段会被写入 PPTJson 的 `designSystem` 字段。但**实际 PPTX 导出时**，pptxgenjs 只用了颜色字段（设置文字颜色和背景色），字体设置不完全。

### 6.5 新 PPT 是否真的继承参考风格？

**非常有限**。当前流程：
1. 参考 PPT → AI 分析 → 提取到 `StyleKit` / `StyleConfig`
2. 用户输入需求 → AI 生成 `PPTJson`（其中 `designSystem` 字段填入风格信息）
3. PPTX 导出时只用了颜色（文字颜色、背景色）

**实际继承到的**：
- ✅ 主色调（文字颜色 + 部分背景）
- ❌ 字体（AI 生成的 TTF 字体名在 pptxgenjs 中可能无效）
- ❌ 布局（完全没有继承参考版式）
- ❌ 图片风格（完全没有）
- ❌ 卡片/形状样式（完全没有）
- ❌ 动效转场（完全没有）

**本质原因**：当前架构是"AI 生成 New PPT"而不是"用参考 PPT 的模板替换内容"。生成的 PPTJson 只在设计系统字段引用风格信息，但导出时 pptxgenjs 只读颜色。

### 6.6 是否有测试用例验证风格继承？

**没有**。没有针对风格继承的集成测试或端到端测试。

---

## 七、PPT 内容生成能力现状

| 能力 | 状态 | 说明 |
|------|------|------|
| 根据主题生成大纲 | ✅ | DeepSeek → DeckPlan（含每页角色/标题/内容大纲） |
| 生成每页标题/核心结论/内容 | ✅ | DeepSeek → PPTJson（slides[] 含 title / mainConclusion / content[]）|
| 生成讲稿备注 | ❌ | 无 |
| 内容数据结构 | `Slide[]` | 见下方 |
| 用户编辑后保存 | ✅ | IndexedDB 自动保存 |
| 逐页重新生成 | ✅ | Step5 单张重生成（编辑 Prompt + 重新调 GPT-Image-2） |
| 单页 AI 改写 | ✅ | `/api/edit-patch` 调 MiniMax |
| 按语气改写 | ❌ | 不支持（当前只有一条 prompt 输入框） |
| "更专业/更简洁/更有说服力" | ❌ | 不支持的改写模式 |
| 插入为新版本 | ✅ | VersionHistory（IndexedDB 版本历史） |

**内容生成数据结构**（PPTJson.slides）：
```typescript
interface Slide {
  id: string;                  // UUID
  layout: 'title' | 'content' | 'image' | 'chart' | 'quote';
  title: string;               // 页面标题
  mainConclusion: string;      // 核心结论（一句话）
  content: ContentBlock[];     // 内容模块
}

interface ContentBlock {
  id: string;                  // UUID
  type: 'text' | 'image' | 'chart' | 'list';
  content: string;             // 文本内容 或 图片URL
  position?: { x: number; y: number; width: number; height: number; };  // 0-1 归一化坐标
  style?: {
    fontSize?: number;
    fontWeight?: 'normal' | 'bold';
    color?: string;            // HEX
    align?: 'left' | 'center' | 'right';
  };
  locked?: boolean;
}
```

**当前最大问题**：
1. AI 生成的 PPTJson 中 `content` 字段全是文本，很少有图片引用
2. `position` 坐标是 AI 猜测的（0-1 归一化），漂移严重
3. 没有生成讲稿备注
4. 生成的内容过于模板化（每页结构类似）

---

## 八、PPT 编辑能力现状

| 能力 | 状态 | 说明 |
|------|------|------|
| 页面大纲 | ✅ 真实 | OutlineTree 组件，显示所有页面标题 |
| 切换页面 | ✅ 真实 | 点击大纲切换 + 底部翻页按钮 |
| 添加页面 | ✅ 真实 | 工具栏"+添加"按钮 |
| 删除页面 | ✅ 真实 | 工具栏"删除当前页"（至少保留 1 页）|
| 调整页面顺序 | ✅ 真实 | OutlineTree 拖拽排序（@dnd-kit）|
| 编辑页面标题 | ✅ 真实 | SlideEditor 标题输入框 |
| 编辑核心结论 | ✅ 真实 | SlideEditor 结论输入框 |
| 编辑内容模块 | ✅ 真实 | 内容块列表（添加/编辑/删除文本块）|
| 编辑讲稿备注 | ❌ 没有 | 无此功能 |
| 自动保存 | ✅ 真实 | 2 秒防抖 → IndexedDB |
| 保存状态 | ⚠️ UI 不明确 | 无"已保存/保存中"指示器 |
| 撤销/重做 | ✅ 真实 | Ctrl+Z / Ctrl+Y（edit-patch 系统）|
| 画布编辑 | ⚠️ 部分可用 | ElementCanvas 能显示位置，拖拽不流畅 |
| 拖拽元素 | ⚠️ 部分可用 | 位置通过坐标修改，非自由拖拽 |
| 属性面板 | ⚠️ 只读 | 显示属性但不能修改 |
| 实时预览 | ⚠️ 预览模式 | 简单文字排版，非精确视觉预览 |

---

## 九、AI 配图能力现状

| 能力 | 状态 | 说明 |
|------|------|------|
| 有 AI 配图功能？ | ✅ 有 | Step4 和 Step5 都有入口 |
| 使用什么模型？ | GPT-Image-2 | 通过 Codesuc 中转 |
| 能否为单页生成？ | ✅ 能 | Step5 每页独立生图 |
| 编辑图片 prompt？ | ✅ 能 | 弹窗可编辑 Prompt 后重生成 |
| 替换当前页图片？ | ✅ 能 | 新图直接替换 |
| 保存生成图片？ | ⚠️ 内存中 | `slideImages: Record<number, string>` 存在 React state，刷新丢失 |
| 写入 PPTX？ | ❌ 不写入 | 图片 URL 不写入导出文件 |
| 失败重试？ | ❌ 无 | 失败只显示错误 Toast |
| 生成耗时？ | 5-15 秒/张 | 根据图片尺寸和复杂度波动 |
| 结果存在哪里？ | React state | `const [slideImages, setSlideImages] = useState<Record<number, string>>({})` |

---

## 十、PPTX/PDF 导出能力现状

| 能力 | 状态 | 说明 |
|------|------|------|
| 导出 PPTX？ | ✅ 能 | 通过 pptxgenjs |
| 导出 PDF？ | ❌ 不能 | 未实现。pdf-lib 已安装但不能将幻灯片内容转为 PDF 页 |
| 用什么库？ | pptxgenjs | 4.0.1 |
| 包含编辑后内容？ | ✅ 是 | 从 PPTJson.slides 读取 |
| 包含 AI 图片？ | ❌ 否 | AI 图片（GPT-Image-2 生成的 URL）不写入 PPTX |
| 保留参考风格？ | ⚠️ 仅颜色 | 只设置了文字颜色和背景色 |
| 支持多页？ | ✅ 是 | 逐页渲染 |
| 导出进度反馈？ | ✅ 有 | `onProgress(current, total)` → TopBar 显示 |
| 导出失败处理？ | ⚠️ 基本 | catch → Toast 错误提示，无重试 |
| 导出文件路径？ | 浏览器下载 | 不存服务器，直接 `blob → download` |
| 导出测试？ | ❌ 无 | |

---

## 十一、数据模型现状

所有核心类型在 `types/` 目录下：

### Project（核心项目）
```typescript
interface Project {
  id: string;
  title: string;
  status: 'draft' | 'analyzing' | 'generating' | 'completed';
  templateFileId?: string;
  styleKitId?: string;
  styleKitVersion?: number;
  styleKitSource?: 'uploaded-template' | 'library-selected' | 'ai-matched';
  styleConfig?: StyleConfig;       // 旧风格配置
  styleReport?: StyleReport;       // 分析报告
  userInput?: UserInput;           // 用户需求
  deckPlan?: DeckPlan;             // 大纲规划
  pptJson?: PPTJson;               // 完整 PPT 数据
  generationProgress?: GenerationProgress;
  imageCandidates?: ImageCandidate[];
  createdAt: number;
  updatedAt: number;
}
```

### Slide（幻灯片页面）
```typescript
interface Slide {
  id: string;
  layout: 'title' | 'content' | 'image' | 'chart' | 'quote';
  title: string;
  mainConclusion: string;
  content: ContentBlock[];
}
```

### ContentBlock（内容块）
```typescript
interface ContentBlock {
  id: string;
  type: 'text' | 'image' | 'chart' | 'list';
  content: string;
  position?: { x: number; y: number; width: number; height: number; };
  style?: { fontSize?: number; fontWeight?: 'normal' | 'bold'; color?: string; align?: 'left' | 'center' | 'right'; };
  locked?: boolean;
}
```

### StyleConfig（旧风格结构）
```typescript
interface StyleConfig {
  overallStyle: 'business' | 'tech' | 'creative' | 'academic';
  palette: { primary: string; secondary: string; accent: string; background: string; text: string; };
  typography: { titleFont: string; bodyFont: string; titleSize: number; bodySize: number; };
  layout: { type: 'single' | 'double' | 'full' | 'centered'; spacing: number; padding: number; };
  designPrinciples: string[];
}
```

### StyleKit（新风格结构）
```typescript
interface StyleKit {
  id: string;
  name: string;
  sourceFileId: string;
  styleDNA: StyleDNA;
  layoutPatterns: LayoutPattern[];
  scenarioAdapters: ScenarioAdapter[];
  slideRoleDefinitions: SlideRoleDefinition[];
  stats: { usageCount: number; successCount: number; lastUsedAt?: number; };
  createdAt: number;
  updatedAt: number;
}
```

### 缺失的结构
- ❌ 没有独立的 `ExportStatus` 类型
- ❌ 没有 `RewriteSuggestion` 类型（改写结果只是 patch 数组）
- ❌ 没有 `SlideStyle` 类型（样式混在 ContentBlock.style 中）
- ❌ 没有讲稿备注字段

---

## 十二、Mock 与真实功能边界

| 功能 | 前端状态 | 后端/API 状态 | 数据状态 | 当前问题 | 建议处理 |
|------|----------|---------------|----------|----------|----------|
| 首页展示 | ✅ 真实UI | N/A | 纯静态 | 右侧空半屏 | 加真实截图或去掉右半 |
| 上传 PPT | ✅ 真实UI | ✅ 真实API | 真实 | 无拖拽 | 加拖拽区 |
| 风格分析 | ✅ 真实UI | ✅ 真实API | 真实 AI | 慢、易超时 | 加超时提示 + 回退 |
| 封面预览 | ✅ 真实UI | ✅ 真实API | 真实 AI | GPT-Image-2 延迟 | — |
| 需求输入 | ✅ 真实UI | N/A | 纯前端 | 字段太多 | 折叠高级选项 |
| 内容生成 | ✅ 真实UI | ✅ 真实API | 真实 AI | DeepSeek 输出不稳定 | 加 schema 校验 |
| 大纲显示 | ✅ 真实UI | N/A | 真实 | — | — |
| 单页编辑 | ✅ 真实UI | N/A | 真实（store） | 无讲稿备注 | 加备注字段 |
| 画布编辑 | ⚠️ UI半成品 | N/A | 真实（只读） | 拖拽不完整 | 用第三方库或砍掉 |
| 属性面板 | ⚠️ UI半成品 | N/A | 真实（只读） | 不可编辑 | 砍掉或改用简单 UI |
| AI 改写 | ⚠️ UI半成品 | ✅ 真实API | 真实 AI | 输出不稳定 | 加强 schema |
| AI 配图 | ✅ 真实UI | ✅ 真实API | 真实 AI | 不进 PPTX | 加 base64 写入 |
| PPTX 导出 | ✅ 真实UI | N/A | 真实 | 风格丢失 | 加强 pptxgenjs 渲染 |
| PDF 导出 | ❌ 没有 | ❌ 没有 | — | 未实现 | pdf-lib 集成 |
| 项目列表 | ✅ 真实UI | N/A | IndexedDB | — | 加远程存储 |
| 项目持久化 | N/A | N/A | IndexedDB | 浏览器本地，不跨设备 | 加远程 API |
| 设置页 | ❌ 没有 | ❌ 没有 | — | 未实现 | 按需建设 |

---

## 十三、测试情况

| 项目 | 结果 |
|------|------|
| 单元测试 | ✅ 13 个文件 |
| 集成测试 | ❌ 没有（无跨组件测试）|
| 端到端测试 | ❌ 没有 |
| 最近测试结果 | 8 suites / 125 tests ✅ 全部通过 |
| 测试失败 | 无 |
| 未覆盖流程 | 风格分析 → 内容生成 → 导出的完整链路 |
| 如何运行 | `pnpm test`（Jest）|
| 代码 build | `pnpm build` ✅ 19 路由成功 |
| 本地启动 | `pnpm dev` ✅ |
| Lint | ⚠️ 31 errors（`@typescript-eslint/no-explicit-any`）+ 75 warnings |
| TypeScript | `tsc --noEmit` ✅ 零错误 |

---

## 十四、已知问题和技术债

### P0：阻塞完整流程运行

| 问题 | 涉及文件 | 影响范围 | 推荐修复 |
|------|----------|----------|----------|
| API 调用无本地 mock fallback | `lib/api-client.ts` | 全部 AI 功能 | 为每个 AI 调用加 mock 模式（环境变量控制）|
| DeepSeek 输出格式不稳定 | `lib/claude.ts` | PPT 内容生成 | 更严格的 Zod schema + 重试后 fallback 到 MiniMax |

### P1：影响主要体验

| 问题 | 涉及文件 | 影响范围 | 推荐修复 |
|------|----------|----------|----------|
| StyleConfig / StyleKit 双系统 | `lib/style-bridge.ts` + 多处 | 代码复杂度 | 统一为 StyleKit，废弃 StyleConfig |
| AI 图片不写入 PPTX | `components/GenerateStep.tsx` + `lib/export-pptx.ts` | PPTX 导出 | 导出时将图片 URL 转 base64 写入 |
| 风格继承只到颜色层 | `lib/export-pptx.ts` | PPT 风格还原 | 加强 pptxgenjs 渲染（字体/布局）|
| 风格提取超时（>30 页 PPT） | `app/api/style-kit/extract/route.ts` | 大模板分析 | 加超时阈值 + 分页提取 |
| 画布/属性面板半成品 | `ElementCanvas.tsx` + `PropertyPanel.tsx` | 用户体验 | 砍掉或投入资源重做 |

### P2：影响质量但不阻塞

| 问题 | 涉及文件 | 影响范围 |
|------|----------|----------|
| StepIndicator 不能点击跳回已完成步骤 | `app/create/page.tsx` | 导航体验 |
| 首页 Hero 右侧空白 | `app/page.tsx` | 视觉 |
| 无讲稿备注 | `types/project.ts` | 功能缺失 |
| 移动端 Step3 表单拥挤 | `EnhancedRequirementsForm.tsx` | 移动端支持 |
| 上传无拖拽 | `app/create/page.tsx` | 用户体验 |

### P3：后续优化

- `uploads/` 目录无自动清理
- 无 API 速率限制
- 无用户鉴权
- 无 Cost/Tokengo 跟踪
- 项目列表无远程存储

---

## 十五、与目标产品的差距

目标流程：首页 → 创建 → Step1 上传 → Step2 分析 → Step3 需求 → Step4 编辑(含画布/AI改写/属性) → Step5 导出 → 项目页 → 设置页

| 目标功能 | 当前状态 | 实现位置 | 差距 | 优先级 |
|----------|----------|----------|------|--------|
| 首页 | ✅ 有 | `/` | 右侧空白，缺少展示 | P2 |
| 创建五步流程 | ✅ 有 | `/create` | StepIndicator 不可点击跳回 | P2 |
| 上传参考 PPT | ✅ 有 | Step1 | 无拖拽，无模板预览 | P2 |
| 风格分析 | ✅ 有 | Step2 / `/api/style-kit/*` | 耗时较长，字体猜测不准 | P1 |
| 封面风格预览 | ✅ 有 | StyleKitReport.tsx | — | — |
| 需求输入 | ✅ 有 | Step3 | 字段太多，无分组 | P2 |
| AI Prompt 预览与编辑 | ✅ 有 | Step3（新增） | 预览功能简单，只是文本 | P2 |
| 生成 slides | ✅ 有 | 后端 Pipelines | 输出不稳定，需要重试 | P1 |
| 页面大纲 | ✅ 有 | OutlineTree | — | — |
| 单页内容编辑 | ✅ 有 | SlideEditor | 缺少讲稿备注 | P1 |
| 讲稿备注 | ❌ 无 | — | 完全缺失 | P2 |
| 画布视图 | ⚠️ 半成品 | ElementCanvas | 拖拽能力弱 | P2 |
| AI 改写 | ⚠️ 部分 | AiEditPanel | 无语气模式 | P1 |
| 属性设置 | ⚠️ 只读 | PropertyPanel | 不可编辑 | P2 |
| AI 配图 | ✅ 有 | GPT-Image-2 | 不写入 PPTX | P1 |
| 导出 PPTX | ✅ 有 | pptxgenjs | 风格丢失 | P1 |
| 导出 PDF | ❌ 无 | — | 完全缺失 | P2 |
| 项目列表 | ✅ 有 | `/projects` | 本地存储，不跨设备 | P1 |
| 设置页 | ❌ 无 | — | 完全缺失 | P3 |
| 本地保存/持久化 | ✅ 有 | IndexedDB | 不跨设备，无远程存储 | P1 |

---

## 十六、改造建议

### 基本原则
1. **不要推倒重来** — 前端 5 步流程 + 后端 API Routes + IndexedDB 存储都是可用的
2. **先保证完整流程跑通** — 当前流程有 AI 调用失败风险，需要 mock fallback
3. **再替换 mock 为真实接口** — 当前没有 mock，需要加
4. **前端结构预留 AI 能力接口** — API 调用已封装在 `lib/api-client.ts`

### Phase 1：基础稳定（1-2 天）
1. 为所有 AI 调用加 mock fallback（环境变量 `AI_MOCK=true` 时返回预设数据）
2. DeepSeek 输出失败时自动回退到 MiniMax
3. 为 `/api/style-kit/extract` 加大文件超时保护（>15 页分页）

### Phase 2：项目模型统一（0.5 天）
4. 废弃 StyleConfig，全局使用 StyleKit
5. 删掉 `lib/style-bridge.ts` 和所有 `styleKit || styleConfig` 判断
6. 统一 `types/` 的导入路径

### Phase 3：Step1-Step3 体验提升（1 天）
7. Step1 加拖拽上传 + 模板预览
8. Step2 加分析进度毛玻璃效果
9. Step3 表单字段折叠（高级选项默认收起）

### Phase 4：编辑器整合（1-2 天）
10. 砍掉 ElementCanvas + PropertyPanel（半成品，拖拽成本太高），默认只用内容模式
11. 加讲稿备注编辑
12. AI 改写加语气模式选择（专业/简洁/说服力/答辩）
13. AiEditPanel 和 PropertyPanel 合并或明确分工

### Phase 5：导出升级（1 天）
14. AI 图片写入 PPTX：生图时下载 URL 转 base64，导出时嵌入
15. 加强 pptxgenjs 字体渲染（用通用字体替代 TTF 引用）

### Phase 6：远程存储（2 天）
16. 加远程 API（最简单的方案：加一个 JSON 文件存储服务）
17. 项目列表支持远程查询/同步

### Phase 7：测试（持续）
18. 加风格分析 → 内容生成 → 导出的集成测试
19. 加 mock 模式的端到端测试

---

## 十七、执行摘要

### 1. 完成度

**总体约 65%**。拆分如下：
- 前端 UI 框架：85%（5 步流程完整，组件体系健全）
- 后端 API：80%（19 条 API 路由，全部真实可用）
- 风格分析：60%（能分析颜色/字体/布局，但字体猜不准，布局继承有限）
- 内容生成：70%（能生成结构化 JSON，但输出不稳定，效果中庸）
- 编辑器：40%（大纲+内容编辑好用，画布和属性是半成品）
- AI 配图：80%（能生图，但不写入 PPTX）
- PPTX 导出：40%（能导出，但风格继承差，不含 AI 图）
- 数据持久化：50%（IndexedDB 稳定但不跨设备）
- 测试：30%（只有单元测试，无集成/E2E）

### 2. 最应该先修的

**P0-P1 中的三件事**：
1. **AI 调用加 mock fallback** — 当前所有 AI 功能直接依赖 API key，网络不通全挂
2. **AI 图片写入 PPTX** — 配图功能不写入导出等于白做
3. **StyleConfig/StyleKit 统一** — 双系统混用导致新功能开发效率低

### 3. 最适合复用的

- **5 步流程前端框架**（`app/create/page.tsx` + 状态机）
- **AI API 客户端封装**（`lib/api-client.ts` — 统一 retry/error/fallback）
- **PPT 解析**（`lib/pptx-parser.ts` — 能解析颜色/字体/文本）
- **Edit-Patch 系统**（`lib/edit-patch.ts` + `lib/edit-history.ts` — 撤销/重做/版本历史）
- **IndexedDB 持久化**（`lib/db.ts` — 项目 CRUD + 版本历史）
- **PPTX 导出**（`lib/export-pptx.ts` — 框架正确，需增强渲染细节）

### 4. 最不应该继续扩展的

- **ElementCanvas（画布编辑器）** — 当前实现太弱，要做成真正的拖拽编辑器成本极高（类似 Fabric.js 或 Konva）。建议砍掉，只保留内容编辑模式
- **PropertyPanel（属性面板）** — 只读属性无价值。要么做成可编辑的颜色/字体选择器，要么删掉
- **AiEditPanel** — 和 PropertyPanel 功能重叠，要么合并要么明确分工

### 5. 下一步最小可交付目标

**让新人上传一个 PPT → 分析风格 → 输入主题 → 编辑 → 导出带风格的 PPTX，完整流程 10 分钟内跑通，失败时有友好提示。**

需要做的：
1. ✅ 加 AI mock fallback（已分析，未实现）
2. ✅ AI 图片写入 PPTX（已分析，未实现）
3. ✅ 统一 StyleKit/StyleConfig（已分析，未实现）
4. ⏩ Step1 拖拽上传（可选）
5. ⏩ Step3 表单折叠（可选）

**核心原则：先保证 100% 稳定跑通，再追求体验提升。**
