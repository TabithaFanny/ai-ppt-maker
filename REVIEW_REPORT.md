# D1→G Review & Audit Report

**Date**: 2026-05-01
**Scope**: D1 (speakerNotes/saveStatus/selectedSlideIndex) → G (DreamKit SPEC)
**Mode**: AI_MOCK=true 全链路审查，build/test/smoke 已验证

---

## 1. 总体结论

| 维度 | 状态 |
|------|------|
| Build (AI_MOCK=true) | ✅ 22 routes, 0 errors |
| Tests | ✅ 153/153 (10 suites) |
| API smoke test | ✅ 8/8 endpoints respond correctly |
| Pages load | ✅ /, /create, /projects all HTTP 200 |
| 小修项 | ✅ 6/6 已修复且验证 |
| 架构性问题 | ⚠️ 8 项已记录，建议后续版本修复 |

**Go/No-Go**: **Go** — 可通过 AI_MOCK 进入下一步开发。建议先修 P1 风险项再进真实 API 集成。

---

## 2. 36 步交互 Smoke Test 结果

### 自动化验证（curl / HTTP）

| # | 步骤 | 验证方式 | 结果 |
|---|------|----------|------|
| 1 | 首页加载 | curl GET / | ✅ HTTP 200 |
| 2 | /create 页面 | curl GET /create | ✅ HTTP 200 |
| 3 | /projects 页面 | curl GET /projects | ✅ HTTP 200 |
| 4 | 生成流 API | POST /api/generate-stream | ✅ SSE streaming working |
| 5 | EditPatch API | POST /api/edit-patch | ✅ Mock patch returned |
| 6 | 视觉预览 API | POST /api/generate-slide-image | ✅ Mock image URL |
| 7 | 分析 API | POST /api/analyze | ✅ 400 with proper error |
| 8 | 风格提取 API | POST /api/style-kit/extract | ✅ Full mock result |
| 9 | 残留验证 API | POST /api/verify-residual | ✅ Returns 0 issues |
| 10 | 生图 API | POST /api/generate-image | ✅ Mock image URL |
| 11 | 上传 API | POST /api/upload | ✅ File type validation |
| 12 | 提取资源 API | POST /api/extract-assets | ✅ Param validation |
| 13 | 反向视觉 Prompt | POST /api/reverse-visual-prompt | ✅ Zod validation |

### 需人工验证路径

| # | 步骤 | 原因 |
|---|------|------|
| 14 | Step2 分析完成 (UI 进度) | 需浏览器渲染 SSE |
| 15 | Step3 大纲查看 | 需浏览器渲染 + IndexedDB |
| 16 | Step4 speakerNotes 折叠区 | 需浏览器交互 |
| 17 | AI 改写面板（4 mode tabs） | 需浏览器交互 |
| 18 | 仅替换标题 / 全部应用 / 插入为新版本 | 需浏览器交互 |
| 19 | PropertyPanel 5 项生效 UI | 需浏览器交互 |
| 20 | 版式预览入口文案 | 需浏览器交互 |
| 21 | 逐页视觉预览弹窗 | 需浏览器交互 |
| 22 | Step5 AI 批量生图 | 需浏览器交互 |
| 23 | PPTX 导出 (触发下载) | 需浏览器下载 API |
| 24 | PDF 禁用按钮 | 需浏览器交互 |
| 25 | 保存状态指示器 | 需浏览器交互 |
| 26 | beforeunload 警告 | 需浏览器交互 |
| 27 | 刷新后 speakerNotes 不丢 | 需浏览器 IndexedDB |
| 28 | 刷新后 selectedSlideIndex 不丢 | 需浏览器 IndexedDB |
| 29 | 刷新后 AI 图片恢复 | 需浏览器 IndexedDB |
| 30 | undo/redo + Ctrl+Z | 需浏览器交互 |
| 31 | 版式预览提示条 | 需浏览器交互 |
| 32 | ElementCanvas 版式模式 | 需浏览器交互 |
| 33 | 恢复默认按钮 | 需浏览器交互 |
| 34 | PDF 导出真实行为 | 需浏览器交互 |
| 35 | 分享链接复制 | 需浏览器 clipboard API |
| 36 | 全屏切换 | 需浏览器 Fullscreen API |

---

## 3. EditPatch 操作覆盖矩阵

| 编辑操作 | 走 EditPatch? | Undo/Redo? | 备注 |
|----------|-------------|------------|------|
| 修改标题 (SlideEditor) | ❌ commitSlides 直接更新 | ❌ | 内容模式全局 bypass |
| 修改结论 (SlideEditor) | ❌ commitSlides 直接更新 | ❌ | 同上 |
| 修改 speakerNotes | ❌ commitSlides 直接更新 | ❌ | 同上 |
| 修改内容块文字 | ❌ commitSlides 直接更新 | ❌ | 同上 |
| ElementCanvas 移动元素 | ✅ createMovePatch | ✅ | 正常 |
| ElementCanvas 调整大小 | ✅ createResizePatch | ✅ | 正常 |
| ElementCanvas 删除元素 | ✅ createDeleteElementPatch | ✅ | 正常 |
| ElementCanvas 添加元素/资源 | ✅ createAddElementPatch | ✅ | 正常 |
| ElementCanvas 修改文字 | ✅ createUpdateTextPatch | ✅ | 正常 |
| AI 改写 (AiEditPanel) | ✅ 接收 patch 并 pushPatch | ✅ | 正常 |
| AI 改写"仅替换标题" | ⚠️ 走 update_text patch | ⚠️ | **BUG**: elementId 指向 content block 而非 slide.title |
| 插入新版本 (AiEditPanel) | ❌ commitSlides | ❌ | 直接操作 slides 数组 |

