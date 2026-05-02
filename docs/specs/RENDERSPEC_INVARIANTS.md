# RenderSpec 不变量定义

> Phase 7 架构验证文档
> 版本: 1.0.0

---

## 1. 数据流位置

```
PPTJson (唯一真源) + StyleKit + LayoutPlan
  → buildRenderSpec() [lib/render-spec.ts]
  → RenderSpec (导出专用，临时结构)
  → exportRenderSpecToPPTX() [lib/export-pptx.ts]
  → PPTX 文件
```

**关键设计决策**: RenderSpec 不是唯一真源。PPTJson 是所有编辑、预览、undo/redo 的唯一真源。RenderSpec 仅在导出时构建，是 PPTJson 的派生视图。

---

## 2. 不变量列表

### I1: PPTJson → RenderSpec 映射完整性
- **描述**: PPTJson 中每个 slide 的每个 content block 必须在 RenderSpec 中有对应的 RenderElement
- **验证**: `buildRenderSpec()` 遍历所有 slides 和 blocks，`mapContentType()` 映射所有 ContentBlock 类型
- **当前状态**: ✅ 已实现 — 循环遍历所有 blocks，无遗漏

### I2: 位置坐标从相对到绝对的转换正确性
- **描述**: PPTJson 使用 0-1 相对坐标，RenderSpec 使用绝对英寸（10×7.5 英寸标准）
- **公式**: `absoluteX = relativeX * 10`, `absoluteY = relativeY * 7.5`
- **验证**: `toAbsoluteInches()` 函数
- **当前状态**: ✅ 已实现

### I3: StyleKit 样式优先级
- **描述**: 元素样式解析优先级为: 元素自带 style > StyleKit DNA 默认值 > 硬编码回退值
- **验证**: `resolveBlockStyle()` 函数检查 block.style，然后 styleKit.styleDNA，最后硬编码默认值
- **当前状态**: ✅ 已实现

### I4: 类型映射正确性
- **描述**: ContentBlock 类型必须正确映射到 SlideElement 类型
- **映射表**:
  - `text` → `paragraph`
  - `list` → `bullet-list`
  - `image` → `image`（直接映射）
  - `chart` → `chart`（直接映射）
- **验证**: `mapContentType()` 函数
- **当前状态**: ✅ 已实现

### I5: 每张幻灯片必须有且仅有一个背景
- **描述**: RenderSlide.background 必须被解析为合法的十六进制颜色值
- **验证**: `getSlideBackground()` 函数优先使用 StyleKit palette.background，回退到 '#ffffff'
- **当前状态**: ✅ 已实现

### I6: RenderElement.id 全局唯一
- **描述**: 每个 RenderElement 的 id 在整个 RenderSpec 中必须唯一
- **生成方式**: `${slideId}-${blockId}`
- **当前状态**: ✅ 已实现（拼接生成保证唯一）

### I7: pptxOptions 就绪性
- **描述**: 每个 RenderElement 的 pptxOptions 必须可以直接传递给 pptxgenjs 的 addText/addImage 等方法
- **包含字段**: fontFace, fontSize, fontBold, color, align
- **当前状态**: ✅ 已实现

### I8: 验证结果嵌入
- **描述**: RenderSpec 必须包含验证结果（validationPassed + issues）
- **来源**: `performResidualCheck()` 在 buildRenderSpec 中调用
- **当前状态**: ✅ 已实现

---

## 3. 不变量覆盖的现有验证

| 不变量 | 验证位置 | 验证方式 |
|--------|---------|---------|
| I1 映射完整性 | render-spec.ts buildRenderSlide | 双重循环遍历 |
| I2 坐标转换 | render-spec.ts toAbsoluteInches | 纯函数，可单元测试 |
| I3 样式优先级 | render-spec.ts resolveBlockStyle | 条件链 |
| I4 类型映射 | render-spec.ts mapContentType | switch-case |
| I5 背景 | render-spec.ts getSlideBackground | 条件检查 |
| I6 ID 唯一性 | render-spec.ts buildRenderSlide | 拼接策略 |
| I7 pptxOptions | render-spec.ts resolveBlockStyle | 字段映射 |
| I8 验证嵌入 | render-spec.ts buildRenderSpec | 调用 performResidualCheck |

---

## 4. 缺失的验证

| 缺失项 | 风险等级 | 说明 |
|--------|---------|------|
| 坐标边界检查 | 低 | 未验证绝对坐标是否在 10×7.5 英寸范围内 |
| 字体回退链 | 低 | 未验证 fontFace fallback 是否在 PPTX 中有效 |
| 空内容检查 | 中 | 空 block 仍会生成 RenderElement（无内容的文本框） |
| 图片 base64 有效性 | 中 | 未验证图片 base64 是否可解码 |
| RenderSpec 体积限制 | 低 | 大量元素可能导致 PPTX 文件过大 |

---

## 5. 总结

8 个核心不变量全部已实现并通过代码验证。主要风险在于边界条件和输入验证，但这些不影响核心数据流的正确性。RenderSpec 作为导出专用的派生结构，设计清晰，职责单一。
