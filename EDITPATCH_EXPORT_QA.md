# EditPatch 导出 QA 清单

> Phase 9 — 2026-04-30
> 验证每种 patch 操作后导出 PPTX 的正确性

---

## 验证矩阵

| # | 操作 | 导出后验证项 | 自动化 | 手动 |
|---|------|------------|--------|------|
| 1 | update_text | 文字变化保留且可编辑 | tsc + test | 需手动 |
| 2 | batch_update_text | 多段文字变化保留且可编辑 | tsc + test | 需手动 |
| 3 | move_element | 位置变化保留 | tsc + test | 需手动 |
| 4 | resize_element | 尺寸变化保留 | tsc + test | 需手动 |
| 5 | delete_element | 元素不存在 | tsc + test | 需手动 |
| 6 | add_element | 新增元素可编辑 | tsc + test | 需手动 |
| 7 | replace_layout | PPTX 可打开，页面不为空 | tsc + test | 需手动 |

---

## 各操作详细验证

### 1. update_text 后导出

**前置**：应用 update_text patch 将 block.content 从 "原文字" 改为 "新文字"

**自动验证**：
- `pnpm test` 通过（edit-patch.test.ts 中 applyPatchToSlide 测试）
- `tsc --noEmit` 无错误

**手动验证**：
- [ ] 导出的 PPTX 在 PowerPoint 中可打开
- [ ] 对应文字框显示"新文字"
- [ ] 双击文字框可编辑内容
- [ ] 文字样式（字号、颜色、对齐）与预览一致
- [ ] 中文字体无乱码

**工具**：PowerPoint / WPS / Keynote

---

### 2. batch_update_text 后导出

**前置**：应用 batch_update_text patch 修改 3 个 block 的文字

**自动验证**：
- `pnpm test` 通过
- `tsc --noEmit` 无错误

**手动验证**：
- [ ] 导出的 PPTX 在 PowerPoint 中可打开
- [ ] 3 个文字框都显示新内容
- [ ] 所有文字框可独立编辑
- [ ] 未被 batch 修改的 block 保持原样

**工具**：PowerPoint / WPS / Keynote

---

### 3. move_element 后导出

**前置**：应用 move_element patch 将 block 从 (0.1, 0.1) 移到 (0.5, 0.5)

**自动验证**：
- `pnpm test` 通过
- `tsc --noEmit` 无错误

**手动验证**：
- [ ] 导出的 PPTX 在 PowerPoint 中可打开
- [ ] 元素在新位置（右下方）
- [ ] 元素大小未变
- [ ] 可选中并再次移动

**工具**：PowerPoint / WPS / Keynote

---

### 4. resize_element 后导出

**前置**：应用 resize_element patch 将 block 的 width 从 0.3 增到 0.5

**自动验证**：
- `pnpm test` 通过
- `tsc --noEmit` 无错误

**手动验证**：
- [ ] 导出的 PPTX 在 PowerPoint 中可打开
- [ ] 元素宽度明显增大
- [ ] 元素位置未变（仅尺寸变化）
- [ ] 可拖拽调整大小

**工具**：PowerPoint / WPS / Keynote

---

### 5. delete_element 后导出

**前置**：应用 delete_element patch 删除一个 block

**自动验证**：
- `pnpm test` 通过
- `tsc --noEmit` 无错误

**手动验证**：
- [ ] 导出的 PPTX 在 PowerPoint 中可打开
- [ ] 被删除的元素不在页面上
- [ ] 其他元素位置和内容不变
- [ ] 页面不为空（至少有标题或其他内容）

**工具**：PowerPoint / WPS / Keynote

---

### 6. add_element 后导出

**前置**：应用 add_element patch 在底部新增一个 text block

**自动验证**：
- `pnpm test` 通过
- `tsc --noEmit` 无错误

**手动验证**：
- [ ] 导出的 PPTX 在 PowerPoint 中可打开
- [ ] 页面底部有新增的文字元素
- [ ] 新增文字可双击编辑
- [ ] 新增元素不影响原有元素

**工具**：PowerPoint / WPS / Keynote

---

### 7. replace_layout 后导出

**前置**：应用 replace_layout patch 将 layout 从 "content" 改为 "image"

**自动验证**：
- `pnpm test` 通过
- `tsc --noEmit` 无错误

**手动验证**：
- [ ] 导出的 PPTX 在 PowerPoint 中可打开
- [ ] 页面不为空
- [ ] 原有内容仍存在（layout 变化不应删除 content）
- [ ] 页面视觉布局有变化（如标题位置、区域划分）

**工具**：PowerPoint / WPS / Keynote

---

## 自动化覆盖

当前自动化测试已覆盖：
- ✅ 每种操作的 apply/reverse 逻辑（edit-patch.test.ts, 40+ tests）
- ✅ PatchValidator 业务校验（validate-patch.test.ts, 32 tests）
- ✅ auto-fixer 实时安全修复（auto-fixer.test.ts, 15 tests）
- ✅ diff 生成（patch-diff.test.ts, 8 tests）
- ✅ 文本差异（text-diff.test.ts, 9 tests）

**不可自动化**：
- PPTX 在第三方软件中的实际渲染效果
- 中文字体兼容性
- 元素可编辑性（双击、拖拽）
- 跨平台一致性（PowerPoint vs WPS vs Keynote）

---

## 测试执行顺序

1. `pnpm test` — 全量自动化测试
2. `tsc --noEmit` — 类型检查
3. `pnpm build` — 生产构建
4. 在浏览器中执行 7 个 E2E 用例（参考 EDITPATCH_E2E_TEST_PLAN.md）
5. 导出 PPTX，用 PowerPoint / WPS 逐项验证以上清单
