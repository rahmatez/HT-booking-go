"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState, Suspense } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { AuthShell } from "@/components/auth/auth-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const res = await api.login({
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      setAuth(res.user, res.tokens);
      router.push(searchParams.get("redirect") || "/events");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Email atau password salah");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Selamat datang kembali"
      subtitle={
        <>
          Belum punya akun?{" "}
          <Link href="/auth/register" className="font-semibold text-(--accent) hover:underline">
            Daftar sekarang
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="nama@email.com"
          defaultValue="user@booking.local"
        />
        <Input
          label="Password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          defaultValue="user12345"
        />
        {error && (
          <div className="rounded-xl bg-(--danger-soft) px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <Button type="submit" disabled={loading} fullWidth size="lg">
          {loading ? "Memproses..." : "Masuk"}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
