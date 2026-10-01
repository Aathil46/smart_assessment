"use client";

import type { ReactNode } from "react";

import { AppProvider } from "@/context/AppContext";
import { Sidebar } from "@/components/bolt/layout/Sidebar";
import { TopBar } from "@/components/bolt/layout/TopBar";
import { useState } from "react";

export function TeacherShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AppProvider>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onMenuClick={() => setSidebarOpen(true)} />
          <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </AppProvider>
  );
}