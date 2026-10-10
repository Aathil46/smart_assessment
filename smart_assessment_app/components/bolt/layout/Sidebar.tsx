import { NavLink, useLocation } from '@/components/bolt/router';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import {
  LayoutDashboard, Users, FileText, ClipboardPen, BarChart3,
  Lightbulb, GraduationCap, Building2, BookOpen, Settings,
  Sparkles, ChevronRight, School, UserCog, LineChart, AlertCircle, Target,
  UserCircle,
} from 'lucide-react';
import type { Role } from '@/types';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
}

const navByRole: Record<Role, { section: string; items: NavItem[] }[]> = {
  teacher: [
    {
      section: 'Overview',
      items: [
        { to: '/teacher', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      section: 'Teaching',
      items: [
        { to: '/teacher/classes', label: 'Classes', icon: Users },
        { to: '/teacher/materials', label: 'Learning Materials', icon: FileText },
        { to: '/teacher/assessments', label: 'Assessments', icon: ClipboardPen },
        { to: '/teacher/results', label: 'Results & Analytics', icon: BarChart3 },
        { to: '/teacher/insights', label: 'AI Teaching Insights', icon: Lightbulb },
      ],
    },
    {
      section: 'Account',
      items: [
        { to: '/teacher/profile', label: 'My Profile', icon: UserCircle },
      ],
    },
  ],
  student: [
    {
      section: 'Overview',
      items: [
        { to: '/student', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      section: 'Learning',
      items: [
        { to: '/student/classes', label: 'My Classes', icon: BookOpen },
        { to: '/student/assessments', label: 'Assessments', icon: ClipboardPen },
        { to: '/student/results', label: 'My Results', icon: BarChart3 },
        { to: '/student/practice', label: 'Practice', icon: Sparkles },
      ],
    },
    {
      section: 'Account',
      items: [
        { to: '/student/profile', label: 'My Profile', icon: UserCircle },
      ],
    },
  ],
  principal: [
    {
      section: 'Overview',
      items: [
        { to: '/principal', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      section: 'School Analytics',
      items: [
        { to: '/principal/classes', label: 'Class Performance', icon: School },
        { to: '/principal/teachers', label: 'Teacher Performance', icon: UserCog },
        { to: '/principal/assessments', label: 'Assessment Results', icon: ClipboardPen },
        { to: '/principal/weak-students', label: 'Weak Students', icon: AlertCircle, badge: '14' },
        { to: '/principal/interventions', label: 'Interventions', icon: Target },
        { to: '/principal/insights', label: 'AI Review', icon: Sparkles },
      ],
    },
  ],
};

const roleConfig: Record<Role, { label: string; icon: typeof GraduationCap }> = {
  teacher: { label: 'Teacher', icon: GraduationCap },
  student: { label: 'Student', icon: BookOpen },
  principal: { label: 'Principal', icon: Building2 },
};

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { role } = useApp();
  const location = useLocation();
  const nav = navByRole[role];

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden animate-fade-in" onClick={onClose} />
      )}
      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 z-40 h-screen w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-100 flex-shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
            <LineChart className="h-5 w-5" />
          </div>
          <div>
            <span className="text-base font-bold text-slate-900 tracking-tight">AssessAI</span>
            <span className="block text-2xs text-slate-400 font-medium leading-none">Smart Assessment</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 no-scrollbar">
          {nav.map((section) => (
            <div key={section.section} className="mb-6">
              <p className="px-3 mb-2 text-2xs font-semibold uppercase tracking-wider text-slate-400">
                {section.section}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === `/${role}`}
                    onClick={onClose}
                    className={({ isActive }) => {
                      const isAssessmentResultsPage = location.pathname.startsWith('/teacher/assessments/') && location.pathname !== '/teacher/assessments/create';
                      let active = isActive;
                      if (isAssessmentResultsPage) {
                        if (item.to === '/teacher/results') active = true;
                        if (item.to === '/teacher/assessments') active = false;
                      }
                      return cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group',
                        active
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      );
                    }}
                  >
                    {({ isActive }) => {
                      const isAssessmentResultsPage = location.pathname.startsWith('/teacher/assessments/') && location.pathname !== '/teacher/assessments/create';
                      let active = isActive;
                      if (isAssessmentResultsPage) {
                        if (item.to === '/teacher/results') active = true;
                        if (item.to === '/teacher/assessments') active = false;
                      }
                      return (
                        <>
                          <item.icon className={cn('h-4.5 w-4.5 flex-shrink-0', active ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600')} />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && (
                            <span className="px-1.5 py-0.5 rounded-full text-2xs font-bold bg-error-50 text-error-600 border border-error-200">
                              {item.badge}
                            </span>
                          )}
                          {active && <ChevronRight className="h-3.5 w-3.5 text-brand-500" />}
                        </>
                      );
                    }}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-50">
            {(() => {
              const rc = roleConfig[role];
              return (
                <>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-600 border border-slate-200">
                    <rc.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700">{rc.label} Portal</p>
                    <p className="text-2xs text-slate-400 truncate">Oakridge High School</p>
                  </div>
                  <Settings className="h-4 w-4 text-slate-400" />
                </>
              );
            })()}
          </div>
        </div>
      </aside>
    </>
  );
}
