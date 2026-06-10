import { LegalPage } from "@/components/public/legal-page";

export default function PrivacyPage() {
  return (
    <LegalPage title="Kebijakan Privasi">
      <p className="leading-relaxed text-slate-600">
        Eventra menghormati privasi pengguna sesuai peraturan perlindungan data yang berlaku
        di Indonesia (UU PDP).
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-slate-900">Data yang Kami Kumpulkan</h2>
        <ul className="mt-3 list-inside list-disc space-y-2 text-slate-600">
          <li>Informasi akun: nama, email, nomor telepon</li>
          <li>Riwayat transaksi dan booking</li>
          <li>Data teknis: log akses untuk keamanan</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-slate-900">Penyimpanan Data</h2>
        <p className="mt-3 leading-relaxed text-slate-600">
          Data booking disimpan minimal 3 tahun untuk keperluan akuntansi. Anda dapat meminta
          penghapusan data pribadi dengan menghubungi support.
        </p>
      </section>
    </LegalPage>
  );
}
