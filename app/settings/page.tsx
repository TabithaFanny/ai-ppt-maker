'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, Save, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import Header from '@/components/shell/Header';
import { getAiMode, setAiMode, getStoredApiKeys, setStoredApiKeys, isMockMode } from '@/lib/api-client';

type AiMode = 'mock' | 'real' | 'auto';

export default function SettingsPage() {
  const [mode, setMode] = useState<AiMode>('mock');
  const [keys, setKeys] = useState({ minimax: '', deepseek: '', openai: '' });
  const [showKeys, setShowKeys] = useState({ minimax: false, deepseek: false, openai: false });
  const [saved, setSaved] = useState(false);
  const [envKeys, setEnvKeys] = useState({ minimax: !!process.env.NEXT_PUBLIC_MINIMAX_API_KEY, deepseek: !!process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY, openai: !!process.env.NEXT_PUBLIC_OPENAI_API_KEY });

  useEffect(() => {
    setMode(getAiMode());
    setKeys(getStoredApiKeys());
  }, []);

  const handleSave = () => {
    setAiMode(mode);
    setStoredApiKeys(keys);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const modeDescriptions: Record<AiMode, { title: string; desc: string }> = {
    mock: { title: 'Mock 模式', desc: '使用模拟数据运行，无需任何 API Key。适合演示和开发测试。' },
    real: { title: 'Real 模式', desc: '使用真实 API Key 调用 AI 服务。需要配置下方 API Key 或环境变量。' },
    auto: { title: 'Auto 模式', desc: '有 API Key 时使用真实调用，无 Key 时自动回退到 Mock 模式。' },
  };

  const hasEnvKeys = envKeys.minimax || envKeys.deepseek || envKeys.openai;
  const hasStoredKeys = !!(keys.minimax || keys.deepseek || keys.openai);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Header />

      {/* 主体 */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[#0f172a] mb-2">设置</h1>
        <p className="text-sm text-[#64748b] mb-8">配置 API Key 和 AI 运行模式</p>

        {/* 当前状态 */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#0f172a]">当前状态</span>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              isMockMode() ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
            }`}>
              {isMockMode() ? 'Mock 模式' : 'Real 模式'}
            </span>
          </div>
          {hasEnvKeys && (
            <p className="text-xs text-[#94a3b8] mt-2">
              检测到环境变量中已配置 API Key（服务端生效）
            </p>
          )}
        </div>

        {/* 模式选择 */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-[#0f172a] mb-4">AI 运行模式</h2>
          <div className="space-y-3">
            {(['mock', 'real', 'auto'] as AiMode[]).map((m) => (
              <label
                key={m}
                className={`block p-4 rounded-xl border cursor-pointer transition-colors ${
                  mode === m ? 'border-[#1e40af] bg-[#1e40af]/5' : 'border-[#e2e8f0] hover:border-[#94a3b8]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="ai-mode"
                    value={m}
                    checked={mode === m}
                    onChange={() => setMode(m)}
                    className="mt-1 accent-[#1e40af]"
                  />
                  <div>
                    <div className="text-sm font-medium text-[#0f172a]">{modeDescriptions[m].title}</div>
                    <div className="text-xs text-[#64748b] mt-0.5">{modeDescriptions[m].desc}</div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* API Key 配置 */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-[#0f172a] mb-1">API Key 配置</h2>
          <p className="text-xs text-[#94a3b8] mb-4">
            配置后保存在浏览器本地存储。服务端 API 路由优先使用环境变量中的 Key。
          </p>

          <div className="space-y-4">
            <ApiKeyInput
              label="MiniMax API Key"
              provider="minimax"
              value={keys.minimax}
              hasEnv={envKeys.minimax}
              show={showKeys.minimax}
              onToggleShow={() => setShowKeys(s => ({ ...s, minimax: !s.minimax }))}
              onChange={(v) => setKeys(k => ({ ...k, minimax: v }))}
            />
            <ApiKeyInput
              label="DeepSeek API Key"
              provider="deepseek"
              value={keys.deepseek}
              hasEnv={envKeys.deepseek}
              show={showKeys.deepseek}
              onToggleShow={() => setShowKeys(s => ({ ...s, deepseek: !s.deepseek }))}
              onChange={(v) => setKeys(k => ({ ...k, deepseek: v }))}
            />
            <ApiKeyInput
              label="OpenAI API Key (图片生成)"
              provider="openai"
              value={keys.openai}
              hasEnv={envKeys.openai}
              show={showKeys.openai}
              onToggleShow={() => setShowKeys(s => ({ ...s, openai: !s.openai }))}
              onChange={(v) => setKeys(k => ({ ...k, openai: v }))}
            />
          </div>
        </div>

        {/* 保存按钮 */}
        <button
          onClick={handleSave}
          className="w-full px-4 py-3 bg-[#1e40af] text-white text-sm font-medium rounded-xl hover:bg-[#1e40af]/90 transition-colors flex items-center justify-center gap-2"
        >
          {saved ? (
            <><Check size={16} /> 已保存</>
          ) : (
            <><Save size={16} /> 保存设置</>
          )}
        </button>

        {/* 提示 */}
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800">
              <p className="font-medium mb-1">说明</p>
              <ul className="list-disc list-inside space-y-1">
                <li>API Key 仅存储在浏览器本地，不会上传到服务器</li>
                <li>服务端 API 路由优先读取环境变量中的 Key</li>
                <li>Mock 模式无需任何配置即可运行全部功能</li>
                <li>Auto 模式会智能切换：有 Key 用 real，无 Key 回退 mock</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApiKeyInput({
  label,
  provider,
  value,
  hasEnv,
  show,
  onToggleShow,
  onChange,
}: {
  label: string;
  provider: string;
  value: string;
  hasEnv: boolean;
  show: boolean;
  onToggleShow: () => void;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium text-[#0f172a] mb-1.5">
        {label}
        {hasEnv && (
          <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">环境变量</span>
        )}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`输入 ${label}`}
          className="w-full px-3 py-2 pr-10 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:border-transparent"
        />
        <button
          onClick={onToggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}
