# AGENT_RULES — AI PPT Generator

## Do Not Change
- Zustand store 接口不更新所有消费者不能改
- Dexie schema version 不加 migration 不能改
- `useSearchParams()` 必须包裹 `Suspense` boundary
- 所有"新建项目"链接必须用 `?new=1`

## Must Know
- 新建项目: `?new=1` + `resetWorkbench()` + `projectService.create()`
- `loadWorkbench()` 必须调用 — 从 DB 重新加载
- `resetWorkbench()` 切换项目时必须调用
- 资产图片以 base64 data URL 存储在 `projectAssets` table
- Reference slide 分析用 GPT-4o vision（需要 `OPENAI_API_KEY`）
- Chat 用 DeepSeek（需要 `DEEPSEEK_API_KEY`）

## TypeScript
- 提交前 `npx tsc --noEmit` 必须 0 错误
- 用 `GenSlideElement`（不是 `SlideElement`）避免与 `types/elements.ts` 冲突
- 所有新 `SlideRole` 类型必须加到 `deck-resolver.ts` 和 `layout-resolver.ts`

## 项目路径
`/Volumes/E/ai-ppt-generator`