import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  trend?: { value: string; direction: 'up' | 'down' | 'neutral' };
  color?: 'brand' | 'info' | 'accent' | 'success' | 'warning' | 'error';
  className?: string;
}

const colorClasses: Record<string, { bg: string; text: string }> = {
  brand: { bg: 'bg-brand-50', text: 'text-brand-600' },
  info: { bg: 'bg-info-50', text: 'text-info-600' },
  accent: { bg: 'bg-accent-50', text: 'text-accent-600' },
  success: { bg: 'bg-success-50', text: 'text-success-600' },
  warning: { bg: 'bg-warning-50', text: 'text-warning-600' },
  error: { bg: 'bg-error-50', text: 'text-error-600' },
};

export function StatCard({ label, value, unit, icon, trend, color = 'brand', className }: StatCardProps) {
  const c = colorClasses[color];
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start justify-between mb-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', c.bg, c.text)}>
          {icon}
        </div>
        {trend && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
            trend.direction === 'up' && 'bg-success-50 text-success-600',
            trend.direction === 'down' && 'bg-error-50 text-error-600',
            trend.direction === 'neutral' && 'bg-slate-100 text-slate-500',
          )}>
            {trend.direction === 'up' && <TrendingUp className="h-3 w-3" />}
            {trend.direction === 'down' && <TrendingDown className="h-3 w-3" />}
            {trend.direction === 'neutral' && <Minus className="h-3 w-3" />}
            {trend.value}
          </div>
        )}
      </div>
      <p className="text-2xs font-medium text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900 tabular-nums">
        {value}{unit && <span className="text-base font-medium text-slate-400 ml-1">{unit}</span>}
      </p>
    </Card>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

interface SectionTitleProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function SectionTitle({ title, description, action, className }: SectionTitleProps) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  );
}
