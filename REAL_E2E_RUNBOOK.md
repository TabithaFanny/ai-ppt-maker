# 真实 E2E 验收 Runbook

> Phase 10 — 2026-05-01
> 覆盖完整用户路径：上传模板 → StyleKit → DeckPlan → 页面生成 → AI 编辑 → undo/redo → 导出 PPTX

---

## 测试准备

### 环境要求
- Node.js 18+
- pnpm installed
- MiniMax API Key (`.env.local` 中 `MINIMAX_API_KEY`)
- 现代浏览器（Chrome/Edge/Safari）
- PowerPoint / WPS / Keynote（用于验证导出）

### 启动命令
```bash
pnpm install
pnpm dev
# 访问 http://localhost:3000/create
```

### API Key 检查
```bash
# 确认 .env.local 存在且包含：
cat .env.local | grep MINIMAX_API_KEY
# 应输出: MINIMAX_API_KEY=your_key_here
```

---

## 模板准备

### 模板 A：蓝白科技风
- 文件：`test-blue-tech.pptx`
- 特征：蓝色主色调、白色背景、简洁线条、科技感图表
- 页数：8-10 页
- 包含：标题页、内容页、图表页、结尾页
- 中文内容

### 模板 B：深色商业风
- 文件：`test-dark-business.pptx`
- 特征：深色背景、金色/白色文字、商务风格
- 页数：10-15 页
- 包含：封面、目录、数据页、团队页、结尾
- 中英文混合

### 模板 C：学术简洁风
- 文件：`test-academic.pptx`
- 特征：白色背景、黑色文字、极简设计
- 页数：6-8 页
- 包含：标题页、问题描述、方法、结果、结论
- 纯中文

---

## 主题准备

### 主题 A：创业比赛路演
```json
{
  "scenario": "pitch",
  "audience": "investor",
  "topic": "AI 驱动的智能教育平台",
  "keyPoints": ["市场需求", "产品方案", "技术优势", "商业模式", "团队介绍"],
  "pageCount": 10
}
```

### 主题 B：论文/课程答辩
```json
{
  "scenario": "defense",
  "audience": "teacher",
  "topic": "基于深度学习的图像识别系统",
  "keyPoints": ["研究背景", "方法设计", "实验结果", "创新点", "未来工作"],
  "pageCount": 8
}
```

### 主题 C：职场/项目汇报
```json
{
  "scenario": "report",
  "audience": "leader",
  "topic": "2026 Q1 产品增长复盘",
  "keyPoints": ["核心指标", "增长策略", "问题分析", "下一步计划"],
  "pageCount": 12
}
```

---

## 操作步骤

### Step 1: 上传模板
1. 打开 `http://localhost:3000/create`
2. 上传模板 A/B/C
3. 记录：上传是否成功、文件大小、类型

### Step 2: StyleKit 提取
1. 等待 StyleKitWizard 完成
2. 记录：提取耗时、生成的主色/字体/布局
3. 检查是否有重试按钮

### Step 3: 输入需求
1. 选择场景、受众
2. 填写主题、要点
3. 记录：表单验证是否正常

### Step 4: 生成页面
1. 等待 DeckPlan 生成
2. 等待页面渲染完成
3. 记录：生成耗时、页面数量、每页标题

### Step 5: AI 单点修改（7 个指令）
对每个指令执行：
1. 输入指令
2. 记录 AI 返回的 operation
3. 检查 PatchValidator 是否通过
4. 检查 diff preview
5. 确认应用
6. 验证页面变化
7. Ctrl+Z 撤销
8. Ctrl+Shift+Z 重做
9. 记录结果

### Step 6: 导出 PPTX
1. 点击导出
2. 用 PowerPoint / WPS / Keynote 打开
3. 验证每项

---

## 失败记录格式

```markdown
### [编号] 问题标题
- **严重级别**: P0/P1/P2
- **步骤**: 复现步骤
- **期望**: 预期行为
- **实际**: 实际行为
- **截图**: 附件路径
- **涉及文件**: 文件路径
```

---

## 截图/文件保存规范

- 截图：`evidence/screenshots/{模板}_{步骤}_{序号}.png`
- 导出 PPTX：`evidence/exports/{模板}_{主题}_{时间戳}.pptx`
- 日志：`evidence/logs/{模板}_{步骤}.log`
