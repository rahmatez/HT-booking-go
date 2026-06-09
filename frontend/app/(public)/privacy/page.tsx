import { Container } from "@/components/ui/container";

export default function PrivacyPage() {
  return (
    <Container narrow className="py-12 sm:py-16">
      <article className="rounded-2xl border border-(--border) bg-white p-8 shadow-(--shadow-sm) sm:p-10">
        <p className="text-xs font-bold uppercase tracking-widest text-(--accent)">Legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">Kebijakan Privasi</h1>
        <p className="mt-4 leading-relaxed text-stone-600">
          Eventra menghormati privasi pengguna sesuai peraturan perlindungan data yang berlaku
          di Indonesia (UU PDP).
        </p>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-stone-900">Data yang Kami Kumpulkan</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-stone-600">
            <li>Informasi akun: nama, email, nomor telepon</li>
            <li>Riwayat transaksi dan booking</li>
            <li>Data teknis: log akses untuk keamanan</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-stone-900">Penyimpanan Data</h2>
          <p className="mt-3 leading-relaxed text-stone-600">
            Data booking disimpan minimal 3 tahun untuk keperluan akuntansi. Anda dapat meminta
            penghapusan data pribadi dengan menghubungi support.
          </p>
        </section>
      </article>
    </Container>
  );
}
