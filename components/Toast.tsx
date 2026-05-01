'use client';

import { useToast } from '@/lib/toast';
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';

export default function Toast() {
  const { toasts, remove } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : toast.type === 'error'
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
          }`}
        >
          {toast.type === 'success' && <CheckCircle size={20} />}
          {toast.type === 'error' && <XCircle size={20} />}
          {toast.type === 'warning' && <AlertTriangle size={20} />}
          <span className="flex-1 text-sm">{toast.message}</span>
          <button onClick={() => remove(toast.id)} className="hover:opacity-70">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
