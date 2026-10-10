"use client";

import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "@/components/bolt/router";
import { cn } from "@/lib/utils";
import { useApp } from "@/context/AppContext";
import { Avatar } from "@/components/ui/Avatar";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/Dropdown";
import {
  Bell, Menu, Search, Settings, LogOut, User as UserIcon,
  GraduationCap, BookOpen, Building2, ChevronRight, Sparkles,
  X, CheckCircle2, BarChart2, ClipboardCheck, UserPlus, BellOff,
} from "lucide-react";
import { notifications as mockNotifications } from "@/data/mockData";
import type { Role } from "@/types";

interface TeacherNotificationItem {
  id: string;
  type: "assessment_completed" | "results_available" | "student_submission" | "ai_insight" | "student_joined";
  title: string;
  description: string;
  timestamp: string;
  rawTimestamp?: string;
  actionUrl: string;
}

const roleSwitchLabels: Record<Role, { label: string; icon: typeof GraduationCap }> = {
  teacher: { label: "Teacher", icon: GraduationCap },
  student: { label: "Student", icon: BookOpen },
  principal: { label: "Principal", icon: Building2 },
};

const pageTitles: Record<string, string> = {
  "/teacher": "Dashboard",
  "/teacher/classes": "Classes",
  "/teacher/materials": "Learning Materials",
  "/teacher/assessments": "Assessments",
  "/teacher/results": "Results & Analytics",
  "/teacher/insights": "AI Teaching Insights",
  "/teacher/profile": "My Profile",
  "/student": "Dashboard",
  "/student/classes": "My Classes",
  "/student/assessments": "Assessments",
  "/student/results": "My Results",
  "/student/practice": "Practice",
  "/student/profile": "My Profile",
  "/principal": "Dashboard",
  "/principal/classes": "Class Performance",
  "/principal/teachers": "Teacher Performance",
  "/principal/assessments": "Assessment Results",
  "/principal/weak-students": "Weak Students",
  "/principal/interventions": "Action & Interventions",
  "/principal/insights": "AI Review",
};

interface TopBarProps {
  onMenuClick: () => void;
  profile?: any;
}

