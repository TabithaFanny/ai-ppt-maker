'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';

const NAV_ITEMS = [
  { href: '/', label: '首页' },
  { href: '/projects', label: '项目' },
  { href: '/templates', label: '模板库' },
  { href: '/settings', label: '设置' },
];

interface HeaderProps {
  /** Override active link (e.g., when used inside a page that has sub-routes) */
  activeHref?: string;
}

export default function Header({ activeHref }: HeaderProps) {
  const pathname = usePathname();
  const current = activeHref ?? pathname;
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <header className="bg-[var(--color-surface-secondary)] border-b border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#1e40af] rounded-lg flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="text-base font-semibold text-[var(--color-text-primary)]">AI PPT Generator</span>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          {NAV_ITEMS.map(({ href, label }) => {
            const isActive = current === href || (href !== '/' && current.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex items-center min-h-[44px] text-sm transition-colors ${
                  isActive
                    ? 'text-[#1e40af] border-b-2 border-[#1e40af] pb-1'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {label}
              </Link>
            );
          })}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/30 transition-colors"
            aria-label={isDark ? '切换到亮色模式' : '切换到暗色模式'}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </nav>
      </div>
    </header>
  );
}

