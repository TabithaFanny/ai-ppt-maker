/**
 * 统一 API 响应格式
 * 所有 API 路由使用 ok()/fail() 确保一致的响应结构
 */

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ success: true, data }, { status });
}

export function fail(error: string, status = 500): Response {
  return Response.json({ success: false, error }, { status });
}
