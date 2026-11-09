import { AppSidebar } from '@/components/layout/AppSidebar';
import AdminTopbar from '@/components/layout/AdminTopbar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AdminTopbar />
        <main className="flex-1 items-start gap-4 p-0 md:gap-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

