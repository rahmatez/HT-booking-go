import { AdminGuard } from "@/components/admin/admin-guard";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSidebar } from "@/components/admin/sidebar";

export const metadata = {
  title: "Admin — HTB Ticket",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="flex min-h-screen bg-stone-100" data-shell="admin">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminHeader />
          <main className="flex-1 overflow-auto p-6 sm:p-8">{children}</main>
        </div>
      </div>
    </AdminGuard>
  );
}
