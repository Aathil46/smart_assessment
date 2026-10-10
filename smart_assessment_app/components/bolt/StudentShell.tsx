"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { AppProvider } from "@/context/AppContext";
import { Sidebar } from "@/components/bolt/layout/Sidebar";
import { TopBar } from "@/components/bolt/layout/TopBar";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function StudentShell({ children, profile }: { children: ReactNode; profile?: any }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AppProvider initialRole="student">
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onMenuClick={() => setSidebarOpen(true)} profile={profile} />
          <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </AppProvider>
  );
}
