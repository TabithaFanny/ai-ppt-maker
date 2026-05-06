# TECH_DEBT — AI PPT Generator

## P0 (Blocks Main Flow)
- `generate-slide` API 未适配新格式: `app/api/generate-slide/route.ts` 用旧 `slidePlan` / `singleSlideGeneration` 格式，与 Step 1 扩展的 `GenSlidePrompt` 不兼容

## P1 (Blocks Current Version)
- 无端到端测试覆盖

## P2 (Blocks Next Version)
- `lib/store.ts` (651 行): workbench 状态混杂，可拆分
- `WorkbenchChat.tsx` (457 行): 对话列表和模板卡片可拆分为独立组件
- 资产库 base64 存储无大小限制

## P3 (Record Only)
- `types/workbench.ts`: `GenSlideElement` 的 `elements` type 字段是 `string` 可改为联合类型
- Dexie version 8: 新增表需 bump version