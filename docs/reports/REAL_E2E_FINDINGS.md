# 真实 E2E 测试发现

> Phase 10 — 2026-05-01
> 基于代码审计发现的真实问题

---

## P0：阻断主流程，必须修

### F-01: distill 路由无 Zod 校验
- **问题**: `app/api/style-kit/distill/route.ts` 对 AI 返回直接 `JSON.parse()`，无 schema 校验
- **复现**: AI 返回格式错误的 JSON → 整个 StyleKit 提取崩溃
- **影响**: StyleKit 提取流程完全失败
- **原因**: 其他路由（generateDeckPlan、edit-patch）都用了 `validateAIOutput()`，唯独 distill 遗漏
- **修复**: 添加 Zod schema 校验 + fallback
- **涉及文件**: `app/api/style-kit/distill/route.ts`, `lib/schemas.ts`

### F-02: SSE 解析无 try/catch
- **问题**: `components/EditStep.tsx` 中 `generateInitialPPT` 的 SSE 解析 `JSON.parse(line.slice(6))` 无保护
- **复现**: 服务端返回非 JSON 的 SSE data → 客户端崩溃白屏
- **影响**: 生成流程中断，用户无法继续
- **原因**: SSE 流中可能包含非 JSON 数据（错误消息、心跳等）
- **修复**: 添加 try/catch，跳过无法解析的行
- **涉及文件**: `components/EditStep.tsx`

### F-03: 生成无超时机制
- **问题**: AI 生成 DeckPlan + PPTJson 无超时，用户可能无限等待
- **复现**: MiniMax API 响应缓慢或挂起 → 用户卡在 loading
- **影响**: 用户体验完全中断
- **原因**: fetch 无 AbortController 超时
- **修复**: 添加 60s 超时 + 取消按钮
- **涉及文件**: `components/EditStep.tsx`

---

## P1：影响体验，上线前建议修

### F-04: 版本历史频繁保存
- **问题**: `handleSlideUpdate` 每次编辑都调用 `versionService.save`，快速编辑时 IndexedDB 被大量写入
- **复现**: 快速连续编辑 10 次文字 → 创建 10 个版本快照
- **影响**: IndexedDB 存储膨胀，性能下降
- **原因**: 无 debounce
- **修复**: 添加 2s debounce
- **涉及文件**: `components/EditStep.tsx`

### F-05: 样式修改绕过 Patch 系统
- **问题**: `handleBlockUpdate` 中 style 修改走直接更新，不经过 EditPatch
- **复现**: 修改字号 → Ctrl+Z → 字号未撤销
- **影响**: undo/redo 不完整
- **原因**: 注释写着 "Other updates (style, etc.) -- direct update for now"
- **修复**: 对 style 修改也使用 `createUpdatePatch`
- **涉及文件**: `components/EditStep.tsx`

### F-06: PPT (非 PPTX) 上传后解析失败
- **问题**: 上传 `.ppt` 二进制格式 → `extract-slide-images` 使用 JSZip 解析 → 失败
- **复现**: 上传 .ppt 文件 → StyleKit 提取崩溃
- **影响**: 旧格式 PPT 无法使用
- **原因**: JSZip 只支持 ZIP 格式（PPTX），不支持旧二进制 PPT
- **修复**: 上传时检测 .ppt 格式，给出明确提示"请转换为 PPTX 格式"
- **涉及文件**: `app/api/upload/route.ts`

### F-07: extractColorScheme 是空实现
- **问题**: `extract-slide-images/route.ts` 中 `extractColorScheme` 返回 `{}`
- **复现**: 上传任何模板 → 颜色方案始终为空
- **影响**: StyleKit 的颜色方案数据不完整
- **原因**: 函数是 stub，从未实现
- **修复**: 至少从 XML 中提取 `a:srgbClr` 值
- **涉及文件**: `app/api/extract-slide-images/route.ts`

### F-08: 图片 URL 未校验
- **问题**: PPTX 导出时，image block 的 content 可能是普通 URL 而非 base64 data URL
- **复现**: AI 生成的图片 block content 为 `https://...` → `addImage` 失败
- **影响**: 导出 PPTX 中图片位置显示错误
- **原因**: `export-pptx.ts` 假设所有图片都是 base64
- **修复**: 检查 content 格式，非 base64 时插入占位符
- **涉及文件**: `lib/export-pptx.ts`

---

## P2：不影响上线，可后续优化

### F-09: 上传无速率限制
- **问题**: `/api/upload` 无认证、无速率限制
- **影响**: 可被滥用
- **建议**: 后续添加 basic auth 或 rate limit

### F-10: uploads 目录无清理机制
- **问题**: 上传的文件永远不会被删除
- **影响**: 磁盘空间持续增长
- **建议**: 添加定期清理或 TTL

### F-11: next.config.ts 无安全头
- **问题**: 未配置 CSP、X-Frame-Options 等安全头
- **影响**: 安全审计不通过
- **建议**: 添加基本安全头配置

### F-12: generateSlideThumbnails 返回空字符串
- **问题**: `pptx-parser.ts` 中缩略图生成是空实现
- **影响**: PPT/PPTX 上传后无缩略图预览
- **建议**: 后续实现真正的缩略图提取

### F-13: 双类型系统
- **问题**: `ContentBlock`（deprecated）和 `SlideElement`（new）并存
- **影响**: 开发者困惑，可能引入 bug
- **建议**: 统一到 `ContentBlock`，删除 deprecated 标记

---

## Won't Fix：当前阶段不处理

### F-14: 无用户认证
- **说明**: 当前为本地开发/演示阶段，认证系统不在 MVP 范围
- **后续**: 接入 Supabase Auth 或类似方案

### F-15: 无多人协作
- **说明**: MVP 暂不支持
- **后续**: WebSocket/CRDT 方案

### F-16: 图表导出为文本占位符
- **说明**: pptxgenjs 不支持原生图表渲染
- **后续**: 接入 chart-to-image 服务

### F-17: 图标/装饰元素导出跳过
- **说明**: pptxgenjs 不支持 SVG 渲染
- **后续**: 将 SVG 预渲染为 PNG
