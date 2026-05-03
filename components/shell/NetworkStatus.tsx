'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { logger } from '@/lib/logger';

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [showOnline, setShowOnline] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowOnline(true);
      logger.info('Network restored');
      setTimeout(() => setShowOnline(false), 2500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOnline(false);
      logger.warn('Network disconnected');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showOnline) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 py-2.5 px-4 text-center z-50 text-sm font-medium transition-all duration-500 ${
        !isOnline
          ? 'bg-red-500 text-white opacity-100'
          : 'bg-green-500 text-white opacity-100'
      }`}
    >
      <div className="flex items-center justify-center gap-2">
        {!isOnline ? (
          <>
            <WifiOff size={18} />
            <span>网络连接已断开，请检查网络设置</span>
          </>
        ) : (
          <>
            <Wifi size={18} />
            <span>网络已恢复</span>
          </>
        )}
      </div>
    </div>
  );
}
