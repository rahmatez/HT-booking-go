"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useAuthStore } from "@/lib/auth-store";
import { isAdminRole } from "@/lib/admin-utils";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!accessToken) {
      router.replace("/auth/login?redirect=/admin");
      return;
    }
    if (!isAdminRole(user?.role)) {
      router.replace("/");
    }
  }, [ready, accessToken, user?.role, router]);

  if (!ready || !accessToken || !isAdminRole(user?.role)) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-stone-100 text-stone-500"
        data-shell="admin"
      >
        <Spinner className="h-6 w-6" />
        <span className="text-sm">Memuat panel admin...</span>
      </div>
    );
  }

  return <>{children}</>;
}
