# EditPatch E2E 测试计划

> Phase 9 — 2026-04-30
> 覆盖 AI 单点修改闭环的 7 个核心用户场景

---

## 1. 把标题改短一点

| 项目 | 内容 |
|------|------|
| **初始条件** | slide layout=content, title="我们公司 2026 年第一季度业务增长分析报告", content 含 3 个 text block |
| **用户指令** | "把标题改短一点" |
| **预期 operation** | `update_text` |
| **预期 elementId** | 标题元素 ID（若标题是独立 block）或 slide.title 对应 |
| **预期 diff** | oldValue 为原标题（23字），newValue 为缩短版（如"Q1 业务增长分析"，~8字） |
| **应用结果** | slide.title 变为新文字，content 不变 |
| **undo 预期** | title 恢复为原标题 |
| **redo 预期** | title 再次变为缩短版 |
| **PPTX 预期** | 导出后标题文字可编辑，内容为缩短版 |
| **失败信号** | AI 返回 move_element（误判为删字）; title 为空; slideId 错误 |

---

## 2. 这一页文字减少 50%

| 项目 | 内容 |
|------|------|
| **初始条件** | slide layout=content, content 含 4 个 text block（各含 3-5 行文字） |
| **用户指令** | "这一页文字减少 50%" |
| **预期 operation** | `batch_update_text` |
| **预期 diff** | 每个 block 的 text 都缩短约 50%，保留核心信息 |
| **应用结果** | 所有被修改 block 的 content 字段变短 |
| **undo 预期** | 所有 block 恢复原文 |
| **redo 预期** | 所有 block 再次缩短 |
| **PPTX 预期** | 导出后所有文字可编辑，内容为缩短版 |
| **失败信号** | AI 返回 delete_element（删掉整个 block）; 只改了 1 个 block; newValue 格式错误 |

---

## 3. 把右侧卡片往左挪一点

| 项目 | 内容 |
|------|------|
| **初始条件** | slide content 含 position.x=0.55 的 block（右侧卡片） |
| **用户指令** | "把右侧卡片往左挪一点" |
| **预期 operation** | `move_element` |
| **预期 diff** | oldValue.x=0.55 → newValue.x≈0.35（左移约 0.2） |
| **应用结果** | 该 block 的 position.x 减小，width/height 不变 |
| **undo 预期** | position 恢复原始值 |
| **redo 预期** | position 再次变为左移后的值 |
| **PPTX 预期** | 导出后元素在新位置，可选中移动 |
| **失败信号** | AI 返回 resize_element; 移动后越界; 移动了错误的 block; slideId 错误 |

---

## 4. 把图片放大一点

| 项目 | 内容 |
|------|------|
| **初始条件** | slide content 含 type=image 的 block |
| **用户指令** | "把图片放大一点" |
| **预期 operation** | `resize_element` |
| **预期 diff** | oldValue 的 width/height 小于 newValue 的 width/height |
| **应用结果** | 图片 block 的 width/height 增大 |
| **undo 预期** | 尺寸恢复原值 |
| **redo 预期** | 尺寸再次增大 |
| **PPTX 预期** | 导出后图片在新尺寸位置 |
| **失败信号** | AI 返回 move_element（只移位置不改大小）; 放大后越界; 改变了非图片 block |

---

## 5. 删除这个模块

| 项目 | 内容 |
|------|------|
| **初始条件** | slide content 含 3 个 block，用户指向其中一个（如装饰线或多余文字） |
| **用户指令** | "删除这个模块" |
| **预期 operation** | `delete_element` |
| **预期 diff** | oldValue 为被删除的完整 ContentBlock, newValue=null |
| **应用结果** | slide.content 减少 1 个元素 |
| **undo 预期** | 被删除的元素重新出现（位置和内容完整） |
| **redo 预期** | 元素再次被删除 |
| **PPTX 预期** | 导出后该元素不存在 |
| **失败信号** | AI 返回 update_text（清空文字而非删元素）; 删除了 locked 元素; 删除了错误元素 |

---

## 6. 新增一个底部结论条

| 项目 | 内容 |
|------|------|
| **初始条件** | slide content 含 2 个 block（标题 + 正文），底部无结论 |
| **用户指令** | "新增一个底部结论条" |
| **预期 operation** | `add_element` |
| **预期 diff** | oldValue=null, newValue 为完整 ContentBlock，position.y≈0.85 |
| **应用结果** | slide.content 增加 1 个元素 |
| **undo 预期** | 新增元素消失，content 恢复原状 |
| **redo 预期** | 新增元素再次出现 |
| **PPTX 预期** | 导出后底部有新文字元素，可编辑 |
| **失败信号** | AI 返回 update_text（修改已有元素）; 新增元素越界; id 与已有元素重复 |

---

## 7. 这一页改成左右对比布局

| 项目 | 内容 |
|------|------|
| **初始条件** | slide layout=content |
| **用户指令** | "这一页改成左右对比布局" |
| **预期 operation** | `replace_layout` |
| **预期 diff** | oldValue="content", newValue 可能为 "image" 或 "chart"（左右结构） |
| **应用结果** | slide.layout 变为新值，content 保持不变 |
| **undo 预期** | layout 恢复为 "content" |
| **redo 预期** | layout 再次变为新值 |
| **PPTX 预期** | 导出后页面可打开，不为空 |
| **失败信号** | AI 返回 add_element 或 move_element（试图手动重排）; layout 值不在 [title, content, image, chart, quote] 中; slideId 错误 |

---

## 手动验证清单

每个用例完成后，需手动检查：

1. **PPTX 可打开** — 在 PowerPoint / WPS / Keynote 中打开无报错
2. **元素可编辑** — 双击文字可修改，图片可替换
3. **位置正确** — 视觉位置与预览一致
4. **中文显示** — 无乱码、无缺失字体
5. **undo/redo** — Ctrl+Z / Ctrl+Shift+Z 工作正常
6. **连续操作** — 多次 AI 编辑后状态一致
7. **导出后再导入** — 导出的 PPTX 重新上传后 StyleKit 可提取
