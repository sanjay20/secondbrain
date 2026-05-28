import { Sidebar } from "@/components/layout/sidebar";
import { MobileNavProvider } from "@/components/layout/mobile-nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileNavProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="md:ml-60 min-h-screen flex flex-col">
          {children}
        </main>
      </div>
    </MobileNavProvider>
  );
}
