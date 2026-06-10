import { LegalPage } from "@/components/public/legal-page";

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Kebijakan Refund & Pembatalan">
      <p className="text-sm text-slate-500">Terakhir diperbarui: Juni 2026</p>

      <section className="mt-6">
        <h2 className="text-lg font-bold text-slate-900">Pembatalan oleh pembeli</h2>
        <p className="mt-3 leading-relaxed text-slate-600">
          Booking dengan status <strong>held</strong> atau <strong>pending_payment</strong> dapat
          dibatalkan melalui halaman tiket. Setelah pembayaran dikonfirmasi, refund mengikuti
          kebijakan penyelenggara event.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-slate-900">Pembatalan event</h2>
        <p className="mt-3 leading-relaxed text-slate-600">
          Jika event dibatalkan oleh penyelenggara, pembeli berhak atas refund penuh sesuai
          ketentuan platform.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-slate-900">Proses refund</h2>
        <p className="mt-3 leading-relaxed text-slate-600">
          Refund diproses ke metode pembayaran asal dalam 3–14 hari kerja setelah disetujui admin.
          Hubungi{" "}
          <a href="mailto:support@eventra.local" className="font-medium text-(--accent)">
            support@eventra.local
          </a>{" "}
          untuk bantuan.
        </p>
      </section>
    </LegalPage>
  );
}
