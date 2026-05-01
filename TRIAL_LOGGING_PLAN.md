# 试用日志记录方案

> Phase 12 — 2026-05-01
> 无 PII 采集，仅记录操作行为

---

## 记录原则

1. **不采集个人信息**：不记录用户名、邮箱、IP 地址
2. **不采集文件内容**：不记录上传的 PPT 内容或生成的文字
3. **仅记录操作行为**：记录用户做了什么，不记录具体数据
4. **本地存储**：日志存储在 IndexedDB，不上传到第三方

---

## 事件定义

### 核心流程事件

| 事件名 | 触发时机 | 记录字段 |
|--------|----------|----------|
| `upload_start` | 用户开始上传文件 | `{ fileType, fileSize }` |
| `upload_success` | 上传成功 | `{ fileType, fileSize, duration_ms }` |
| `upload_error` | 上传失败 | `{ fileType, errorType }` |
| `extract_start` | 开始风格提取 | - |
| `extract_complete` | 风格提取完成 | `{ duration_ms, slideCount }` |
| `extract_error` | 风格提取失败 | `{ errorType }` |
| `distill_start` | 开始风格提炼 | - |
| `distill_complete` | 风格提炼完成 | `{ duration_ms }` |
| `generate_start` | 开始生成 PPT | `{ scenario, audience, slideCount }` |
| `generate_complete` | 生成完成 | `{ duration_ms, actualSlideCount }` |
| `generate_error` | 生成失败 | `{ errorType }` |
| `generate_timeout` | 生成超时 | `{ duration_ms }` |

### 编辑事件

| 事件名 | 触发时机 | 记录字段 |
|--------|----------|----------|
| `edit_ai_start` | 用户发起 AI 编辑 | `{ instructionLength }` |
| `edit_ai_complete` | AI 编辑完成 | `{ operationType, duration_ms }` |
| `edit_ai_error` | AI 编辑失败 | `{ errorType }` |
| `edit_manual` | 用户手动编辑 | `{ editType: 'text'\|'move'\|'resize' }` |
| `edit_undo` | 用户撤销 | - |
| `edit_redo` | 用户重做 | - |
| `patch_confirm` | 用户确认补丁 | `{ operationType }` |
| `patch_reject` | 用户拒绝补丁 | `{ operationType }` |

### 导出事件

| 事件名 | 触发时机 | 记录字段 |
|--------|----------|----------|
| `export_start` | 开始导出 | - |
| `export_complete` | 导出完成 | `{ duration_ms, slideCount }` |
| `export_error` | 导出失败 | `{ errorType }` |

### 页面事件

| 事件名 | 触发时机 | 记录字段 |
|--------|----------|----------|
| `page_view` | 页面加载 | `{ page: 'home'\|'create'\|'edit' }` |
| `session_start` | 会话开始 | `{ browser }` |
| `session_end` | 会话结束 | `{ duration_ms }` |

---

## 存储结构

```typescript
interface LogEntry {
  id: string;           // UUID
  event: string;        // 事件名
  timestamp: number;    // Date.now()
  data: Record<string, unknown>;  // 事件数据
  sessionId: string;    // 会话 ID（随机生成，非用户 ID）
}
```

### IndexedDB 表

```typescript
// 在 lib/db.ts 的 Dexie schema 中添加
logs: '++id, event, timestamp, sessionId'
```

---

## 会话管理

```typescript
// 生成会话 ID（每次打开页面生成一个）
const sessionId = crypto.randomUUID();

// 存储在 sessionStorage（关闭标签页即清除）
sessionStorage.setItem('trial_session_id', sessionId);
```

---

## 日志查看（调试用）

在浏览器控制台执行：

```typescript
// 查看所有日志
const logs = await db.logs.toArray();
console.table(logs);

// 查看特定事件
const errors = await db.logs.where('event').endsWith('error').toArray();
console.table(errors);

// 查看会话统计
const sessions = await db.logs.orderBy('sessionId').uniqueKeys();
console.log('总会话数:', sessions.length);
```

---

## 日志清理

- 日志保留 7 天
- 超过 7 天的日志自动清理
- 用户可手动清除所有日志

```typescript
// 清理 7 天前的日志
const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
await db.logs.where('timestamp').below(weekAgo).delete();
```

---

## 数据安全

- 日志不包含任何可识别个人的信息
- 日志不包含文件内容或生成的文字
- 日志仅存储在本地 IndexedDB
- 日志不会上传到任何服务器
- 用户清除浏览器数据即清除所有日志

---

*文档版本: 1.0.0*
*最后更新: 2026-05-01*
