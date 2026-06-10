"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { AuthShell } from "@/components/auth/auth-shell";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      if (turnstileEnabled && !captchaToken) {
        setError("Selesaikan verifikasi CAPTCHA");
        return;
      }
      const res = await api.register({
        email: String(form.get("email")),
        password: String(form.get("password")),
        full_name: String(form.get("full_name")),
        phone: String(form.get("phone") || ""),
        ...(captchaToken ? { captcha_token: captchaToken } : {}),
      });
      setAuth(res.user, res.tokens);
      router.push("/events");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Registrasi gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Buat akun baru"
      subtitle={
        <>
          Sudah punya akun?{" "}
          <Link href="/auth/login" className="font-semibold text-(--accent) hover:underline">
            Masuk di sini
          </Link>
        </>
      }
      footer={
        <p className="text-xs leading-relaxed text-stone-400">
          Dengan mendaftar, kamu menyetujui{" "}
          <Link href="/terms" className="underline hover:text-stone-600">
            Syarat & Ketentuan
          </Link>{" "}
          serta{" "}
          <Link href="/privacy" className="underline hover:text-stone-600">
            Kebijakan Privasi
          </Link>
          .
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input label="Nama lengkap" name="full_name" required placeholder="Nama kamu" />
        <Input label="Email" name="email" type="email" required placeholder="nama@email.com" />
        <Input label="Telepon (opsional)" name="phone" type="tel" placeholder="08xxxxxxxxxx" />
        <Input
          label="Password"
          name="password"
          type="password"
          required
          minLength={8}
          hint="Minimal 8 karakter"
        />
        {error && (
          <div className="rounded-xl bg-(--danger-soft) px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <TurnstileWidget onToken={setCaptchaToken} />
        <Button type="submit" disabled={loading} fullWidth size="lg">
          {loading ? "Memproses..." : "Daftar"}
        </Button>
      </form>
    </AuthShell>
  );
}
