import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Minus } from 'lucide-react';

type StatusType = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'pending';

interface StatusIndicatorProps {
  status: StatusType;
  label: string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

const config: Record<StatusType, { color: string; bg: string; icon: ReactNode }> = {
  success: { color: 'text-success-700', bg: 'bg-success-50 border-success-200', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  warning: { color: 'text-warning-700', bg: 'bg-warning-50 border-warning-200', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  error: { color: 'text-error-700', bg: 'bg-error-50 border-error-200', icon: <XCircle className="h-3.5 w-3.5" /> },
  info: { color: 'text-info-700', bg: 'bg-info-50 border-info-200', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  neutral: { color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', icon: <Minus className="h-3.5 w-3.5" /> },
  pending: { color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200', icon: <Minus className="h-3.5 w-3.5" /> },
};

export function StatusIndicator({ status, label, size = 'sm', showIcon = true, className }: StatusIndicatorProps) {
  const c = config[status];
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border font-medium',
      size === 'sm' ? 'px-2 py-0.5 text-2xs' : 'px-2.5 py-1 text-xs',
      c.bg, c.color, className
    )}>
      {showIcon && c.icon}
      {label}
    </span>
  );
}

export function MasteryIndicator({ mastery }: { mastery: 'strong' | 'medium' | 'weak' }) {
  const config = {
    strong: { color: 'text-success-600', bg: 'bg-success-500', label: 'Strong' },
    medium: { color: 'text-warning-600', bg: 'bg-warning-500', label: 'Medium' },
    weak: { color: 'text-error-600', bg: 'bg-error-500', label: 'Weak' },
  };
  const c = config[mastery];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={cn('h-2 w-2 rounded-full', c.bg)} />
      <span className={c.color}>{c.label}</span>
    </span>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-soft-lg p-6 animate-scale-in">
        <h2 className="text-base font-semibold text-slate-900 mb-2">{title}</h2>
        <p className="text-sm text-slate-500 mb-5">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={cn(
              'h-9 px-4 rounded-lg text-sm font-medium text-white transition-colors',
              danger ? 'bg-error-600 hover:bg-error-700' : 'bg-brand-600 hover:bg-brand-700'
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AIProcessingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-end gap-0.5 h-5">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="w-1 rounded-full bg-brand-500 animate-ai-wave"
            style={{ height: '100%', animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <span className="text-sm text-slate-600">{label}</span>
    </div>
  );
}

export function AIProcessingOverlay({ visible, label }: { visible: boolean; label: string }) {
  if (!visible) return null;
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl animate-fade-in">
      <div className="flex items-end gap-1 h-8 mb-4">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="w-1.5 rounded-full bg-brand-500 animate-ai-wave"
            style={{ height: '100%', animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
      <p className="text-sm font-medium text-slate-700">{label}</p>
    </div>
  );
}

export function useToggle(initial = false) {
  const [value, setValue] = useState(initial);
  const toggle = () => setValue(v => !v);
  return [value, toggle, setValue] as const;
}
