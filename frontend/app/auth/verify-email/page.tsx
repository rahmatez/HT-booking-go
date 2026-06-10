"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AuthShell } from "@/components/auth/auth-shell";
import { Spinner } from "@/components/ui/spinner";

function VerifyContent() {
  const token = useSearchParams().get("token") || "";
  const [status, setStatus] = useState<"loading" | "ok" | "fail">("loading");

  useEffect(() => {
    if (!token) {
      setStatus("fail");
      return;
    }
    api.verifyEmail(token).then(() => setStatus("ok")).catch(() => setStatus("fail"));
  }, [token]);

  return (
    <AuthShell title="Verifikasi email" subtitle="Memverifikasi akun kamu">
      {status === "loading" && (
        <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>
      )}
      {status === "ok" && (
        <p className="text-center text-stone-600">
          Email berhasil diverifikasi. <Link href="/auth/login" className="text-(--accent)">Masuk sekarang</Link>
        </p>
      )}
      {status === "fail" && (
        <p className="text-center text-red-600">Link tidak valid atau sudah kedaluwarsa.</p>
      )}
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  );
}
