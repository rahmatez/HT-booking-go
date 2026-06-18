"use client";

import { useState } from "react";
import { AdminHeader } from "./admin-header";
import { AdminSidebar } from "./sidebar";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50" data-shell="admin">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Tutup menu"
        />
      )}

      <AdminSidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AdminHeader onMenuOpen={() => setSidebarOpen(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl animate-fade-up">{children}</div>
        </main>
      </div>
    </div>
  );
}
