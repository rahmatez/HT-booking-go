"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { AuthShell } from "@/components/auth/auth-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const form = new FormData(e.currentTarget);
    try {
      const res = await api.forgotPassword(String(form.get("email")));
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal mengirim email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Lupa password" subtitle={<Link href="/auth/login" className="text-(--accent) hover:underline">Kembali ke login</Link>}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input label="Email" name="email" type="email" required />
        {message && <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>}
        {error && <div className="rounded-xl bg-(--danger-soft) px-4 py-3 text-sm text-red-700">{error}</div>}
        <Button type="submit" disabled={loading} fullWidth size="lg">{loading ? "Mengirim..." : "Kirim link reset"}</Button>
      </form>
    </AuthShell>
  );
}
