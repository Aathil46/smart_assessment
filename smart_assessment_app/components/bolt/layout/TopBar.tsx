import { useLocation } from '@/components/bolt/router';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import { Avatar } from '@/components/ui/Avatar';
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/Dropdown';
import {
  Bell, Menu, Search, Settings, LogOut, User as UserIcon,
  GraduationCap, BookOpen, Building2, ChevronRight, Sparkles,
} from 'lucide-react';
import { notifications } from '@/data/mockData';
import type { Role } from '@/types';

const roleSwitchLabels: Record<Role, { label: string; icon: typeof GraduationCap }> = {
  teacher: { label: 'Teacher', icon: GraduationCap },
  student: { label: 'Student', icon: BookOpen },
  principal: { label: 'Principal', icon: Building2 },
};

const pageTitles: Record<string, string> = {
  '/teacher': 'Dashboard',
  '/teacher/classes': 'Classes',
  '/teacher/materials': 'Learning Materials',
  '/teacher/assessments': 'Assessments',
  '/teacher/results': 'Results & Analytics',
  '/teacher/insights': 'AI Teaching Insights',
  '/student': 'Dashboard',
  '/student/classes': 'My Classes',
  '/student/assessments': 'Assessments',
  '/student/results': 'My Results',
  '/student/practice': 'Practice',
  '/principal': 'Dashboard',
  '/principal/classes': 'Class Performance',
  '/principal/teachers': 'Teacher Performance',
  '/principal/assessments': 'Assessment Results',
  '/principal/weak-students': 'Weak Students',
  '/principal/interventions': 'Action & Interventions',
  '/principal/insights': 'AI Review',
};

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { user, role } = useApp();
  const location = useLocation();

  const currentPath = location.pathname;
  const title = pageTitles[currentPath] || 'Dashboard';
  const unreadCount = notifications.filter(n => !n.read).length;

  const breadcrumbs = [{ label: role.charAt(0).toUpperCase() + role.slice(1), path: `/${role}` }];
  if (role === 'teacher' && currentPath.startsWith('/teacher/assessments/') && currentPath !== '/teacher/assessments/create') {
    breadcrumbs.push({ label: 'Results & Analytics', path: '/teacher/results' });
    breadcrumbs.push({ label: 'Assessment Results', path: currentPath });
  } else if (currentPath !== `/${role}`) {
    breadcrumbs.push({ label: title, path: currentPath });
  }

  return (
    <header className="sticky top-0 z-20 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center px-4 lg:px-6 gap-4">
      <button
        onClick={onMenuClick}
        className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden sm:flex items-center gap-2 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <div key={crumb.path} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300" />}
            <span className={cn(i === breadcrumbs.length - 1 ? 'font-semibold text-slate-900' : 'text-slate-500')}>
              {crumb.label}
            </span>
          </div>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div className="hidden md:flex items-center relative">
          <Search className="absolute left-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            className="h-9 w-48 lg:w-64 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all"
          />
        </div>

        <Dropdown
          trigger={
            <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
              <Bell className="h-4.5 w-4.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-error-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-error-500" />
                </span>
              )}
            </button>
          }
        >
          <div className="w-80">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm font-semibold text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-2xs font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <DropdownSeparator />
            <div className="max-h-72 overflow-y-auto">
              {notifications.map(n => (
                <div key={n.id} className={cn('px-3 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer', !n.read && 'bg-brand-50/50')}>
                  <div className="flex gap-2.5">
                    <div className={cn('flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg', n.read ? 'bg-slate-100 text-slate-400' : 'bg-brand-100 text-brand-600')}>
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-900">{n.title}</p>
                      <p className="text-xs text-slate-500 truncate">{n.message}</p>
                      <p className="text-2xs text-slate-400 mt-0.5">{n.time}</p>
                    </div>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-brand-500 flex-shrink-0 mt-2" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Dropdown>

        <Dropdown
          trigger={
            <button className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100 transition-colors">
              <Avatar initials={user.avatar} size="sm" color="brand" />
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-slate-900 leading-tight">{user.name}</p>
                <p className="text-2xs text-slate-400 leading-tight">{roleSwitchLabels[role].label}</p>
              </div>
            </button>
          }
        >
          <div className="w-56">
            <div className="px-3 py-2">
              <p className="text-sm font-semibold text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <DropdownSeparator />
            <div className="px-3 py-2 text-xs text-slate-500">
              Signed in as {roleSwitchLabels[role].label}
            </div>
            <DropdownSeparator />
            <DropdownItem icon={<UserIcon className="h-4 w-4" />}>Profile</DropdownItem>
            <DropdownItem icon={<Settings className="h-4 w-4" />}>Settings</DropdownItem>
            <DropdownSeparator />
            <DropdownItem icon={<LogOut className="h-4 w-4" />} danger>Sign Out</DropdownItem>
          </div>
        </Dropdown>
      </div>
    </header>
  );
}