export function TopBar({ onMenuClick, profile }: TopBarProps) {
  const { user: mockUser, role } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const currentPath = location.pathname;

  // Teacher notifications state
  const [teacherNotifications, setTeacherNotifications] = useState<TeacherNotificationItem[]>([]);
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());
  const [isRinging, setIsRinging] = useState(false);
  const prevCountRef = useRef<number | null>(null);

  // Fetch real notifications for teacher role
  useEffect(() => {
    if (role !== "teacher") return;
    let cancelled = false;

    async function loadNotifications() {
      try {
        const res = await fetch("/api/teacher/notifications");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const list: TeacherNotificationItem[] = data.notifications ?? [];
        setTeacherNotifications(list);

        // Ring bell once when new notifications arrive
        if (list.length > 0 && (prevCountRef.current === null || list.length > prevCountRef.current)) {
          setIsRinging(true);
          const timer = setTimeout(() => setIsRinging(false), 1400);
          return () => clearTimeout(timer);
        }
        prevCountRef.current = list.length;
      } catch (err) {
        console.error("Failed to load notifications:", err);
      }
    }

    loadNotifications();
    return () => {
      cancelled = true;
    };
  }, [role]);

  // Handle dismiss with smooth exit animation
  const handleDismiss = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDismissingIds((prev) => new Set(prev).add(id));

    setTimeout(() => {
      setTeacherNotifications((prev) => prev.filter((item) => item.id !== id));
      setDismissingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 280);

    try {
      await fetch("/api/teacher/notifications/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
    } catch (err) {
      console.error("Failed to persist dismissed notification:", err);
    }
  };

  // Profile data
  const displayUser = profile ? {
    name: profile.name,
    email: profile.email,
    avatar: profile.avatar_url || profile.name?.split(" ").filter(Boolean).slice(0, 2).map((n: string) => n[0]).join("").toUpperCase() || "U",
    isRealUrl: !!profile.avatar_url,
  } : {
    ...mockUser,
    isRealUrl: false,
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        window.location.href = "/login";
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const title = pageTitles[currentPath] || "Dashboard";
  const unreadCount = role === "teacher"
    ? teacherNotifications.length
    : mockNotifications.filter((n) => !n.read).length;

  const breadcrumbs = [{ label: role.charAt(0).toUpperCase() + role.slice(1), path: `/${role}` }];
  if (role === "teacher" && currentPath.startsWith("/teacher/assessments/") && currentPath !== "/teacher/assessments/create") {
    breadcrumbs.push({ label: "Results & Analytics", path: "/teacher/results" });
    breadcrumbs.push({ label: "Assessment Results", path: currentPath });
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
            <span className={cn(i === breadcrumbs.length - 1 ? "font-semibold text-slate-900" : "text-slate-500")}>
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

        {/* ─── Notification Dropdown ─── */}
        <Dropdown
          closeOnClick={false}
          trigger={
            <button
              aria-label="Notifications"
              className={cn(
                "relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors",
                unreadCount > 0 && "animate-bell-ring-continuous"
              )}
            >
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
          <div className="w-[88vw] sm:w-96 max-w-sm">
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-2xs font-bold text-teal-700 bg-teal-50 border border-teal-200/80 px-2 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
            </div>
            <DropdownSeparator />

            {/* Notification items container */}
            <div className="max-h-80 sm:max-h-96 overflow-y-auto divide-y divide-slate-100">
              {role === "teacher" ? (
                teacherNotifications.length > 0 ? (
                  teacherNotifications.map((n) => {
                    const isDismissing = dismissingIds.has(n.id);

                    return (
                      <div
                        key={n.id}
                        onClick={() => navigate(n.actionUrl)}
                        className={cn(
                          "group relative flex items-start gap-3 p-3 hover:bg-slate-50 transition-all duration-300 cursor-pointer",
                          isDismissing && "opacity-0 -translate-x-3 max-h-0 py-0 my-0 overflow-hidden pointer-events-none"
                        )}
                      >
                        {/* Icon */}
                        <div
                          className={cn(
                            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border mt-0.5 transition-transform group-hover:scale-105",
                            n.type === "assessment_completed" && "bg-emerald-50 text-emerald-600 border-emerald-100",
                            n.type === "results_available" && "bg-blue-50 text-blue-600 border-blue-100",
                            n.type === "student_submission" && "bg-purple-50 text-purple-600 border-purple-100",
                            n.type === "ai_insight" && "bg-amber-50 text-amber-600 border-amber-100",
                            n.type === "student_joined" && "bg-teal-50 text-teal-600 border-teal-100"
                          )}
                        >
                          {n.type === "assessment_completed" && <CheckCircle2 className="h-4 w-4" />}
                          {n.type === "results_available" && <BarChart2 className="h-4 w-4" />}
                          {n.type === "student_submission" && <ClipboardCheck className="h-4 w-4" />}
                          {n.type === "ai_insight" && <Sparkles className="h-4 w-4" />}
                          {n.type === "student_joined" && <UserPlus className="h-4 w-4" />}
                        </div>

                        {/* Text Content */}
                        <div className="flex-1 min-w-0 pr-6">
                          <p className="text-xs font-semibold text-slate-900 group-hover:text-teal-700 transition-colors line-clamp-1">
                            {n.title}
                          </p>
                          <p className="text-2xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                            {n.description}
                          </p>
                          <p className="text-2xs text-slate-400 mt-1 font-medium">
                            {n.timestamp}
                          </p>
                        </div>

                        {/* Dismiss Button */}
                        <button
                          type="button"
                          onClick={(e) => handleDismiss(e, n.id)}
                          title="Dismiss notification"
                          aria-label="Dismiss notification"
                          className="absolute top-2.5 right-2.5 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors opacity-80 sm:opacity-0 group-hover:opacity-100"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 px-4 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mx-auto mb-2">
                      <BellOff className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700">All caught up!</p>
                    <p className="text-2xs text-slate-400 mt-0.5">No new notifications right now.</p>
                  </div>
                )
              ) : (
                /* Fallback for other roles */
                mockNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "px-3 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer",
                      !n.read && "bg-brand-50/50"
                    )}
                  >
                    <div className="flex gap-2.5">
                      <div
                        className={cn(
                          "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg",
                          n.read ? "bg-slate-100 text-slate-400" : "bg-brand-100 text-brand-600"
                        )}
                      >
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
                ))
              )}
            </div>
          </div>
        </Dropdown>

        {/* ─── Profile Menu ─── */}
        <Dropdown
          trigger={
            <button className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100 transition-colors">
              {displayUser.isRealUrl ? (
                <img src={displayUser.avatar} alt={displayUser.name} className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <Avatar initials={displayUser.avatar} size="sm" color="brand" />
              )}
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-slate-900 leading-tight">{displayUser.name}</p>
                <p className="text-2xs text-slate-400 leading-tight">{roleSwitchLabels[role].label}</p>
              </div>
            </button>
          }
        >
          <div className="w-56">
            <div className="px-3 py-2">
              <p className="text-sm font-semibold text-slate-900">{displayUser.name}</p>
              <p className="text-xs text-slate-500">{displayUser.email}</p>
            </div>
            <DropdownSeparator />
            <div className="px-3 py-2 text-xs text-slate-500">
              Signed in as {roleSwitchLabels[role].label}
            </div>
            <DropdownSeparator />
            <DropdownItem icon={<UserIcon className="h-4 w-4" />} onClick={() => navigate(`/${role}/profile`)}>
              Profile
            </DropdownItem>
            <DropdownItem icon={<Settings className="h-4 w-4" />} onClick={() => navigate(`/${role}/profile`)}>
              Settings
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem icon={<LogOut className="h-4 w-4" />} danger onClick={handleLogout}>
              Sign Out
            </DropdownItem>
          </div>
        </Dropdown>
      </div>
    </header>
  );
}
