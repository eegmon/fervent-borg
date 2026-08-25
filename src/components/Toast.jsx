import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({ toasts = [], onDismiss }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column-reverse', gap: 10, alignItems: 'flex-end',
      pointerEvents: 'none'
    }}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [toast.id]);

  const colors = {
    success: { bg: '#052e16', border: '#16a34a', icon: '#4ade80', text: '#bbf7d0' },
    error:   { bg: '#2b0000', border: '#dc2626', icon: '#f87171', text: '#fecaca' },
    info:    { bg: '#0c1a2e', border: '#3b82f6', icon: '#60a5fa', text: '#bfdbfe' },
    warning: { bg: '#1c1200', border: '#f59e0b', icon: '#fbbf24', text: '#fef3c7' },
  };
  const c = colors[toast.type] || colors.info;
  const Icon = toast.type === 'success' ? CheckCircle : toast.type === 'error' ? AlertCircle : Info;

  return (
    <div style={{
      pointerEvents: 'all',
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '12px 14px',
      borderRadius: 12,
      border: `1px solid ${c.border}`,
      background: c.bg,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      maxWidth: 380,
      animation: 'toastIn 0.25s ease',
    }}>
      <Icon size={18} color={c.icon} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, fontSize: '0.82rem', color: c.text, lineHeight: 1.5 }}>
        {toast.message}
      </div>
      <button onClick={() => onDismiss(toast.id)} style={{
        background: 'none', border: 'none', cursor: 'pointer', color: c.icon, padding: 0, flexShrink: 0
      }}>
        <X size={14} />
      </button>
    </div>
  );
}
