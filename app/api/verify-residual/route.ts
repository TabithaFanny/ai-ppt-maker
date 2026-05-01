import { NextRequest } from 'next/server';
import { performResidualCheck, getTotalIssueCount, getCriticalIssueCount } from '@/lib/residual-checker';
import { PPTJson } from '@/types';
import { ok, fail } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const { pptJson } = await request.json();

    if (!pptJson) {
      return fail('缺少 pptJson', 400);
    }

    const checks = performResidualCheck(pptJson as PPTJson);

    return ok({
      totalIssues: getTotalIssueCount(checks),
      criticalIssues: getCriticalIssueCount(checks),
      checks,
    });
  } catch (error) {
    console.error('残差验证失败:', error);
    return fail(error instanceof Error ? error.message : '残差验证失败');
  }
}
