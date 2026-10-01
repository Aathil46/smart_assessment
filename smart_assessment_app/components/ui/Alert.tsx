import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  variant: AlertVariant;
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

const variantConfig: Record<AlertVariant, { bg: string; border: string; text: string; icon: ReactNode; iconBg: string }> = {
  info: {
    bg: 'bg-info-50',
    border: 'border-info-200',
    text: 'text-info-800',
    iconBg: 'bg-info-100 text-info-600',
    icon: <Info className="h-4.5 w-4.5" />,
  },
  success: {
    bg: 'bg-success-50',
    border: 'border-success-200',
    text: 'text-success-800',
    iconBg: 'bg-success-100 text-success-600',
    icon: <CheckCircle2 className="h-4.5 w-4.5" />,
  },
  warning: {
    bg: 'bg-warning-50',
    border: 'border-warning-200',
    text: 'text-warning-800',
    iconBg: 'bg-warning-100 text-warning-600',
    icon: <AlertTriangle className="h-4.5 w-4.5" />,
  },
  error: {
    bg: 'bg-error-50',
    border: 'border-error-200',
    text: 'text-error-800',
    iconBg: 'bg-error-100 text-error-600',
    icon: <XCircle className="h-4.5 w-4.5" />,
  },
};

export function Alert({ variant, title, children, className, action }: AlertProps) {
  const config = variantConfig[variant];
  return (
    <div className={cn('flex gap-3 rounded-xl border p-4 animate-fade-in', config.bg, config.border, className)}>
      <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', config.iconBg)}>
        {config.icon}
      </div>
      <div className="flex-1">
        {title && <p className={cn('text-sm font-semibold mb-0.5', config.text)}>{title}</p>}
        <div className={cn('text-sm', config.text, 'opacity-90')}>{children}</div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
