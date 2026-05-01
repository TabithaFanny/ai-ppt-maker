# AI PPT Generator 优化 TODO

## 执行记录

| 日期 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-05-01 14:37 | TODO-1 Step5单张重生成 | ✅ | build通过，125测试通过 |
| 2026-05-01 14:50 | TODO-2 Step2封面预览 | ✅ | StyleKitReport.tsx |
| 2026-05-01 16:22 | P0-P3 全链路前端重构 | ✅ | 8项全部完成 |
| 2026-05-01 16:35 | TODO-5 AI模型分层 | ✅ | DeepSeek v4-pro接入 |

## 模型分层

| 任务 | 模型 | 说明 |
|------|------|------|
| 风格提取（extract） | MiniMax M2.7 | 需要多模态视觉能力 |
| 风格蒸馏（distill） | DeepSeek v4-pro | 深度推理，融合多页分析 |
| 需求转译（translateRequirements） | DeepSeek v4-pro | 内容策划需要深度理解 |
| 内容生成（generatePPTJson） | DeepSeek v4-pro | 结构化JSON生成 |
| DeckPlan规划（generateDeckPlan） | DeepSeek v4-pro | 大纲规划需要深度推理 |
| 图像生成 | GPT-Image-2 | 独立模块，不受影响 |