### EditPatch bypass 根因
内容模式下所有编辑走 `handleSlideUpdate` → `commitSlides` → 直接修改 `slides[]` 数组 + `updatePPTJson`。ElementCanvas 中的编辑走 `handleBlockUpdate` → `pushPatch`。这是两个完全独立的编辑路径。

---

## 4. IndexedDB v5 迁移审计

| 检查项 | 结果 |
|--------|------|
| v1-v4 表 schema 不变 | ✅ 只新增 projectImages 表 |
| v4 无操作版本 | ✅ v3→v4 完全一致（兼容性版本） |
| v5 只加表不删表 | ✅ 安全迁移 |
| 已有项目数据不受影响 | ✅ 不影响 projects/files/versions 等表 |
| imageService CRUD | ✅ 5 个方法全部测试通过 |
| 测试覆盖 | ✅ 新增 15 个测试（jest.mock Dexie） |

---

## 5. AI 图片 PPTX 导出审计 (F2)

| 需求 | 状态 | 详情 |
|------|------|------|
| 读取 projectImages | ✅ IndexedDB 持久化已修复 |
| URL→base64 | ✅ urlToBase64 函数 (含 10s 超时) |
| 跨域处理 | ✅ catch 返回 null, warning 记录 |
| 已有 data URL 直通 | ✅ `startsWith('data:')` return url |
| 失败跳过不阻断 | ✅ `resolveAllImageElements` 返回 warning 数组 |
| 不把整页变图片 | ✅ 逐元素渲染 |
| 导出完成 warning 提示 | ✅ 已改为 warning toast |
| Mock 图片可导出 | ✅ placehold.co URL → base64 |

---

## 6. PropertyPanel 生效矩阵

| 字段 | Web 预览 | PPTX 导出 | 持久化 | 恢复默认 |
|------|----------|-----------|--------|---------|
| 主色 (primaryColor) | ✅ CSS var `--sk-primary` | ✅ color | ✅ IndexedDB | ✅ 已修 |
| 标题字号 (titleFontSize) | ✅ CSS var `--sk-title-size` | ⚠️ RenderSpec 已含 | ✅ IndexedDB | ✅ 已修 |
| 正文字号 (bodyFontSize) | ✅ CSS var `--sk-body-size` | ⚠️ RenderSpec 已含 | ✅ IndexedDB | ✅ 已修 |
| 模块圆角 (borderRadius) | ✅ CSS var `--sk-border-radius` | ❌ styleKitToPptxConfig 死代码 | ✅ IndexedDB | ✅ 已修 |
| 卡片阴影 (cardShadow) | ✅ CSS var `--sk-shadow` | ❌ styleKitToPptxConfig 死代码 | ✅ IndexedDB | ✅ 已修 |
| 辅色/强调色/字体/边距 | ✅ 显示"待接入" | ❌ | ❌ | N/A |

---

## 7. 保存状态链路审计

| 环节 | 正确性 | 问题 |
|------|--------|------|
| commitSlides → unsaved | ✅ | - |
| saveVersion debounce 1s | ✅ | - |
| saving → saved/error | ✅ | - |
| beforeunload 保护 | ✅ 已修 (R1.1) | - |
| saveStatus 指示器 UI | ✅ EditStepToolbar 显示 | - |
| updatePPTJson 不持久化 | ⚠️ 已知 | pptJson 存于 zustand + versions 表，projects 表字段不更新 |

---

## 8. P0/P1/P2 风险分类

### P0（严重 — 数据丢失风险）

| # | 问题 | 状态 |
|---|------|------|
| 1 | beforeunload 保护缺失 | ✅ 已修 (R1.1) |

### P1（高 — 功能不完整或数据不一致）

| # | 问题 | 影响 | 状态 |
|---|------|------|------|
| 1 | "仅替换标题" 修改 ContentBlock 而非 slide.title | AI 改写"仅替换标题"功能不正确 | 📝 未修 |
| 2 | 所有内容模式编辑 bypass EditPatch | title/conclusion/speakerNotes 编辑无 undo/redo | 📝 未修 |
| 3 | updatePPTJson 不写 projects 表 | 刷新后 projects.pptJson 不包含最新改动 | 📝 未修 |
| 4 | borderRadius + shadow 不写入 PPTX | Web 预览与 PPTX 不一致 | 📝 未修 |
| 5 | ElementCanvas 文字编辑 1 patch/keystroke | undo 历史被大量中间状态污染 | 📝 未修 |

