# CURRENT_STATE — AI PPT Generator

## v2 升级进度
**Status**: 9/9 steps completed + bug fixes done. 1 remaining task.

### Remaining
- Task #54 (in_progress): `generate-slide/route.ts` 适配新 `GenSlidePrompt` 格式

### TypeScript
- `npx tsc --noEmit` → 0 errors ✅

### 移动记录
- 2026-05-05: 项目从 `/Users/magnus/code/ai-ppt-generator` 移动到 `/Volumes/E/ai-ppt-generator`
- 原 E 盘旧版本（22文件）被覆盖；嵌套目录内的新版本（7项）提升到根目录

### Bug History
- 2026-05: 新建项目 bug — Zustand 内存残留导致 `init()` 无法检测到需要新建项目。解决：`?new=1` + `resetWorkbench()`
- 2026-05: 模板卡片不显示 — 条件 `referenceSlidePrompts.length > 0` 错误排除无参考页场景