# AI PPT Generator 优化 TODO

## 目标
在现有5步流程基础上优化，参考DreamKit架构思维

## 优先级排序

### P0 （最小改动，最高价值）

- [ ] **TODO-1: Step5 单张重生成**
  - 文件: `components/GenerateStep.tsx`
  - 目标: 生成结果页支持"单张重新生成"和"修Prompt后重生成"
  - 改动: 在生成结果区域加"重生成"按钮 + Prompt编辑弹窗

### P1 （中改动，高价值）

- [ ] **TODO-2: Step2 封面样张预览**
  - 文件: `components/style-kit/StyleKitWizard.tsx`
  - 目标: 风格分析完成后，10秒内生成一张封面预览图
  - 改动: 在Wizard完成时调用GPT-Image-2，弹出预览让用户确认风格

- [ ] **TODO-3: Step3 Prompt编辑器**
  - 文件: `components/EnhancedRequirementsForm.tsx`
  - 目标: 用户输入主题后，AI生成生图Prompt，用户可以编辑/优化
  - 改动: 加一个Prompt预览+编辑区块，实时修改

### P2 （较大改动，中等价值）

- [ ] **TODO-4: Step4 逐页生图预览**
  - 文件: `components/EditStep.tsx`
  - 目标: 边编辑边预览，编辑完一页点"预览"→10秒出图
  - 改动: 在编辑区域加"预览本页"按钮，调用GPT-Image-2

### P3 （可选，锦上添花）

- [ ] **TODO-5: AI模型分层**
  - 文件: `lib/api-client.ts`
  - 目标: 把DeepSeek v4-pro接入项目（文字处理→DeepSeek，生图→GPT-Image-2）
  - 改动: 添加DeepSeek API client配置

## 执行记录

| 2026-05-01 14:37 | TODO-1 Step5单张重生成 | ✅ 完成 | ✅ build通过，125测试通过 |
| 2026-05-01 14:48 | UI_REPORT.md | ✅ 完成 | 全链路交互报告已生成 |
| 2026-05-01 14:50 | TODO-2 Step2封面预览 | ✅ 完成 | ✅ build通过，125测试通过 |

## TODO-2 完成详情（封面预览图）
- 文件: components/style-kit/StyleKitReport.tsx
- 改动:
  1. ✅ "预览封面效果"按钮（替代原来的"保存StyleKit"按钮）
  2. ✅ 点击后调用GPT-Image-2生成封面图（1792x1024）
  3. ✅ 弹出确认弹窗（预览图 + "风格OK，继续" / "再试一张"）
  4. ✅ 确认后进入Step3，风格已保存
- build: ✅ 通过 | tests: ✅ 125/125 通过

## TODO-2 详情（封面预览图）
- 文件: components/style-kit/StyleKitWizard.tsx
- 目标: Wizard完成后弹出风格预览（封面AI图），用户确认后进入Step3
- 改动:
  1. Wizard onComplete 回调 → 调用 GPT-Image-2 生成封面图
  2. 弹出确认弹窗（预览图 + "风格OK" / "再试一张"）
  3. 确认后进入Step3
  4. 封面图URL存入project store
- UI_REPORT: ~/code/ai-ppt-generator/UI_REPORT.md（已生成）