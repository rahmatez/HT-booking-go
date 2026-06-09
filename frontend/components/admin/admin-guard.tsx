"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useAuthStore } from "@/lib/auth-store";
import { useAuthHydrated } from "@/lib/use-auth-hydrated";
import { isAdminRole } from "@/lib/admin-utils";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const { user, accessToken } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;
    if (!accessToken) {
      router.replace("/auth/login?redirect=/admin");
    }
  }, [hydrated, accessToken, router]);

  if (!hydrated) {
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

  if (!accessToken) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-stone-100 text-stone-500"
        data-shell="admin"
      >
        <Spinner className="h-6 w-6" />
        <span className="text-sm">Mengalihkan ke login...</span>
      </div>
    );
  }

  if (!isAdminRole(user?.role)) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-100 px-6 text-center"
        data-shell="admin"
      >
        <p className="text-lg font-semibold text-stone-800">Akses ditolak</p>
        <p className="max-w-sm text-sm text-stone-500">
          Akun Anda tidak memiliki izin untuk mengakses panel admin.
        </p>
        <Link href="/" className="text-sm font-medium text-(--accent) hover:underline">
          Kembali ke beranda
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
