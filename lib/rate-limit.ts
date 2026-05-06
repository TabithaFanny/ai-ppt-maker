/**
 * 内存滑动窗口速率限制器
 *
 * 单进程内存存储，适合 MVP 阶段。生产环境应使用 Redis 或数据库。
 */

const WINDOW_MS = 60_000; // 1 minute sliding window

interface RateLimitConfig {
  maxRequests: number;
  windowMs?: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

const stores: Map<string, number[]> = new Map();

export function rateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const windowMs = config.windowMs || WINDOW_MS;
  const now = Date.now();
  const cutoff = now - windowMs;

  let timestamps = stores.get(key) || [];
  // 清理过期条目
  timestamps = timestamps.filter((ts) => ts > cutoff);

  if (timestamps.length >= config.maxRequests) {
    const oldest = timestamps[0];
    const resetMs = oldest + windowMs - now;
    return { allowed: false, remaining: 0, resetMs: Math.max(resetMs, 1000) };
  }

  timestamps.push(now);
  stores.set(key, timestamps);

  const remaining = config.maxRequests - timestamps.length;
  return { allowed: true, remaining, resetMs: windowMs };
}

/**
 * 从请求中提取客户端标识符
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return '127.0.0.1';
}

/**
 * 端点速率限制配置
 */
export const RATE_LIMITS = {
  ai: { maxRequests: 5 },
  image: { maxRequests: 3 },
  analysis: { maxRequests: 10 },
  file: { maxRequests: 20 },
  default: { maxRequests: 60 },
} as const;

// 定期清理过期条目（每 5 分钟），防止内存泄漏
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cutoff = Date.now() - WINDOW_MS * 2;
    for (const [key, timestamps] of stores) {
      const filtered = timestamps.filter((ts) => ts > cutoff);
      if (filtered.length === 0) {
        stores.delete(key);
      } else {
        stores.set(key, filtered);
      }
    }
  }, 300_000);
}
