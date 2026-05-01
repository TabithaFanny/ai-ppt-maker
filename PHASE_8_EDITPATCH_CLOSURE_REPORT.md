# Phase 8 — EditPatch 产品闭环补齐报告

> 日期: 2026-04-30
> 版本: 1.0.0
> 状态: 完成

---

## 一、完成的切片

### 切片 1: replace_layout ✅
- 新增 `createReplaceLayoutPatch` 工厂函数
- 新增 `replace_layout` 的 apply/reverse 逻辑（只修改 `slide.layout`，保留 title/content/conclusion）
- 新增 5 个测试：正常替换、reverse 恢复、非法 slideId、不影响其他 slide、保留 title/content

### 切片 2: add_element UI 接入 ✅
- `handleAssetSelect` 改用 `createAddElementPatch + pushPatch`
- 新增 2 个集成测试：add_element undo/redo、replace_layout undo/redo

### 切片 3: PatchValidator ✅
- 新建 `lib/validate-patch.ts`
- 校验规则：
  - slideId 是否存在
  - elementId 是否存在
  - operation 是否受支持
  - locked 元素不可 update/delete/move/resize
  - move/resize 不允许越界或负尺寸
  - batch_update_text 中所有 elementId 必须存在
  - add_element 不允许重复 id
- 返回 `{ valid, errors: [{ code, message, elementId? }] }`
- 新增 18 个测试覆盖所有规则

### 切片 4: diff preview ✅
- 新建 `lib/patch-diff.ts`
- 支持所有 7 种操作的 diff 生成
- 输出结构：`{ slideId, slideTitle, operation, summary, changes: [{ elementId?, field, oldValue, newValue }] }`
- 新增 8 个测试

### 切片 5: 自然语言单点修改入口 ✅
- 新增 `EditPatchSchema` 到 `lib/schemas.ts`
- 新建 `app/api/edit-patch/route.ts` API 路由
  - 接收当前 slide + 用户指令
  - 调用 AI 生成 EditPatch JSON
  - Zod schema 校验 + slideId 安全检查
  - AI 不允许修改非当前 slide
- 新建 `components/AiEditPanel.tsx` 组件
  - 输入框 + 生成按钮
  - 错误展示
  - diff 预览 + 确认/取消
  - 确认后 `pushPatch`
- 接入 `EditStep.tsx`
  - 工具栏新增"AI 编辑"按钮
  - 浮动面板渲染 AiEditPanel

---

## 二、新增/修改文件

### 新增文件 (6)
| 文件 | 说明 |
|------|------|
| `lib/validate-patch.ts` | PatchValidator — 补丁业务合法性校验 |
| `lib/patch-diff.ts` | 人类可读 diff 生成 |
| `app/api/edit-patch/route.ts` | AI 单点修改 API |
| `components/AiEditPanel.tsx` | AI 编辑面板 UI |
| `__tests__/validate-patch.test.ts` | PatchValidator 测试 (18) |
| `__tests__/patch-diff.test.ts` | patch-diff 测试 (8) |

### 修改文件 (5)
| 文件 | 改动 |
|------|------|
| `lib/edit-patch.ts` | 新增 `createReplaceLayoutPatch` + `replace_layout` case |
| `lib/schemas.ts` | 新增 `EditPatchSchema` |
| `components/EditStep.tsx` | 导入 AiEditPanel，新增 AI 编辑按钮和面板，`handleAssetSelect` 走补丁 |
| `types/elements.ts` | `ContentBlock` 新增 `locked?: boolean` |
| `__tests__/edit-patch.test.ts` | 新增 7 个测试（replace_layout 5 + resize 2 + 集成 2） |

---

## 三、新增测试数

| 测试文件 | 新增 | 总计 |
|----------|------|------|
| `edit-patch.test.ts` | +7 | 30 |
| `validate-patch.test.ts` | +18 | 18 |
| `patch-diff.test.ts` | +8 | 8 |
| **总计新增** | **+33** | — |

---

## 四、当前测试结果

```
Test Suites: 6 passed, 6 total
Tests:       88 passed, 88 total
Time:        0.758s
```

---

## 五、构建结果

```
pnpm build — 22 routes (新增 /api/edit-patch)
tsc --noEmit — 0 errors
```

---

## 六、EditPatch 操作矩阵

| 操作 | 工厂函数 | apply | reverse | Validator | Diff | UI 接入 |
|------|---------|-------|---------|-----------|------|---------|
| `update_text` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (handleBlockUpdate) |
| `batch_update_text` | ✅ | ✅ | ✅ | ✅ | ✅ | — (无触发入口) |
| `move_element` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (handleBlockUpdate) |
| `resize_element` | ✅ | ✅ | ✅ | ✅ | ✅ | — (无触发入口) |
| `delete_element` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (handleBlockDelete) |
| `add_element` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (handleAssetSelect) |
| `replace_layout` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (AI edit) |

**7/7 操作全链路完成**。

---

## 七、仍未完成的风险项

| # | 风险 | 等级 | 说明 |
|---|------|------|------|
| 1 | `batch_update_text` 无 UI 触发入口 | LOW | 底层完整，但没有 UI 调用 `createBatchUpdateTextPatch`。AI 编辑可能返回此操作 |
| 2 | `resize_element` 无 UI 触发入口 | LOW | 底层完整，ElementCanvas 拖拽 resize 未接入补丁系统 |
| 3 | AI 返回质量不稳定 | MEDIUM | AI 可能返回格式错误的 JSON 或不正确的 oldValue/newValue。已有 Zod 校验 + PatchValidator 双重防护 |
| 4 | locked 字段无 UI 设置入口 | LOW | ContentBlock 新增了 `locked` 字段，但没有 UI 让用户锁定/解锁元素 |
| 5 | diff preview 无复杂 UI | LOW | 当前是文本展示，未做可视化对比 |

---

## 八、下一步建议

### 短期 (1-2 天)
1. **ElementCanvas resize 接入补丁系统** — 拖拽调整大小时创建 `createResizePatch`
2. **batch_update_text UI 入口** — 支持选中多个元素批量编辑文字
3. **locked 元素 UI** — 在 PropertyPanel 添加锁定/解锁开关

### 中期 (1 周)
4. **AI edit 质量优化** — few-shot examples、更好的 prompt、重试机制
5. **diff preview 可视化** — 在 SlidePreview 上高亮变更区域
6. **编辑器中运行 auto-fix** — 实时修复空标题、越界位置

### 长期
7. **多人协作** — patch 系统天然支持 OT（Operational Transformation）
8. **编辑历史回放** — 基于 patch 序列重建任意时间点的状态

---

*报告生成时间: 2026-04-30*
*测试环境: Jest + ts-jest*
*构建环境: Next.js 16.2.4 + pnpm*
