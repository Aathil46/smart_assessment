import { cn } from '@/lib/utils';

interface AvatarProps {
  initials: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  className?: string;
}

const sizeClasses = {
  xs: 'h-6 w-6 text-2xs',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

const colorClasses: Record<string, string> = {
  brand: 'bg-brand-100 text-brand-700',
  info: 'bg-info-100 text-info-700',
  accent: 'bg-accent-100 text-accent-700',
  success: 'bg-success-100 text-success-700',
  warning: 'bg-warning-100 text-warning-700',
  error: 'bg-error-100 text-error-700',
  slate: 'bg-slate-200 text-slate-700',
};

export function Avatar({ initials, size = 'md', color = 'slate', className }: AvatarProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full font-semibold flex-shrink-0',
        sizeClasses[size],
        colorClasses[color] || colorClasses.slate,
        className
      )}
    >
      {initials}
    </div>
  );
}
