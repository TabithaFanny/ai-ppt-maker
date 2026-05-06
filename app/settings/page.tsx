'use client';

import { useState, useEffect } from 'react';
import { Save, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import Header from '@/components/shell/Header';
import { getStoredApiKeys, setStoredApiKeys, initEncryptedKeys } from '@/lib/api-client';

export default function SettingsPage() {
  const [keys, setKeys] = useState(() => getStoredApiKeys());
  const [showKeys, setShowKeys] = useState({ minimax: false, deepseek: false, openai: false });
  const [saved, setSaved] = useState(false);

  // 初始化加密 key 存储（迁移明文 → 加密，解密到缓存）
  useEffect(() => {
    initEncryptedKeys().then(() => {
      setKeys(getStoredApiKeys());
    });
  }, []);

  const handleSave = () => {
    setStoredApiKeys(keys);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const envKeys = {
    minimax: !!process.env.NEXT_PUBLIC_MINIMAX_API_KEY,
    deepseek: !!process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY,
    openai: !!process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  };
  const hasEnvKeys = envKeys.minimax || envKeys.deepseek || envKeys.openai;

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <Header />

      {/* 主体 */}
      <main className="mx-auto max-w-4xl px-4 py-8 md:px-8 md:py-10">
        <div className="mb-8 rounded-[28px] border border-[#e2e8f0] bg-gradient-to-br from-white via-[#f8fbff] to-[#eff6ff] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)] md:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-white px-3 py-1 text-[11px] font-medium text-[#1d4ed8] shadow-sm">
            <Save size={12} />
            运行模式与 API 设置
          </div>
          <h1 className="mt-4 text-3xl font-bold text-[#0f172a] md:text-4xl">设置</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#64748b]">
            管理 API Key 配置，确保 AI 服务正常运行。
          </p>
        </div>

        {/* 当前状态 */}
        {hasEnvKeys && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Check size={16} className="text-green-600" />
              <span className="text-sm font-medium text-green-800">API Key 已通过环境变量配置（服务端生效）</span>
            </div>
          </div>
        )}

        {/* API Key 配置 */}
        <div className="mb-6 rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-[#0f172a] mb-1">API Key 配置</h2>
          <p className="text-xs text-[#94a3b8] mb-4">
            本页保存的 Key 仅存储在当前浏览器，用于本地模式判断与兼容旧流程；服务端 API 路由仍需要环境变量中的 Key 才能稳定工作。
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
        <div className="rounded-2xl border border-[#dbeafe] bg-white p-4 shadow-sm">
          <button
            onClick={handleSave}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1e40af] px-4 py-3 text-sm font-medium text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition-colors hover:bg-[#1e40af]/90"
          >
            {saved ? (
              <><Check size={16} /> 已保存</>
            ) : (
              <><Save size={16} /> 保存设置</>
            )}
          </button>
        </div>

        {/* 提示 */}
        <div className="mt-6 rounded-2xl border border-[#dbeafe] bg-[#eff6ff] p-4">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-[#1d4ed8] shrink-0 mt-0.5" />
            <div className="text-xs text-[#475569]">
              <p className="font-medium mb-1 text-[#1d4ed8]">说明</p>
              <ul className="list-disc list-inside space-y-1">
                <li>API Key 仅存储在浏览器本地，不会上传到服务器</li>
                <li>服务端 AI 路由需要环境变量中的 Key 才能正常工作</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ApiKeyInput({
  label,
  provider: _provider,
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
      <label htmlFor={`api-key-${_provider}`} className="flex items-center gap-2 text-sm font-medium text-[#0f172a] mb-1.5">
        {label}
        {hasEnv && (
          <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">环境变量</span>
        )}
      </label>
      <div className="relative">
        <input
          id={`api-key-${_provider}`}
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
