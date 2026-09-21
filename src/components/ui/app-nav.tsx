import { SignOutButton } from "@/app/dashboard/sign-out-button";

export function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="app-shell">{children}</div>;
}

export function AppNavigation() {
  return (
    <nav className="app-navigation p-4 flex justify-end">
      <SignOutButton />
    </nav>
  );
}
