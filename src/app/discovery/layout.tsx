import { AppShell, AppNavigation } from "@/components/ui";

export default function DiscoveryLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <AppNavigation />
      <main className="flex-1 relative">{children}</main>
    </AppShell>
  );
}
