# 项目导入/导出功能

## 实现概述

为 AI PPT 生成平台添加了完整的项目导入/导出功能，支持单个项目导出、批量导出和 JSON 文件导入。

## 新增文件

### `/lib/import-export.ts`
核心导入导出逻辑：
- `exportProject(projectId)` - 导出单个项目为 JSON
- `exportAll()` - 导出所有项目为 JSON
- `importData(jsonString)` - 从 JSON 导入项目
- `downloadJSON(data, filename)` - 触发浏览器下载

## 修改文件

### `/app/projects/page.tsx`
添加了导入/导出 UI：
- 顶部工具栏新增"导入"和"导出全部"按钮
- 每个项目卡片新增"导出"按钮（FileJson 图标）
- 隐藏的文件输入框支持 `.json` 文件上传
- 导入状态显示（"导入中..."）

## 功能特性

### 1. 单项目导出
- 点击项目卡片上的 FileJson 图标
- 自动下载 `项目名_日期.json` 文件
- 包含项目数据和关联文件

### 2. 批量导出
- 点击顶部"导出全部"按钮
- 下载 `所有项目_日期.json` 文件
- 包含所有项目和文件数据

### 3. 导入项目
- 点击"导入"按钮选择 JSON 文件
- 自动验证文件格式
- 为导入的项目生成新 ID（避免冲突）
- 显示导入结果（成功/失败数量）

## 数据格式

```json
{
  "version": "1.0",
  "exportedAt": 1735344000000,
  "projects": [
    {
      "id": "uuid",
      "title": "项目名称",
      "status": "completed",
      "styleConfig": {...},
      "userInput": {...},
      "pptJson": {...},
      "createdAt": 1735344000000,
      "updatedAt": 1735344000000
    }
  ],
  "files": [
    {
      "id": "uuid",
      "projectId": "uuid",
      "type": "pdf",
      "url": "...",
      "name": "文件名",
      "size": 1024,
      "uploadedAt": 1735344000000
    }
  ]
}
```

## 错误处理

- JSON 格式验证
- 缺少必需字段检测
- 导入失败时显示错误信息
- 部分导入成功时显示统计

## 构建状态

✅ `npm run build` 编译通过（1.58s）
✅ TypeScript 类型检查通过（1.37s）
✅ 所有路由生成成功

## 使用场景

1. **数据备份** - 定期导出所有项目作为备份
2. **项目迁移** - 在不同设备间转移项目
3. **团队协作** - 分享项目给其他用户
4. **数据恢复** - 从备份文件恢复项目
