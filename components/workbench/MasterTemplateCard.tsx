'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Sparkles, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

export default function MasterTemplateCard() {
  const masterTemplate = useStore((s) => s.masterTemplate);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!masterTemplate) return null;

  const { colorSystem, background, sharedDecorations, logo, typography, styleTags, masterPrompt, sourceSlideCount } = masterTemplate;

  const handleCopy = () => {
    navigator.clipboard.writeText(masterPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-[#c7d2fe] bg-gradient-to-br from-[#eef2ff] to-white p-3 shadow-sm">
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#c7d2fe] text-[#4338ca]">
            <Sparkles size={14} />
          </div>
          <div className="text-left">
            <p className="text-[11px] font-semibold text-[#0f172a]">全局母版</p>
            <p className="text-[9px] text-[#64748b]">从 {sourceSlideCount} 页提取</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-[#94a3b8]" /> : <ChevronDown size={14} className="text-[#94a3b8]" />}
      </button>

      {/* Color swatches - always visible */}
      <div className="mt-2 flex items-center gap-1">
        {Object.entries(colorSystem).map(([role, hex]) => (
          <div key={role} className="group relative">
            <div className="h-5 w-5 rounded-full border border-white shadow-sm" style={{ backgroundColor: hex }} title={`${role}: ${hex}`} />
          </div>
        ))}
        {styleTags.length > 0 && (
          <span className="ml-1 text-[9px] text-[#64748b] truncate">{styleTags.slice(0, 3).join('·')}</span>
        )}
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 text-[10px]">
          <div>
            <span className="text-[#94a3b8]">字体</span>
            <p className="text-[#334155]">标题 {typography.titleSize}px {typography.titleWeight} · 正文 {typography.bodySize}px{typography.fontSystem ? ` · ${typography.fontSystem}` : ''}</p>
          </div>

          {background && (
            <div>
              <span className="text-[#94a3b8]">背景</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="h-4 w-8 rounded border" style={{ background: background.colors.length >= 2 ? `linear-gradient(135deg, ${background.colors.join(', ')})` : background.colors[0] || '#fff' }} />
                <span className="text-[#64748b]">{background.type} · {background.description.slice(0, 40)}</span>
              </div>
            </div>
          )}

          {sharedDecorations.length > 0 && (
            <div>
              <span className="text-[#94a3b8]">共享装饰 ({sharedDecorations.length})</span>
              {sharedDecorations.map((d, i) => (
                <p key={i} className="text-[#64748b]">· {d.type} @ {d.position} ({d.appearsOnPercent}%页)</p>
              ))}
            </div>
          )}

          {logo && logo.found && (
            <div>
              <span className="text-[#94a3b8]">Logo</span>
              <p className="text-[#334155]">{logo.description.slice(0, 50)} · {logo.position}</p>
            </div>
          )}

          <button onClick={handleCopy} className="flex items-center gap-1 rounded-lg border border-[#c7d2fe] bg-white px-2 py-1 text-[10px] text-[#4338ca] hover:bg-[#eef2ff]">
            {copied ? <Check size={10} /> : <Copy size={10} />}
            {copied ? '已复制' : '复制母版 Prompt'}
          </button>
        </div>
      )}
    </div>
  );
}
