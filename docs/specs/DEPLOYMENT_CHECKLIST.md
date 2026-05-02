# 部署检查清单

> Phase 11 — 2026-05-01

---

## 环境变量

| 变量 | 位置 | 必需 | 说明 |
|------|------|------|------|
| `MINIMAX_API_KEY` | `.env.local` | ✅ | MiniMax API Key，仅服务端 |
| `OPENAI_API_KEY` | `.env.local` | 可选 | 图片生成用 |
| `MINIMAX_MODEL` | `.env.local` | 可选 | 默认 `MiniMax-M2.7` |

**检查项**：
- [x] `.env.local` 在 `.gitignore` 中（已确认）
- [ ] API Key 仅在服务端 API 路由中使用，不暴露给客户端
- [ ] 生产环境通过 Vercel/环境变量注入，不使用 `.env.local`

---

## 构建与启动

```bash
# 安装依赖
pnpm install

# 类型检查
npx tsc --noEmit

# 测试
pnpm test

# 构建
pnpm build

# 启动
pnpm start
```

---

## 文件上传目录

- 上传目录：`uploads/`（项目根目录下）
- 生产环境需要持久化存储
- 建议：使用 S3/OSS 替代本地文件系统

---

## 安全检查

| 项目 | 状态 | 说明 |
|------|------|------|
| API Key 仅服务端 | ✅ | 仅在 API 路由中使用 |
| `.env.local` 不提交 | ✅ | `.gitignore` 已配置 |
| 上传文件扩展名校验 | ✅ | 只允许 pdf/ppt/pptx |
| 上传文件大小限制 | ✅ | 50MB |
| XSS 防护 | ✅ | React 默认转义 |
| SSRF 防护 | ⚠️ | 无服务端请求外部 URL |
| CSRF 防护 | ⚠️ | 无显式 CSRF token |
| 速率限制 | ❌ | 未实现 |
| 输入消毒（AI prompt） | ⚠️ | 用户输入直接拼入 prompt |

---

## 跨浏览器测试

| 浏览器 | 需测试 |
|--------|--------|
| Chrome | ✅ 主要开发浏览器 |
| Edge | 需测试 |
| Safari | 需测试 |
| Firefox | 需测试 |

---

## 生产环境禁用项

- [ ] 移除 `console.log` 调试信息
- [ ] 移除 development-only 错误详情
- [ ] 确认 NODE_ENV=production

---

## 日志与监控

- 当前：`console.error` 记录错误
- 建议：接入 Sentry 或类似错误监控
