"use client";

import { type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useLayoutStore } from "@/lib/stores/useLayoutStore";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const collapsed = useLayoutStore((state) => state.collapsed);

  return (
    <div className="min-h-screen">
      <Sidebar />
      <main
        className={`min-h-screen transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-52"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
