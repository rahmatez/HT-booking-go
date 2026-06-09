import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background" data-shell="public">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
