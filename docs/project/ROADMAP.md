# ROADMAP — AI PPT Generator

## v1 MVP (Completed)
- 上传参考 PPT / PDF
- StyleKit 分析（3 阶段）
- AI PPT 助手对话规划
- 单页生成（Prompt 3）
- 内容编辑（EditPatch）
- PPTX 导出
- 本地持久化（IndexedDB）

## v2 升级（Current）

### 9-Step Plan (All Completed ✅)
- ✅ Step 1: 扩展类型定义（GenSlideElement, ColorRules, DeckBrief, 12 new SlideRoles）
- ✅ Step 2: 重写 workbench-chat API（全新 System Prompt + 新 JSON 格式）
- ✅ Step 3: 重构 WorkbenchChat.tsx（新格式解析 + 加载状态 + 文件上传）
- ✅ Step 4: 扩展 GeneratedPromptPanel（elements/layoutStructure/colorRules/globalStylePrompt）
- ✅ Step 5: 自动分析所有参考页（Promise.all 并行 batch 3）
- ✅ Step 6: 模板推荐浮动卡片（无参考页也显示）
- ✅ Step 7: 资产库支持（图片/Logo 上传管理）
- ✅ Step 8: Word/PDF 文档读取（mammoth + pdfjs-dist）
- ✅ Step 9: 修复保存 Bug + 新建项目 Bug

### v2 待完成
- [ ] Task #54: 更新 `generate-slide` API 使用新 `GenSlidePrompt` 格式
- [ ] UI 触发按钮：点击生成单页时调用 `/api/generate-slide`
- [ ] 端到端测试：上传 → 分析 → 规划 → 生成 → 导出

## v3 候选
- [ ] 批量生成所有页面
- [ ] StyleKit 模板市场
- [ ] 多语言支持