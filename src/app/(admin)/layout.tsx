import { Sidebar } from "@/components/ui/sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 p-4 md:p-6 overflow-y-auto">{children}</main>
    </div>
  );
}
