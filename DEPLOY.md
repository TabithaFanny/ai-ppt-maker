# AI PPT 生成平台 - 部署指南

## 目录

- [环境配置](#环境配置)
- [部署到 Vercel](#部署到-vercel)
- [部署到 Docker](#部署到-docker)
- [生产环境检查清单](#生产环境检查清单)
- [监控和日志](#监控和日志)
- [故障排除](#故障排除)

---

## 环境配置

### 必需环境变量

| 变量名 | 说明 | 示例 | 必填 |
|--------|------|------|------|
| `ANTHROPIC_API_KEY` | Anthropic API Key | `sk-ant-xxxxx` | 是 |
| `ANTHROPIC_API_URL` | API 端点（可选） | `https://api.anthropic.com` | 否 |

### 获取 API Key

1. 访问 https://console.anthropic.com/
2. 注册/登录账户
3. 在 API Keys 页面创建新 Key
4. 复制并保存到 `.env.local`

### 本地开发环境

```bash
# 克隆项目
git clone https://github.com/your-repo/ai-ppt-generator.git
cd ai-ppt-generator

# 安装依赖
pnpm install

# 创建环境变量文件
cp .env.example .env.local
# 编辑 .env.local 填入 API Key

# 启动开发服务器
pnpm dev
```

### .env.example 示例

```bash
# Anthropic API Key（必需）
ANTHROPIC_API_KEY=sk-ant-xxxxx

# API URL（可选，默认使用官方端点）
# ANTHROPIC_API_URL=https://api.anthropic.com
```

---

## 部署到 Vercel

### 方式一: Vercel CLI

```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录 Vercel
vercel login

# 部署（项目根目录执行）
vercel

# 设置环境变量
vercel env add ANTHROPIC_API_KEY

# 生产环境部署
vercel --prod
```

### 方式二: Git 集成

1. 将项目推送到 GitHub/GitLab
2. 访问 https://vercel.com/new
3. 导入项目仓库
4. 配置环境变量:
   - 进入 Project Settings
   - 添加 `ANTHROPIC_API_KEY`
5. 点击 Deploy

### Vercel 配置文件

`vercel.json`（可选）:

```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["iad1"]
}
```

### Vercel 环境变量

在 Vercel Dashboard 中配置:

1. 进入 Project → Settings → Environment Variables
2. 添加变量:
   - Name: `ANTHROPIC_API_KEY`
   - Value: 你的 API Key
3. 选择 Environment: Production, Preview, Development
4. 保存

### Vercel 注意事项

1. **上传文件处理**: Vercel 无持久化文件系统，上传文件需要:
   - 使用云存储（如 Vercel Blob、AWS S3）
   - 或修改 `app/api/upload/route.ts` 使用云存储

2. **函数超时**: 默认超时 10 秒，复杂操作可能需要更长
3. **Edge Functions**: 不支持，需要使用 Serverless Functions

---

## 部署到 Docker

### Dockerfile

在项目根目录创建 `Dockerfile`:

```dockerfile
FROM node:20-alpine AS base

# 安装依赖
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/*/package.json packages/
RUN pnpm install --frozen-lockfile

# 构建
FROM deps AS builder
WORKDIR /app
COPY . .
RUN pnpm build

# 运行
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### Docker Compose

`docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 构建和运行

```bash
# 构建镜像
docker build -t ai-ppt-generator .

# 运行容器
docker run -d \
  --name ai-ppt-generator \
  -p 3000:3000 \
  -e ANTHROPIC_API_KEY=sk-ant-xxxxx \
  ai-ppt-generator

# 或使用 docker-compose
docker-compose up -d
```

### Docker 环境变量

```bash
# 创建 .env 文件
cat > .env << EOF
ANTHROPIC_API_KEY=sk-ant-xxxxx
EOF

# 使用 env 文件运行
docker run --env-file .env -d ai-ppt-generator
```

### 多阶段构建优化

Dockerfile 使用多阶段构建:
- `deps`: 安装依赖
- `builder`: 构建应用
- `runner`: 运行最小化镜像

最终镜像不包含源代码和构建工具。

---

## 生产环境检查清单

### 上线前检查

- [ ] `ANTHROPIC_API_KEY` 已配置
- [ ] Node.js 版本 >= 18
- [ ] pnpm 版本 >= 8
- [ ] 构建成功 (pnpm build)
- [ ] TypeScript 无错误 (pnpm tsc --noEmit)
- [ ] ESLint 通过 (pnpm lint)
- [ ] 所有环境变量已配置

### 安全检查

- [ ] API Key 存储在环境变量，未硬编码
- [ ] `.env.local` 已添加到 `.gitignore`
- [ ] 生产环境关闭调试模式
- [ ] 文件上传限制已设置（50MB）
- [ ] CORS 配置正确

### 性能检查

- [ ] 启用生产模式 (`NODE_ENV=production`)
- [ ] 静态资源使用 CDN
- [ ] 图片已优化
- [ ] 代码分割已启用
- [ ] 虚拟滚动已启用

---

## 监控和日志

### 健康检查端点

添加 `app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
```

### 日志配置

#### Winston 日志（可选）

```bash
pnpm add winston
```

创建 `lib/logger.ts`:

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

export default logger;
```

### Vercel 日志

Vercel 自动收集:
- 函数日志
- 性能指标
- 错误追踪

访问 Vercel Dashboard → Project → Logs

### Docker 日志

```bash
# 查看日志
docker logs ai-ppt-generator

# 实时日志
docker logs -f ai-ppt-generator

# 查看错误日志
docker logs ai-ppt-generator --tail 100 --stderr
```

### 结构化日志格式

```json
{
  "timestamp": "2026-04-27T10:00:00.000Z",
  "level": "error",
  "message": "API request failed",
  "method": "POST",
  "path": "/api/generate-ppt",
  "error": "生成失败",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## 故障排除

### 常见部署问题

#### 1. 构建失败

**错误**: `pnpm build` 失败

**解决方案**:
```bash
# 清除缓存
rm -rf .next node_modules/.cache

# 重新安装依赖
rm -rf node_modules
pnpm install

# 重新构建
pnpm build
```

#### 2. API Key 无效

**错误**: `401 Unauthorized` 或 `Invalid API Key`

**解决方案**:
1. 检查 API Key 是否正确
2. 检查 Key 是否有额度
3. 验证环境变量是否正确加载

#### 3. 上传文件失败

**错误**: 文件上传返回 500

**解决方案**:
1. 检查上传目录权限
2. 检查磁盘空间
3. Vercel 环境需要使用云存储

#### 4. 函数超时

**错误**: 504 Gateway Timeout

**解决方案**:
- 优化 Claude API 调用
- 添加进度推送（SSE）
- 增加超时时间

#### 5. CORS 错误

**错误**: `Access-Control-Allow-Origin` 错误

**解决方案**:
Vercel 默认已配置 CORS，无需额外配置。

#### 6. Docker 容器启动失败

**错误**: `Module not found` 或端口冲突

**解决方案**:
```bash
# 端口冲突
docker ps  # 检查端口占用
docker stop $(docker ps -aq)  # 停止所有容器

# 重新构建
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 环境变量问题

#### 查看环境变量是否加载

```typescript
// 添加调试端点
app/api/debug/route.ts:
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasApiKey: !!process.env.ANTHROPIC_API_KEY,
    nodeEnv: process.env.NODE_ENV,
    platform: process.env.platform,
  });
}
```

#### Vercel 环境变量不生效

1. 重新部署: Settings → Environment Variables → Save → Redeploy
2. 检查变量名称是否完全匹配
3. 确保选择正确的 Environment（Production/Preview/Development）

### 性能问题

#### 首屏加载慢

**解决方案**:
1. 检查是否启用了代码分割
2. 优化图片大小
3. 启用静态资源缓存
4. 使用 Vercel Edge Network

#### Claude API 响应慢

**解决方案**:
1. 减少 Prompt 长度
2. 优化 Prompt 模板
3. 添加请求缓存
4. 使用流式响应改善体验

---

## 附录

### 推荐的部署架构

```
                    ┌─────────────────┐
                    │   Vercel/CDN    │
                    │   (静态资源)    │
                    └────────┬────────┘
                             │
                             ▼
┌────────┐     ┌─────────────────┐     ┌─────────────────┐
│  用户   │────▶│  Vercel/AWS ECS  │────▶│  Claude API     │
│        │     │  (Next.js App)   │     │                │
└────────┘     └────────┬────────┘     └─────────────────┘
                        │
                        ▼
               ┌─────────────────┐
               │  云存储 (S3)    │
               │  (上传文件)     │
               └─────────────────┘
```

### 扩展建议

1. **文件存储**: 使用 AWS S3/Vercel Blob 替代本地存储
2. **数据库**: 使用 PostgreSQL + Prisma 替代 IndexedDB
3. **缓存**: 添加 Redis 缓存层
4. **CDN**: 配置自定义域名 + CDN
5. **监控**: 集成 Sentry/LogRocket
6. **CI/CD**: 配置自动部署工作流

### 相关文档

- [USER_GUIDE.md](./USER_GUIDE.md) - 用户手册
- [API_DOC.md](./API_DOC.md) - API 文档
- [PROJECT_STATUS.md](./PROJECT_STATUS.md) - 项目状态
