# HANDOFF — AI PPT Generator

## Context
- **What this project is**: 风格继承式 PPT 生成工具
- **Current goal**: 完成 v2 升级：AI PPT 助手完整工作流（分析→规划→生成）
- **Project path**: `/Volumes/E/ai-ppt-generator`

## What Was Done
9 步升级计划全部完成（Steps 1-9）+ 新建项目 bug 修复。

## Current State
- **Completed**: 9/9 steps + new project `?new=1` flow
- **Partial**: Task #54 (`generate-slide` API 未适配新 GenSlidePrompt 格式)
- **Blocked**: None

## Next Step
更新 `app/api/generate-slide/route.ts`，将输入改为 `GenSlidePrompt` 格式（含 `elements[]`、`globalStylePrompt`、`visualPrompt`、`colorRules`）。

## Read First
- Plan: `/Users/magnus/.claude/plans/floofy-wondering-gray.md`
- New types: `types/workbench.ts`
- Store: `lib/store.ts` (resetWorkbench, loadWorkbench, assetLibrary, extractedDocumentText)
- **Needs update**: `app/api/generate-slide/route.ts`

## Do Not Do
- 不要在 Zustand 中添加 persist middleware（会破坏新建项目检测）
- 不要移除 `WorkbenchPage` 的 `Suspense` boundary
- 不要修改 Dexie schema version 不加 migration