'use client';

import { Home, FolderOpen, Plus, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', icon: Home, label: '首页' },
    { href: '/create', icon: Plus, label: '创建' },
    { href: '/projects', icon: FolderOpen, label: '项目' },
    { href: '/settings', icon: Settings, label: '设置' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t md:hidden z-50">
      <div className="flex justify-around items-center h-16">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center flex-1 h-full ${
                isActive ? 'text-blue-600' : 'text-gray-600'
              }`}
            >
              <Icon size={24} />
              <span className="text-xs mt-1">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
