import { NextRequest, NextResponse } from 'next/server';
import { isMockMode } from '@/lib/api-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider } = body as { provider?: 'minimax' | 'deepseek' | 'openai' };

    if (isMockMode()) {
      return NextResponse.json({
        success: true,
        provider: provider || 'auto',
        mode: 'mock',
        message: 'Mock 模式下测试连接成功',
      });
    }

    // 根据 provider 测试不同 API
    if (!provider || provider === 'minimax') {
      const apiKey = process.env.MINIMAX_API_KEY;
      const baseUrl = process.env.MINIMAX_BASE_URL || 'https://api.minimax.chat/v1';
      if (!apiKey) {
        return NextResponse.json({ success: false, provider: 'minimax', error: 'API Key 未配置' });
      }
      try {
        const response = await fetch(`${baseUrl}/text/chatcompletion_v2`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model: 'MiniMax-M2.7', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] }),
        });
        if (response.ok) {
          return NextResponse.json({ success: true, provider: 'minimax', mode: 'real' });
        }
        return NextResponse.json({ success: false, provider: 'minimax', error: `HTTP ${response.status}` });
      } catch (e) {
        return NextResponse.json({ success: false, provider: 'minimax', error: String(e) });
      }
    }

    if (provider === 'deepseek') {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
      if (!apiKey) {
        return NextResponse.json({ success: false, provider: 'deepseek', error: 'API Key 未配置' });
      }
      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model: 'deepseek-chat', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] }),
        });
        if (response.ok) {
          return NextResponse.json({ success: true, provider: 'deepseek', mode: 'real' });
        }
        return NextResponse.json({ success: false, provider: 'deepseek', error: `HTTP ${response.status}` });
      } catch (e) {
        return NextResponse.json({ success: false, provider: 'deepseek', error: String(e) });
      }
    }

    if (provider === 'openai') {
      const apiKey = process.env.BLT_API_KEY || process.env.OPENAI_API_KEY;
      const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.bltcy.ai/v1';
      if (!apiKey) {
        return NextResponse.json({ success: false, provider: 'openai', error: 'BLT_API_KEY 或 OPENAI_API_KEY 未配置' });
      }
      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model: 'gpt-4o', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] }),
        });
        if (response.ok) {
          return NextResponse.json({ success: true, provider: 'openai', mode: 'real' });
        }
        return NextResponse.json({ success: false, provider: 'openai', error: `HTTP ${response.status}` });
      } catch (e) {
        return NextResponse.json({ success: false, provider: 'openai', error: String(e) });
      }
    }

    return NextResponse.json({ success: false, error: '未知 provider' });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) });
  }
}