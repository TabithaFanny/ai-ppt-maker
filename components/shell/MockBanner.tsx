'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, X } from 'lucide-react';
import { isMockMode } from '@/lib/api-client';

export default function MockBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(isMockMode());
  }, []);

  if (!visible) return null;

  return (
    <div className="bg-orange-500 text-white">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle size={16} className="shrink-0" />
          <span className="text-sm font-medium">
            Mock 数据模式 — AI 分析与生成结果均为预设假数据，不代表真实效果
          </span>
          <Link
            href="/settings"
            className="text-sm underline underline-offset-2 hover:text-orange-100 shrink-0"
          >
            切换到 Real 模式
          </Link>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="shrink-0 ml-4 p-1 hover:bg-orange-600 rounded"
          aria-label="关闭横幅"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
