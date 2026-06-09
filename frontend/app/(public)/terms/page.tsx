import { Container } from "@/components/ui/container";

export default function TermsPage() {
  return (
    <Container narrow className="py-12 sm:py-16">
      <article className="rounded-2xl border border-(--border) bg-white p-8 shadow-(--shadow-sm) sm:p-10">
        <p className="text-xs font-bold uppercase tracking-widest text-(--accent)">Legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">Syarat & Ketentuan</h1>
        <p className="mt-4 leading-relaxed text-stone-600">
          Dengan menggunakan platform HTB Ticket, Anda setuju untuk mematuhi syarat dan ketentuan
          berikut. Tiket yang dibeli bersifat final kecuali event dibatalkan oleh penyelenggara.
        </p>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-stone-900">Pembelian Tiket</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-stone-600">
            <li>Setiap akun dibatasi jumlah hold aktif sesuai kebijakan platform.</li>
            <li>Pembayaran harus diselesaikan sebelum waktu hold berakhir.</li>
            <li>Tiket tidak dapat dipindahtangankan kecuali fitur resale diaktifkan.</li>
          </ul>
        </section>
      </article>
    </Container>
  );
}
