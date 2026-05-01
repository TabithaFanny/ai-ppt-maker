# AI PPT Generator — 第二阶段交付报告（SECOND STAGE DELIVERY REPORT）

> **报告日期**：2026-05-01  
> **Commit**：`d870035`  
> **分支**：`main`  
> **项目版本**：0.1.0 (Next.js 16 + React 19 + TanStack + Dexie)

---

## 一、交付结论

### ✅ 第二阶段完成，可进入下一阶段

本阶段完成了 P0–P3 前端重构（共 8 项）及 TODO-5 AI 模型分层（共 4 项变更），具体见第二章。所有变更均通过以下门控：

| 检查项 | 结果 |
|--------|------|
| `tsc --noEmit` | ✅ 零错误 |
| `pnpm build` | ✅ 19 条路由全部生成 |
| `pnpm test` | ✅ 8 suites / 125 tests 全部通过 |

### ⚠️ GitHub push 因网络超时暂未完成

- 本地 commit `d870035` 已完成 ✅
- push 到远程 `origin/main` 时因公司网络（`github.com:443` 超时）中断
- **这不是代码丢失或提交失败**，只是推送未完成
- 切换到家庭网络或其他网络后执行 `git push origin main` 即可恢复

---

## 二、本次完成

| 编号 | 任务 | 优先级 | 文件 | 变更 |
|------|------|--------|------|------|
| ① | 首页三步→五步流程修正 | P0-5 | `app/page.tsx` | 三步文案改为五步布局 |
| ② | Step2 封面样张预览 | P0-3 | `components/style-kit/StyleKitReport.tsx` | ✅ 已完成（GPT-Image-2 + 弹窗确认）|
| ③ | Step3 AI Prompt 预览 | P0-4 | `components/EnhancedRequirementsForm.tsx` | 表单底部实时更新 AI 理解 |
| ④ | EditStep 拆分 + 响应式 | P0-1 / P0-2 | `components/EditStep.tsx` + `EditStepToolbar.tsx` | 634→250 行，Toolbar 独立 |
| ⑤ | Step5 批量 AI 生图 | P1-3 | `components/GenerateStep.tsx` | TopBar 新增按钮，逐页生成 |
| ⑥ | 首页移除假数据 DemoShowcase | P1-4 | `app/page.tsx` | 整体移除 |
| ⑦ | 删除 /analyze 重复入口 | P2-1 | `app/analyze/page.tsx`（已删除） | 路由消失 |
| ⑧ | Projects 页面搜索筛选 | P2-2 | `app/projects/page.tsx` | 搜索框 + 状态过滤器 |
| ⑨ | AI 模型分层 — DeepSeek v4-pro 接入 | TODO-5 | `lib/api-client.ts` | 新增 `deepseekChat()` / `routeChat()` |
| ⑩ |风格蒸馏路由切换 | TODO-5 | `app/api/style-kit/distill/route.ts` | MiniMax → DeepSeek |
| ⑪ |需求转译切换 | TODO-5 | `lib/claude.ts:translateRequirements` | MiniMax → DeepSeek |
| ⑫ |内容 JSON 生成切换 | TODO-5 | `lib/claude.ts:generatePPTJson` | MiniMax → DeepSeek |
| ⑬ |大纲规划切换 | TODO-5 | `lib/claude.ts:generateDeckPlan` | MiniMax → DeepSeek |

### 合计变更统计

```
10 files changed, 832 insertions(+), 1216 deletions(-)
```

---

## 三、模型调用现状

> 所有推理任务不直接修改 PPTX、不直接输出整页 SVG。所有输出必须经过 `validateAIOutput(schema, data)` 校验。

