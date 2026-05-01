# 快速启动指南

## 1. 配置 API Key

编辑 `.env.local` 文件，添加你的 Anthropic API Key：

```bash
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

## 2. 启动开发服务器

```bash
pnpm dev
```

## 3. 访问应用

打开浏览器访问: http://localhost:3000

## 4. 测试流程

### 步骤 1: 上传模板
- 点击"开始创建"
- 上传一个 PPT 模板文件（PDF/PPT/PPTX）

### 步骤 2: AI 分析
- 系统自动分析模板风格
- 提取色彩、字体、布局等设计元素

### 步骤 3: 输入需求
- 填写 PPT 主题（例如：毛绒玩具市场分析）
- 添加关键要点（例如：市场概况、竞争分析、SWOT分析）
- 设置页数（5-50 页）
- 可选择快速模板

### 步骤 4: 编辑内容
- 左侧大纲树：查看所有幻灯片
- 拖拽排序：调整幻灯片顺序
- 右侧编辑器：编辑标题、结论、内容块
- 添加/删除幻灯片

### 步骤 5: 生成预览
- 预览轮播：查看所有幻灯片
- 导出 PPTX：下载 PowerPoint 文件
- 导出 JSON：保存结构化数据
- 分享链接：复制项目链接

## 5. 项目管理

访问 http://localhost:3000/projects 查看所有项目

- 编辑：继续编辑项目
- 复制：创建项目副本
- 删除：删除项目

## 常见问题

### Q: 上传失败？
A: 检查文件大小是否超过 50MB，文件格式是否为 PDF/PPT/PPTX

### Q: AI 分析失败？
A: 检查 API Key 是否正确配置，网络是否正常

### Q: 导出 PPTX 失败？
A: 检查浏览器控制台错误信息，确保内容块位置参数在 0-1 之间

### Q: 数据保存在哪里？
A: 数据保存在浏览器的 IndexedDB 中，清除浏览器数据会丢失项目

## 开发调试

### 查看数据库
打开浏览器开发者工具 → Application → IndexedDB → ai-ppt-generator

### 查看 API 请求
打开浏览器开发者工具 → Network → 筛选 XHR/Fetch

### 查看控制台日志
打开浏览器开发者工具 → Console

## 下一步

- 阅读 [README.md](./README.md) 了解项目详情
- 阅读 [IMPLEMENTATION.md](./IMPLEMENTATION.md) 了解实施进度
- 查看 [计划文档](./计划文档.md) 了解完整路线图
