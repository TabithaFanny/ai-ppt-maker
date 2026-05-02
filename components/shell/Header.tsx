'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { getAiMode } from '@/lib/api-client';

const NAV_ITEMS = [
  { href: '/', label: '首页' },
  { href: '/create', label: '创建' },
  { href: '/projects', label: '项目' },
  { href: '/settings', label: '设置' },
];

interface HeaderProps {
  /** Override active link (e.g., when used inside a page that has sub-routes) */
  activeHref?: string;
}

export default function Header({ activeHref }: HeaderProps) {
  const pathname = usePathname();
  const current = activeHref ?? pathname;

  return (
    <header className="bg-white border-b border-[#e2e8f0]">
      <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#1e40af] rounded-lg flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="text-base font-semibold text-[#0f172a]">AI PPT Generator</span>
          <ModeBadge />
        </div>
        <nav className="flex items-center gap-8">
          {NAV_ITEMS.map(({ href, label }) => {
            const isActive = current === href || (href !== '/' && current.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`text-sm transition-colors ${
                  isActive
                    ? 'text-[#1e40af] border-b-2 border-[#1e40af] pb-1'
                    : 'text-[#64748b] hover:text-[#0f172a]'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

function ModeBadge() {
  const mode = getAiMode();
  const config: Record<string, { label: string; color: string }> = {
    mock: { label: 'Mock', color: 'bg-yellow-100 text-yellow-700' },
    real: { label: 'Real', color: 'bg-green-100 text-green-700' },
    auto: { label: 'Auto', color: 'bg-blue-100 text-blue-700' },
  };
  const { label, color } = config[mode] || config.auto;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {label}
    </span>
  );
}