```
┌─────────────────────────────────────────────────────────┐
│                   模型调用链路                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  视觉分析（多模态）                                       │
│  ├─ 风格提取 extract ──────────────── MiniMax M2.7       │
│  └─ 逆向视觉 prompt ──────────────── MiniMax M2.7        │
│                                                         │
│  深度推理（纯文本）                                       │
│  ├─ 风格蒸馏 distill ─────────────── DeepSeek v4-pro ◄──│
│  ├─ 需求转译 translateRequirements ─ DeepSeek v4-pro ◄──│
│  ├─ JSON 生成 generatePPTJson ────── DeepSeek v4-pro ◄──│
│  ├─ DeckPlan 规划 generateDeckPlan ── DeepSeek v4-pro ◄──│
│  └─ 编辑 Patch 生成 ──────────────── MiniMax M2.7        │
│                                                         │
│  图像生成                                                │
│  ├─ AI 配图 ──────────────────────── GPT-Image-2         │
│  ├─ 封面预览 ─────────────────────── GPT-Image-2         │
│  └─ 单页/批量生图 ────────────────── GPT-Image-2         │
│                                                         │
│  输出校验                                                │
│  └─ validateAIOutput(schema, data) ── Zod schema         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 模型分配原则

| 模型 | 适用任务 | 原因 |
|------|----------|------|
| **MiniMax M2.7** | 视觉分析、编辑 Patch | 多模态支持 + 速度快 |
| **DeepSeek v4-pro** | 风格蒸馏、需求理解、结构化生成 | 深度推理能力更强 |
| **GPT-Image-2** | 所有图像生成 | 唯一图像生成接口 |

---

## 四、架构变更

### 4.1 模型客户端统一

```
lib/api-client.ts（统一 API 客户端）
  ├─ chatCompletion() / visionCompletion() → MiniMax（轻量/视觉）
  ├─ deepseekChat()                        → DeepSeek（深度推理）
  └─ routeChat(messages, difficulty)        → 智能路由（根据 difficulty 切换）
```

`routeChat(messages, 'light')` → MiniMax  
`routeChat(messages, 'deep')` → DeepSeek with `reasoning_effort: 'high'`

### 4.2 主处理链路

```
上传模板（PDF/PPT/PPTX）
    ↓
StyleKit 风格提取（extract, MiniMax 多模态）
    ↓
StyleKit 风格蒸馏（distill, DeepSeek）
    └─→ 生成 StyleKit JSON（含 styleDNA, layoutPatterns, scenarioAdapters）
    ↓
DeckPlan 内容规划（generateDeckPlan, DeepSeek）
    └─→ 生成 DeckPlan JSON（slidePlans: [{role, title, mainConclusion, contentOutline}]）
    ↓
LayoutPlan 布局规划（布局引擎）
    └─→ layout 决策（基于 styleKit.layoutPatterns + slidePlans[].layoutHint）
    ↓
RenderSpec 渲染规格（buildRenderSpec）
    └─→ 标准化的渲染规范（含 slide role、元素坐标、背景色）
    ↓
EditPatch 编辑补丁（createUpdateTextPatch, createMovePatch 等）
    └─→ 可撤销的原子操作（undo/redo 支持）
    ↓
AutoFix / Validator（autoFixSlideRealtime, ResidualValidator）
    └─→ 实时越界修复 + 上线前残留检查
    ↓
PPTX 导出（exportRenderSpecToPPTX）
    └─→ pptxgenjs → .pptx 文件
```

### 4.3 每层职责

| 层 | 职责 | 输出格式 | 校验 |
|----|------|----------|------|
| **StyleKit** | 提取+蒸馏模板视觉 DNA | `StyleKit` JSON | `DistillStyleKitResponseSchema` |
| **DeckPlan** | 规划每页角色和内容大纲 | `DeckPlan` JSON | `DeckPlanSchema` |
| **LayoutPlan** | 基于 role + pattern 分配布局 | `LayoutPlan` JSON | 引擎内部校验 |
| **RenderSpec** | 标准化渲染描述 | `RenderSpec` JSON | `Zod schema` |
| **EditPatch** | 原子编辑操作 | `EditPatch` JSON | `edit-patch` types |
| **AutoFix** | 运行时越界/空标题修复 | 直接修改 `Slide` | TypeScript 类型 |
| **Validator** | 上线前残留检查 | `ValidationIssue[]` | 无 |

---

## 五、测试状态

```
$ pnpm test
──────────────────────────────────────────────────
  PASS  __tests__/render-style.test.ts
  PASS  __tests__/edit-patch-prompt.test.ts
  PASS  __tests__/edit-history.test.ts
  PASS  __tests__/edit-patch.test.ts
  PASS  __tests__/style-bridge.test.ts
  PASS  __tests__/slide-arithmetic.test.ts
  PASS  __tests__/prompt-bridge.test.ts
  PASS  __tests__/pipeline.test.ts

  Test Suites: 8 passed, 8 total
  Tests:       125 passed, 125 total
  Time:        0.263 s