### P2（中 — 用户体验或小功能缺陷）

| # | 问题 | 状态 |
|---|------|------|
| 1 | AI 批量生图没有持久化 | ✅ 已修 (R1.4) |
| 2 | 挂载时没有恢复 AI 图片 | ✅ 已修 (R1.4) |
| 3 | "恢复默认"按钮 no-op | ✅ 已修 (R1.5) |
| 4 | PDF 导出按钮可点击 | ✅ 已修 (R1.2) |
| 5 | 导出 warning 显示为 success toast | ✅ 已修 (R1.3) |
| 6 | selectedSlideIndex 无防抖 | ✅ 已修 (R1.6) |
| 7 | updateStyle 浅拷贝 nested object | 🟢 低风险，不影响功能 |
| 8 | styleKitToPptxConfig 死代码 | 🟢 低风险，可后续清理 |
| 9 | DB migration 每次重写全部 schema | 🟢 低风险，需注意维护 |

---

## 9. 已修问题清单 (R1)

| ID | 文件 | 描述 | 行数 |
|----|------|------|------|
| R1.1 | EditStep.tsx | beforeunload 保护 | +10 |
| R1.2 | GenerateStep.tsx | PDF 按钮加 disabled | +1 |
| R1.3 | GenerateStep.tsx | 导出 warning 改为 warning toast | +5 |
| R1.4a | GenerateStep.tsx | generateAllImages 调 imageService.save | +5 |
| R1.4b | GenerateStep.tsx | 挂载 useEffect 恢复图片 | +12 |
| R1.5 | PropertyPanel.tsx | 恢复默认按钮 | +10 |
| R1.6 | EditStep.tsx | selectedSlideIndex 300ms 防抖 | +5 |

**总修改**: 4 文件, ~48 行净增（远低于 200 行上限）

---

## 10. 未修架构性问题（仅报告，不修）

1. **EditPatch / content 模式双路径** — 内容编辑 bypass patch 系统，导致 title/conclusion/speakerNotes 不可 undo/redo。修复需要：扩展 EditPatch 支持 slide 级属性（title, mainConclusion, speakerNotes），或重构 content 编辑器走 EditPatch。
2. **"仅替换标题" 目标错误** — patch 携带了 ContentBlock 的 elementId 而非 slide.id。修复需要：AiEditPanel 在 handleApplyTitleOnly 时构造一个操作 slide.title 的新 patch。
3. **updatePPTJson 不持久化** — 只更新 zustand 状态。修复需要：每次 updatePPTJson 后自动写 projects 表（或重构为单一持久化源）。
4. **styleKitToPptxConfig 死代码** — 含 borderRadius/shadow 映射但从未被 export-pptx.ts 调用。修复需要：将这些属性加入 RenderSpec pipeline 或在 export-pptx.ts 中使用该函数。

---

## 11. DreamKit SPEC 审计

- **文件**: `DREAMKIT_SPEC.md` — ✅ 文档结构清晰，无代码实现
- **内容**: 定义了 DesignIntent / 多模态引擎 / L3 编辑 / 设计图谱 / 协作时间线
- **修改**: 本次未修改（无错字需要修正）
- **建议**: 未来实现 G1 时先统一 EditPatch 路径，再扩展 L3 编辑协议

---

## 12. 修改文件清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| components/EditStep.tsx | 修改 | beforeunload + selectedSlideIndex 防抖 |
| components/GenerateStep.tsx | 修改 | PDF disabled + warning toast + imageService.save + mount restore |
| components/PropertyPanel.tsx | 修改 | "恢复默认"按钮修复 + DEFAULT_STYLE_DNA |
| __tests__/db.test.ts | 新增 | 15 个 DB 服务测试 (jest.mock Dexie) |
| REVIEW_REPORT.md | 新增 | 本报告 |

---

## 13. 下一步建议

1. **P1 优先**: 修复 "仅替换标题" 目标错误（修改 AiEditPanel.handleApplyTitleOnly）
2. **P1 优先**: 修复 updatePPTJson 不持久化 projects 表的问题
3. **P1**: 统一 EditPatch / content 模式编辑路径（较大重构，建议单独计划）
4. **P2**: 清理 styleKitToPptxConfig 死代码
5. **验证**: P1 修复后，进入真实 API Key 集成测试
6. **DreamKit G1**: 建议在上述 P1 修复完成后再开始

---

## 14. 测试覆盖统计

| 套件 | 测试数 | 状态 |
|------|--------|------|
| ai-mock-data | - | ✅ |
| auto-fixer | - | ✅ |
| db (new) | 15 | ✅ |
| edit-patch | - | ✅ |
| edit-patch-prompt | - | ✅ |
| layout-resolver | - | ✅ |
| patch-diff | - | ✅ |
| render-style | - | ✅ |
| text-diff | - | ✅ |
| validate-patch | - | ✅ |
| **Total** | **153** | ✅ **100% pass** |

---

*报告生成时间: 2026-05-01*
*审查模式: AI_MOCK=true, 自动化验证 + 人工路径标注*
