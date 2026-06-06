import { Sidebar } from "@/components/layout/sidebar";
import { MobileNavProvider } from "@/components/layout/mobile-nav";
import { DailyValuesReminder } from "@/components/vision/daily-values-reminder";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileNavProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="md:ml-60 min-h-screen flex flex-col">
          {children}
          <DailyValuesReminder />
        </main>
      </div>
    </MobileNavProvider>
  );
}
