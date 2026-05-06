# TECH_DECISIONS — AI PPT Generator

## 项目创建流程
- 所有"新建项目"链接使用 `/create?new=1` query param
- `WorkbenchPage` 读取 `?new=1`，强制 `projectService.create()` + `resetWorkbench()`
- `resetWorkbench()` 清空所有内存中的 workbench 状态（reference slides、messages、prompts、assets、document text）
- `loadWorkbench()` 始终从 DB 重新加载 — 不信任内存状态

## AI 集成
- **DeepSeek**: chat、slide generation（`deepseekWithFallback`）
- **GPT-4o**: vision 分析（`openaiWithFallback`）
- Mock 模式: `AI_MOCK=true` env 或 `isMockMode()` 返回 true

## 数据持久化
- **Dexie (IndexedDB)** via `lib/db.ts`（version 8）
- Tables: `projects`, `styleKits`, `analysisJobs`, `workbenchSnapshots`, `projectAssets`
- 项目是持久化单元；workbench state 作为快照按项目保存

## State Management
- Zustand store (`lib/store.ts`, 651 行)
- **无** Zustand persist middleware — `currentProject` 在客户端导航间保留在内存中
- Workbench state 通过 Dexie `workbenchService` 持久化，不是通过 Zustand

## Key Files
- `app/create/workbench/page.tsx` — 工作台入口，含 `?new=1` 判断
- `lib/store.ts` — Zustand store（651行），含 `resetWorkbench()` / `loadWorkbench()`
- `lib/db.ts` — Dexie 数据库 + services
- `lib/api-client.ts` — AI 路由（DeepSeek + GPT-4o）
- `types/workbench.ts` — GenSlidePrompt, GenSlideElement, ColorRules, DeckBrief
- `types/stylekit.ts` — StyleKit + SlideRole 类型
- `app/api/workbench-chat/route.ts` — AI PPT 助手（Step 2 重写）
- `app/api/generate-slide/route.ts` — 单页生成（Task #54 待适配）