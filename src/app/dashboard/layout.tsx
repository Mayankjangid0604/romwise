import { AppShell, AppNavigation } from "@/components/ui/app-nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <AppNavigation />
      <main className="flex-1">{children}</main>
    </AppShell>
  );
}