$ npx tsc --noEmit
  (no output — zero errors)

$ pnpm build
  ✓ Compiled successfully in 1540ms
  ✓ Generating static pages using 9 workers (21/21) in 100ms

  Routes (19):
    ○ /_not-found
    ○ /create
    ○ /projects
    ƒ /api/analyze
    ƒ /api/distill-template-prompt
    ƒ /api/edit-patch
    ƒ /api/extract-assets
    ƒ /api/extract-slide-images
    ƒ /api/generate-image
    ƒ /api/generate-ppt
    ƒ /api/generate-slide-image
    ƒ /api/generate-stream
    ƒ /api/reverse-visual-prompt
    ƒ /api/style-kit/distill
    ƒ /api/style-kit/extract
    ƒ /api/style-kit/jobs
    ƒ /api/upload
    ƒ /api/verify-residual
```

（`/analyze` 页面路由已删除，确认消失）

---

## 六、代码状态

| 项目 | 状态 |
|------|------|
| **本地 commit** | ✅ `d870035` — `feat: TODO-5 AI模型分层 — DeepSeek v4-pro接入` |
| **父 commit** | `ccbbc64` — `refactor: P0-P3 前端重构` |
| **远程推送** | ⚠️ 因公司网络 `github.com:443` 超时，push 未完成 |
| **恢复方法** | 切换网络后执行 `git push origin main` 即可 |
| **分支** | `main`（自 `2b51f5c` Initial commit 以来的第三次提交） |
| **工作目录** | `git status` — 干净（无未跟踪文件） |

### Git 历史

```
d870035 feat: TODO-5 AI模型分层 — DeepSeek v4-pro接入
ccbbc64 refactor: P0-P3 前端重构
93c6fd8 feat: Phase 1-13 全量交付
2b51f5c Initial commit from Create Next App
```

### 关于 push 失败的补充说明

- GitHub push 使用的是 HTTPS + Personal Access Token
- 公司网络（可能）阻止出站 443 到 `github.com`
- **这不是代码丢失、不是提交失败、不是 Git 仓库损坏**
- 切换到家庭网络后，一条命令即可恢复

---

## 七、当前限制

### 可用性限制

| 限制 | 说明 |
|------|------|
| **小范围试用** | 建议在开发团队或熟人范围内测试，不建议公开上线 |
| **PPTX 兼容性** | 复杂模板（嵌套母版、动画、图表数据联动）可能丢失 |
| **模板复杂度阈值** | 超过 30+ 页的大模板分析耗时 ≥ 60s，超时风险 |
| **无用户系统** | 无登录、无鉴权，多用户同机使用会冲突 |
| **无速率限制** | 本地/演示阶段可接受，公开部署需要加限流 |

### 未完成功能

| 功能 | 原因 |
|------|------|
| **DreamKit**：风格→生图语言中间层 | 未实现，仅完成设计文档方向确认 |
| **TODO-4**：Step4 逐页生图预览 | 未开始 |
| **AI 自动补全幻灯片内容** | 仅支持编辑，不支持从空白 AI 生成内容块 |
| **多语言导出** | 仅支持中文 |
| **批量项目操作** | 仅支持逐项删除/复制 |

### 已知技术债务

| 债务 | 影响 | 优先级 |
|------|------|--------|
| StyleConfig / StyleKit 双类型系统 | 代码中 `styleKit \|\| styleConfig` 到处是 | P1 |
| EditStep 虽已拆分但仍为单一状态容器 | 子组件之间通过 store 通讯，不够解耦 | P2 |
| 首页 Hero 右侧空白 | 移除 DemoShowcase 后右侧空出半屏 | P2 |
| `uploads/` 目录无自动清理 | 长期运行磁盘膨胀 | P3 |

---

## 八、下一步建议

### P0：修复 GitHub push（立即）

```bash
cd /Users/magnus/code/ai-ppt-generator
git push origin main
```

- 建议到家后或切换手机热点后执行
- 不需要 amend 或 rebase

### P1：TODO-4 — Step4 逐页生图预览

- **目标**：在 EditStep 编辑区增加"预览本页"按钮，点击后 10 秒内返回 AI 生成的当前页预览图
- **约束**：
  - ❌ 不能绕过 RenderSpec（所有预览必须经过 render spec）
  - ❌ 生图预览不能替代可编辑 PPTX（预览≠最终输出）
  - ✅ 逐页生图失败不能阻断主流程（失败后用户仍可导出）
- **涉及文件**：`components/EditStep.tsx`、`components/SlidePreview.tsx`
- **预估工作量**：0.5–1 天

### P2：DreamKit 架构设计

- **第一步**：先写 `DREAMKIT_SPEC.md`（设计方案文档），不要直接大规模实现
- **DreamKit 定位**：风格理解 → 结构化"生图语言"的中间层，不是简单的 prompt 拼接
- **输出格式示例**：
  ```json
  {
    "visualLanguage": "商务蓝调+几何极简",
    "imagePromptTemplates": {
      "cover": "极简商务风封面，蓝色渐变背景...",
      "content": "简洁内容页，白色为主，左侧标题区...",
      "data": "数据展示页，图表区清晰分割..."
    },
    "keywordsForImageGen": ["geometric", "minimal", "blue accent"]
  }
  ```
- **关键约束**：
  - ❌ 不能只是 prompt 字符串 — 必须有结构化中间层
  - ❌ 不能替代 RenderSpec — DreamKit 是图片层，RenderSpec 是布局层
  - ✅ AI 输出仍需 `validateAIOutput()` schema 校验

---

## 九、风险与注意事项

### TODO-4（逐页生图预览）

| 风险 | 缓解措施 |
|------|----------|
| 预览图绕过 RenderSpec | 所有预览必须经过 `buildRenderSpec()` 生成 |
| 预览图被用户误当最终输出 | UI 上明确标注"预览图，非最终输出" |
| 生图耗时 > 10s 用户体验差 | 显示加载状态 + 允许跳过 |
| 某页生图失败阻塞流程 | 失败后跳过，仅 toast 提示，不影响导出 |

### DreamKit（风格→生图语言）

| 风险 | 缓解措施 |
|------|----------|
| 变成纯 prompt 拼接 | 必须有结构化 JSON 输出，含 `visualLanguage` / `imagePromptTemplates` / `keywordsForImageGen` |
| AI 输出偏离预期 | 用 Zod schema 严格校验 DreamKit 输出 |
| 与现有 StyleKit 冲突 | DreamKit 作为 StyleKit 的扩展字段，不替换现有结构 |
| 过度设计 | 先用 `DREAMKIT_SPEC.md` 设计，再分阶段实现 |

### 通用风险

| 风险 | 缓解措施 |
|------|----------|
| DeepSeek API 不可用 | 调用 `deepseekChat` 失败时回退到 `chatCompletion`（MiniMax） |
| GPT-Image-2 API 不可用 | 显示"图片生成暂不可用"，不影响 PPTX 导出 |
| AI 输出 schema 校验失败 | 重试机制（`withRetry` 最多 3 次）+ 用户可见错误提示 |

---

## 十、下一步执行确认

当前本地状态全绿，你 review 后告诉我：

1. **是否先修复 GitHub push**（切换网络后执行）
2. **是否继续 TODO-4**（Step4 逐页生图预览）
3. **是否开始写 DREAMKIT_SPEC.md**

我可以直接继续推进。
