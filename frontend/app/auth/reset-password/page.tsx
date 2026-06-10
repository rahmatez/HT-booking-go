"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { AuthShell } from "@/components/auth/auth-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) {
      setError("Token tidak valid");
      return;
    }
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await api.resetPassword(token, String(form.get("password")));
      router.push("/auth/login");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Reset gagal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Reset password" subtitle="Masukkan password baru kamu">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input label="Password baru" name="password" type="password" required minLength={8} />
        {error && <div className="rounded-xl bg-(--danger-soft) px-4 py-3 text-sm text-red-700">{error}</div>}
        <Button type="submit" disabled={loading} fullWidth size="lg">{loading ? "Menyimpan..." : "Simpan password"}</Button>
        <p className="text-center text-sm"><Link href="/auth/login" className="text-(--accent)">Login</Link></p>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
