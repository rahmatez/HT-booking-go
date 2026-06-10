import { LegalPage } from "@/components/public/legal-page";

export default function TermsPage() {
  return (
    <LegalPage title="Syarat & Ketentuan">
      <p className="leading-relaxed text-slate-600">
        Dengan menggunakan platform Eventra, Anda setuju untuk mematuhi syarat dan ketentuan
        berikut. Tiket yang dibeli bersifat final kecuali event dibatalkan oleh penyelenggara.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-slate-900">Pembelian Tiket</h2>
        <ul className="mt-3 list-inside list-disc space-y-2 text-slate-600">
          <li>Setiap akun dibatasi jumlah hold aktif sesuai kebijakan platform.</li>
          <li>Pembayaran harus diselesaikan sebelum waktu hold berakhir.</li>
          <li>Tiket tidak dapat dipindahtangankan kecuali fitur resale diaktifkan.</li>
        </ul>
      </section>
    </LegalPage>
  );
}
