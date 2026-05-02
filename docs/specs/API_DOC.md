# AI PPT 生成平台 - API 文档

## 目录

- [概述](#概述)
- [基础信息](#基础信息)
- [API 端点](#api-端点)
- [类型定义](#类型定义)
- [错误处理](#错误处理)
- [示例](#示例)

---

## 概述

本文档描述 AI PPT 生成平台的 REST API 接口。所有 API 均使用 JSON 格式进行请求和响应。

### 基础 URL

```
http://localhost:3000/api
```

### 认证

API 使用 `ANTHROPIC_API_KEY` 环境变量进行认证，无需在请求头中添加 Token。

---

## 基础信息

### 请求格式

| 端点 | 方法 | Content-Type |
|------|------|--------------|
| `/upload` | POST | multipart/form-data |
| `/analyze` | POST | application/json |
| `/generate-ppt` | POST | application/json |
| `/generate-stream` | POST | text/event-stream |

### 响应格式

#### 成功响应

```json
{
  "key": "value"
}
```

#### 错误响应

```json
{
  "error": "错误描述",
  "status": 400
}
```

---

## API 端点

### 1. 文件上传

**端点**: `/api/upload`
**方法**: POST
**Content-Type**: multipart/form-data

#### 请求

| 字段 | 类型 | 说明 | 必填 |
|------|------|------|------|
| file | File | 上传的文件 | 是 |

#### 支持的文件类型

- PDF (.pdf)
- PowerPoint (.ppt)
- PowerPoint XML (.pptx)

#### 文件限制

- 最大大小: 50MB

#### 响应成功 (200)

```json
{
  "fileId": "550e8400-e29b-41d4-a716-446655440000",
  "url": "/uploads/550e8400-e29b-41d4-a716-446655440000.pdf",
  "name": "template.pptx",
  "size": 1024000,
  "type": "pptx",
  "firstPagePdf": "base64...",
  "thumbnails": ["base64...", "base64...", "base64..."]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| fileId | string | 文件唯一标识符 |
| url | string | 文件访问路径 |
| name | string | 原始文件名 |
| size | number | 文件大小（字节） |
| type | string | 文件类型 (pdf/ppt/pptx) |
| firstPagePdf | string | PDF 第一页（仅 PDF）base64 |
| thumbnails | string[] | 前 3 页缩略图 base64（仅 PDF） |

#### 响应错误 (400/500)

```json
{
  "error": "没有文件",
  "status": 400
}
```

---

### 2. 风格分析

**端点**: `/api/analyze`
**方法**: POST
**Content-Type**: application/json

#### 请求

```json
{
  "fileId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| 字段 | 类型 | 说明 | 必填 |
|------|------|------|------|
| fileId | string | 上传后返回的文件 ID | 是 |

#### 响应成功 (200)

```json
{
  "overallStyle": "business",
  "palette": {
    "primary": "#1a1a2e",
    "secondary": "#16213e",
    "accent": "#0f3460",
    "background": "#ffffff",
    "text": "#333333"
  },
  "typography": {
    "titleFont": "Arial",
    "bodyFont": "Calibri",
    "titleSize": 44,
    "bodySize": 18
  },
  "layout": {
    "type": "double",
    "spacing": 1.5,
    "padding": 0.2
  },
  "designPrinciples": ["简洁", "专业", "数据驱动"]
}
```

#### StyleConfig 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| overallStyle | string | 整体风格: business/tech/creative/academic |
| palette | object | 色彩方案 |
| palette.primary | string | 主色 (HEX) |
| palette.secondary | string | 辅色 (HEX) |
| palette.accent | string | 强调色 (HEX) |
| palette.background | string | 背景色 (HEX) |
| palette.text | string | 文字色 (HEX) |
| typography | object | 字体排版 |
| typography.titleFont | string | 标题字体 |
| typography.bodyFont | string | 正文字体 |
| typography.titleSize | number | 标题字号 |
| typography.bodySize | number | 正文字号 |
| layout | object | 布局配置 |
| layout.type | string | 布局类型: single/double/full/centered |
| layout.spacing | number | 行间距 |
| layout.padding | number | 内边距 |
| designPrinciples | string[] | 设计原则关键词 |

#### 响应错误 (400/500)

```json
{
  "error": "分析失败",
  "status": 500
}
```

---

### 3. PPT 生成（非流式）

**端点**: `/api/generate-ppt`
**方法**: POST
**Content-Type**: application/json

#### 请求

```json
{
  "styleConfig": {
    "overallStyle": "business",
    "palette": {...},
    "typography": {...},
    "layout": {...},
    "designPrinciples": ["简洁", "专业"]
  },
  "userInput": {
    "topic": "毛绒玩具市场分析",
    "description": "分析毛绒玩具市场现状和竞争格局",
    "keyPoints": ["市场概况", "竞争分析", "SWOT分析"],
    "pageCount": 10,
    "specialRequirements": "使用图表展示数据",
    "template": "business"
  }
}
```

#### UserInput 字段说明

| 字段 | 类型 | 说明 | 必填 |
|------|------|------|------|
| topic | string | PPT 主题，1-100 字 | 是 |
| description | string | 详细描述，50-500 字 | 否 |
| keyPoints | string[] | 关键要点列表 | 是 |
| pageCount | number | 页数，5-50 | 是 |
| specialRequirements | string | 特殊要求 | 否 |
| template | string | 快速模板: product/academic/business | 否 |

#### 响应成功 (200)

```json
{
  "metadata": {
    "projectId": "550e8400-e29b-41d4-a716-446655440000",
    "title": "毛绒玩具市场分析",
    "category": "商业分析",
    "audience": "企业决策者",
    "createdAt": "2026-04-27T10:00:00Z"
  },
  "designSystem": {
    "palette": {...},
    "typography": {...}
  },
  "roles": {
    "designer": "资深 PPT 设计师",
    "contentStrategist": "内容策略专家",
    "visualDirector": "视觉总监"
  },
  "slides": [
    {
      "id": "slide-1",
      "layout": "title",
      "title": "毛绒玩具市场分析",
      "mainConclusion": "毛绒玩具市场呈快速增长趋势",
      "content": [
        {
          "id": "block-1",
          "type": "text",
          "content": "市场概况...",
          "position": {"x": 0.1, "y": 0.3, "width": 0.8, "height": 0.3},
          "style": {"fontSize": 18, "fontWeight": "normal", "align": "left"}
        }
      ]
    }
  ]
}
```

#### PPTJson 结构说明

| 字段 | 类型 | 说明 |
|------|------|------|
| metadata | object | 项目元数据 |
| metadata.projectId | string | 项目 ID |
| metadata.title | string | 标题 |
| metadata.category | string | 类别 |
| metadata.audience | string | 受众 |
| metadata.createdAt | string | 创建时间 |
| designSystem | object | 设计系统 |
| designSystem.palette | object | 色彩方案 |
| designSystem.typography | object | 字体排版 |
| roles | object | AI 角色定义 |
| roles.designer | string | 设计师角色 |
| roles.contentStrategist | string | 内容策略师角色 |
| roles.visualDirector | string | 视觉总监角色 |
| slides | Slide[] | 幻灯片数组 |

#### Slide 结构说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 幻灯片 ID |
| layout | string | 布局类型: title/content/image/chart/quote |
| title | string | 标题 |
| mainConclusion | string | 核心结论（一页一结论） |
| content | ContentBlock[] | 内容块数组 |

#### ContentBlock 结构说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 内容块 ID |
| type | string | 类型: text/image/chart/list |
| content | string | 内容 |
| position | object | 位置和尺寸（相对坐标 0-1） |
| position.x | number | X 坐标 |
| position.y | number | Y 坐标 |
| position.width | number | 宽度 |
| position.height | number | 高度 |
| style | object | 样式（可选） |
| style.fontSize | number | 字号 |
| style.fontWeight | string | 字重 |
| style.color | string | 颜色 |
| style.align | string | 对齐: left/center/right |

#### 响应错误 (400/500)

```json
{
  "error": "生成失败",
  "status": 500
}
```

---

### 4. PPT 生成（流式/SSE）

**端点**: `/api/generate-stream`
**方法**: POST
**Content-Type**: application/json
**Response-Type**: text/event-stream

#### 请求

与 `/api/generate-ppt` 相同。

```json
{
  "styleConfig": {...},
  "userInput": {...}
}
```

#### 流式响应事件

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

#### 事件格式

```typescript
// 分析阶段
data: {"stage":"analyzing","progress":0}

// 转译阶段
data: {"stage":"translating","progress":33}

// 生成阶段
data: {"stage":"generating","progress":66}

// 完成
data: {"stage":"complete","progress":100,"data":{...pptJson}}

// 错误
data: {"stage":"error","error":"生成失败"}
```

#### 阶段说明

| stage | progress | 说明 |
|-------|----------|------|
| analyzing | 0 | 正在分析风格 |
| translating | 33 | 正在转译需求 |
| generating | 66 | 正在生成 PPT JSON |
| complete | 100 | 完成，返回 pptJson |
| error | - | 发生错误 |

#### 客户端示例

```typescript
async function generateWithStream(styleConfig, userInput) {
  const response = await fetch('/api/generate-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ styleConfig, userInput }),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        console.log(`进度: ${data.progress}%`, data.stage);

        if (data.stage === 'complete') {
          return data.data; // 返回 pptJson
        }

        if (data.stage === 'error') {
          throw new Error(data.error);
        }
      }
    }
  }
}
```

---

## 类型定义

### Project

```typescript
interface Project {
  id: string;
  userId?: string;
  title: string;
  status: 'draft' | 'analyzing' | 'generating' | 'completed';
  templateFileId?: string;
  styleConfig?: StyleConfig;
  userInput?: UserInput;
  pptJson?: PPTJson;
  createdAt: number;
  updatedAt: number;
}
```

### StyleConfig

```typescript
interface StyleConfig {
  overallStyle: 'business' | 'tech' | 'creative' | 'academic';
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  typography: {
    titleFont: string;
    bodyFont: string;
    titleSize: number;
    bodySize: number;
  };
  layout: {
    type: 'single' | 'double' | 'full' | 'centered';
    spacing: number;
    padding: number;
  };
  designPrinciples: string[];
}
```

### UserInput

```typescript
interface UserInput {
  topic: string;
  description?: string;
  keyPoints: string[];
  pageCount: number;
  specialRequirements?: string;
  template?: 'product' | 'academic' | 'business';
}
```

### PPTJson

```typescript
interface PPTJson {
  metadata: {
    projectId: string;
    title: string;
    category: string;
    audience: string;
    createdAt: string;
  };
  designSystem: {
    palette: StyleConfig['palette'];
    typography: StyleConfig['typography'];
  };
  roles: {
    designer: string;
    contentStrategist: string;
    visualDirector: string;
  };
  slides: Slide[];
}
```

### Slide

```typescript
interface Slide {
  id: string;
  layout: 'title' | 'content' | 'image' | 'chart' | 'quote';
  title: string;
  mainConclusion: string;
  content: ContentBlock[];
}
```

### ContentBlock

```typescript
interface ContentBlock {
  id: string;
  type: 'text' | 'image' | 'chart' | 'list';
  content: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  style?: {
    fontSize?: number;
    fontWeight?: string;
    color?: string;
    align?: 'left' | 'center' | 'right';
  };
}
```

### UploadedFile

```typescript
interface UploadedFile {
  id: string;
  projectId: string;
  type: 'pdf' | 'ppt' | 'pptx';
  url: string;
  name: string;
  size: number;
  thumbnails?: string[];
  uploadedAt: number;
}
```

---

## 错误处理

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 500 | 服务器内部错误 |

### 错误消息

| 错误消息 | 说明 |
|----------|------|
| 没有文件 | 请求中没有包含文件 |
| 不支持的文件类型 | 文件格式不是 PDF/PPT/PPTX |
| 文件过大 | 文件大小超过 50MB |
| 分析失败 | AI 风格分析失败 |
| 生成失败 | PPT 生成失败 |

### 错误响应格式

```json
{
  "error": "错误描述",
  "status": 400
}
```

---

## 示例

### cURL 示例

#### 上传文件

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@template.pptx"
```

#### 分析风格

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"fileId": "550e8400-e29b-41d4-a716-446655440000"}'
```

#### 生成 PPT

```bash
curl -X POST http://localhost:3000/api/generate-ppt \
  -H "Content-Type: application/json" \
  -d '{
    "styleConfig": {
      "overallStyle": "business",
      "palette": {"primary": "#1a1a2e", "secondary": "#16213e", "accent": "#0f3460", "background": "#ffffff", "text": "#333333"},
      "typography": {"titleFont": "Arial", "bodyFont": "Calibri", "titleSize": 44, "bodySize": 18},
      "layout": {"type": "double", "spacing": 1.5, "padding": 0.2},
      "designPrinciples": ["简洁", "专业"]
    },
    "userInput": {
      "topic": "毛绒玩具市场分析",
      "keyPoints": ["市场概况", "竞争分析", "SWOT分析"],
      "pageCount": 10
    }
  }'
```

### JavaScript 示例

#### 文件上传

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
console.log('fileId:', result.fileId);
```

#### 风格分析

```javascript
const response = await fetch('/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fileId: '550e8400-e29b-41d4-a716-446655440000' }),
});

const styleConfig = await response.json();
console.log('风格:', styleConfig.overallStyle);
```

#### PPT 生成（带进度）

```javascript
const response = await fetch('/api/generate-stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ styleConfig, userInput }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = decoder.decode(value);
  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      updateProgressBar(data.progress);
      if (data.stage === 'complete') {
        return data.data;
      }
    }
  }
}
```

### Python 示例

#### 文件上传

```python
import requests

with open('template.pptx', 'rb') as f:
    files = {'file': f}
    response = requests.post('http://localhost:3000/api/upload', files=files)

result = response.json()
print('fileId:', result['fileId'])
```

#### PPT 生成

```python
import requests

data = {
    'styleConfig': {
        'overallStyle': 'business',
        'palette': {
            'primary': '#1a1a2e',
            'secondary': '#16213e',
            'accent': '#0f3460',
            'background': '#ffffff',
            'text': '#333333'
        },
        'typography': {
            'titleFont': 'Arial',
            'bodyFont': 'Calibri',
            'titleSize': 44,
            'bodySize': 18
        },
        'layout': {
            'type': 'double',
            'spacing': 1.5,
            'padding': 0.2
        },
        'designPrinciples': ['简洁', '专业']
    },
    'userInput': {
        'topic': '毛绒玩具市场分析',
        'keyPoints': ['市场概况', '竞争分析', 'SWOT分析'],
        'pageCount': 10
    }
}

response = requests.post('http://localhost:3000/api/generate-ppt', json=data)
ppt_json = response.json()
print('生成', len(ppt_json['slides']), '页')
```

---

## 附录

### 流式响应兼容性

部分 HTTP 客户端默认会缓冲整个响应，导致无法实时显示进度。确保使用支持流式响应的客户端：

- 原生 fetch API
- 支持流式响应的 HTTP 库

### API 限流

暂无限流配置，请合理使用 API，避免短时间内大量请求。

### 下一步

- 部署应用到生产环境: 参见 [DEPLOY.md](./DEPLOY.md)
- 完整使用指南: 参见 [USER_GUIDE.md](./USER_GUIDE.md)
