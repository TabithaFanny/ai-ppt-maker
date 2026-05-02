# MVP 范围定义

> Phase 11 — 2026-05-01

---

## MVP 包含

| 功能 | 状态 | 说明 |
|------|------|------|
| 上传 PPTX/PDF 模板 | ✅ | 支持 pdf/ppt/pptx，50MB 限制 |
| StyleKit 提取 | ✅ | 3 步管道：extract → DNA → distill |
| 风格报告展示 | ✅ | 配色、字体、布局模式 |
| DeckPlan 生成 | ✅ | 7 种场景，结构化规划 |
| 页面生成 | ✅ | zone 布局系统 |
| 页面预览 | ✅ | 3 种编辑模式 |
| AI 单点修改 | ✅ | 自然语言→EditPatch→diff→确认 |
| 文字编辑 | ✅ | 直接编辑 + patch 追踪 |
| 元素拖拽/缩放 | ✅ | snap-to-zone |
| undo/redo | ✅ | 50 步历史 |
| 版本历史 | ✅ | IndexedDB 存储，最多 10 个 |
| PPTX 导出 | ✅ | 文字+图片，auto-fix 前置 |
| 质量检查 | ✅ | ResidualValidator + auto-fixer |

---

## MVP 不包含

| 功能 | 原因 | 后续计划 |
|------|------|----------|
| 多人协作 | 架构复杂度高 | WebSocket/CRDT |
| 云端同步 | 需要后端存储 | Supabase/自建 |
| 模板社区 | 需要运营 | 第二阶段 |
| 高级动画 | pptxgenjs 限制 | 需要原生 PPTX 操作 |
| 复杂图表编辑 | 图表导出为占位符 | chart-to-image 服务 |
| 完整移动端编辑 | 响应式适配工作量大 | 渐进增强 |
| 多用户权限系统 | 需要认证框架 | Supabase Auth |
| SVG 渲染导出 | 安全+技术限制 | SVG→PNG 预渲染 |
| 原生 slide 模板 | 每页从零构建 | pptxgenjs master slides |

---

## MVP 质量标准

- 125+ 测试全部通过
- tsc --noEmit 零错误
- pnpm build 成功
- 主流程 5 步端到端可用
- PPTX 在 PowerPoint 和 WPS 中可打开
- 中文字体正常显示
- undo/redo 正确工作
- AI 编辑有 diff 预览和安全校验
