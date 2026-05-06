import { NextRequest } from 'next/server';

const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const BLT_KEY = process.env.BLT_API_KEY || '';
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const BLT_BASE_URL = process.env.BLT_API_BASE_URL || process.env.BLT_BASE_URL || 'https://api.bltcy.ai/v1';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';

export async function GET(_request: NextRequest) {
  const checks: Record<string, { ok: boolean; ms?: number; error?: string }> = {};

  // Vision API check (lightweight models endpoint, not a full chat)
  const visionKey = BLT_KEY || OPENAI_KEY;
  const visionBaseUrl = BLT_KEY ? BLT_BASE_URL : OPENAI_BASE_URL;
  if (visionKey) {
    const t0 = Date.now();
    try {
      const res = await fetch(`${visionBaseUrl}/models`, {
        headers: { Authorization: `Bearer ${visionKey}` },
        signal: AbortSignal.timeout(8000),
      });
      checks.vision = { ok: res.ok, ms: Date.now() - t0, error: res.ok ? undefined : `${res.status}` };
    } catch (e) {
      checks.vision = { ok: false, ms: Date.now() - t0, error: e instanceof Error ? e.message : 'fetch failed' };
    }
  } else {
    checks.vision = { ok: false, error: 'no API key configured' };
  }

  // DeepSeek check
  if (DEEPSEEK_KEY) {
    const t0 = Date.now();
    try {
      const res = await fetch(`${DEEPSEEK_BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${DEEPSEEK_KEY}` },
        signal: AbortSignal.timeout(8000),
      });
      checks.deepseek = { ok: res.ok, ms: Date.now() - t0, error: res.ok ? undefined : `${res.status}` };
    } catch (e) {
      checks.deepseek = { ok: false, ms: Date.now() - t0, error: e instanceof Error ? e.message : 'fetch failed' };
    }
  } else {
    checks.deepseek = { ok: false, error: 'no API key configured' };
  }

  const allOk = Object.values(checks).every((c) => c.ok);

  return Response.json({ ok: allOk, checks }, { status: allOk ? 200 : 503 });
}
