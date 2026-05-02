'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles } from 'lucide-react';

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
