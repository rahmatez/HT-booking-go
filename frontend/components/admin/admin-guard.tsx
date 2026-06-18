"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useAuthStore } from "@/lib/auth-store";
import { useAuthHydrated } from "@/lib/use-auth-hydrated";
import { isAdminRole } from "@/lib/admin-utils";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 text-gray-500"
        data-shell="admin"
      >
        <Spinner className="h-6 w-6 border-gray-200 border-t-brand-500" />
        <span className="text-sm">Memuat panel admin...</span>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 text-gray-500"
        data-shell="admin"
      >
        <Spinner className="h-6 w-6 border-gray-200 border-t-brand-500" />
        <span className="text-sm">Mengalihkan ke login...</span>
      </div>
    );
  }

  if (user?.role === "gate_staff" && !pathname.startsWith("/admin/check-in")) {
    router.replace("/admin/check-in");
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500" data-shell="admin">
        <Spinner className="h-6 w-6 border-gray-200 border-t-brand-500" />
      </div>
    );
  }

  if (!isAdminRole(user?.role)) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-6 text-center"
        data-shell="admin"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-error-50 text-2xl text-error-500">🔒</div>
        <p className="text-lg font-semibold text-gray-800">Akses ditolak</p>
        <p className="max-w-sm text-sm text-gray-500">
          Akun Anda tidak memiliki izin untuk mengakses panel admin.
        </p>
        <Link href="/" className="text-sm font-medium text-brand-500 hover:underline">
          Kembali ke beranda
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
