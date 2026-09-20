import { auth } from "@/lib/auth";
import { ROLES } from "@/lib/roles";
import { redirect } from "next/navigation";
import { PageShell, PageHeader } from "@/components/ui";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== ROLES.ADMIN) {
    redirect("/dashboard");
  }

  return (
    <PageShell>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Manage Travel Knowledge & Data Quality"
        backHref="/dashboard"
        backLabel="Back to app"
      />
      
      <div className="flex gap-4 mb-8">
        <Link 
          href="/admin/data" 
          className="text-sm font-medium text-ink-600 hover:text-ink-900 px-3 py-2 rounded-md hover:bg-ink-100"
        >
          Data Quality
        </Link>
      </div>

      <main>{children}</main>
    </PageShell>
  );
}
