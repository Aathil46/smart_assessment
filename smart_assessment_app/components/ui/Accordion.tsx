import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionItemProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  icon?: ReactNode;
  badge?: ReactNode;
}

export function AccordionItem({ title, children, defaultOpen = false, icon, badge }: AccordionItemProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="text-sm font-semibold text-slate-900">{title}</span>
          {badge}
        </div>
        <ChevronDown className={cn('h-4.5 w-4.5 text-slate-400 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <div className={cn('overflow-hidden transition-all duration-300', open ? 'max-h-[1000px]' : 'max-h-0')}>
        <div className="p-4 pt-0 border-t border-slate-100">{children}</div>
      </div>
    </div>
  );
}
