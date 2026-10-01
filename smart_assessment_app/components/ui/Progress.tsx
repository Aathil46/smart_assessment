import { cn } from '@/lib/utils';

interface ProgressProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'brand' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  className?: string;
  showLabel?: boolean;
  label?: string;
}

const sizeClasses = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-3.5',
};

const variantClasses = {
  brand: 'bg-brand-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  error: 'bg-error-500',
  info: 'bg-info-500',
  neutral: 'bg-slate-900',
};

export function Progress({
  value,
  max = 100,
  size = 'md',
  variant = 'brand',
  className,
  showLabel = false,
  label,
}: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-slate-600">{label}</span>
          <span className="text-xs font-semibold text-slate-900">{Math.round(pct)}%</span>
        </div>
      )}
      <div className={cn('w-full overflow-hidden rounded-full bg-slate-200', sizeClasses[size])}>
        <div
          className={cn('h-full rounded-full transition-all duration-500 ease-out', variantClasses[variant])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
