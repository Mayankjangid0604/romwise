import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PackingActions } from "./packing-actions";
import {
  PageShell,
  PageHeader,
  Card,
  Badge,
  Progress,
  EmptyState,
  Figure,
  cn,
} from "@/components/ui";

export default async function PackingPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await props.params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      groupMembers: true,
      packingItems: { orderBy: [{ essential: "desc" }, { category: "asc" }, { label: "asc" }] },
    },
  });

  if (!trip) redirect("/dashboard");

  const isMember = trip.groupMembers.some(
    (m) => m.userId === session.user!.id,
  );
  if (!isMember) redirect("/dashboard");

  const grouped = new Map<string, typeof trip.packingItems>();
  for (const item of trip.packingItems) {
    const list = grouped.get(item.category) || [];
    list.push(item);
    grouped.set(item.category, list);
  }

  const totalItems = trip.packingItems.length;
  const checkedItems = trip.packingItems.filter((i) => i.checked).length;
  const pct = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

  return (
    <PageShell>
      <PageHeader
        backHref={`/trips/${id}`}
        backLabel="Trip"
        eyebrow={trip.title}
        title="Packing"
      />

      <PackingActions tripId={id} hasItems={totalItems > 0} />

      {totalItems === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No packing list yet"
            hint={'Click "Generate Packing List" to create one based on your trip.'}
          />
        </div>
      ) : (
        <div className="space-y-8 mt-8">
          <div className="flex items-center gap-4">
            <Progress value={pct} tone="success" />
            <Figure className="text-[0.8125rem] text-ink-600 shrink-0">
              {checkedItems}/{totalItems} packed
            </Figure>
          </div>

          {Array.from(grouped.entries()).map(([category, items]) => (
            <section key={category}>
              <h2 className="font-display text-lg font-semibold capitalize text-ink-800 mb-3">
                {category}
              </h2>
              <Card padding="none" className="overflow-hidden">
                <div className="divide-y divide-ink-100">
                  {items.map((item) => (
                    <PackingItemRow key={item.id} item={item} />
                  ))}
                </div>
              </Card>
            </section>
          ))}
        </div>
      )}
    </PageShell>
  );
}

function PackingItemRow({
  item,
}: {
  item: { id: string; label: string; checked: boolean; essential: boolean };
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <form action={async () => {
        "use server";
        const { togglePackingItem } = await import("@/app/actions/packing");
        await togglePackingItem(item.id, !item.checked);
      }}>
        <button
          type="submit"
          className="flex items-center"
          aria-label={item.checked ? `Uncheck ${item.label}` : `Check ${item.label}`}
        >
          <span
            className={cn(
              "w-5 h-5 rounded-md border flex items-center justify-center text-[0.6875rem] transition-colors",
              item.checked
                ? "bg-success-600 border-success-600 text-white"
                : "border-ink-300 bg-white hover:border-success-600",
            )}
          >
            {item.checked ? "✓" : ""}
          </span>
        </button>
      </form>

      <span
        className={cn(
          "flex-1 text-[0.9375rem]",
          item.checked ? "line-through text-ink-400" : "text-ink-800",
        )}
      >
        {item.label}
      </span>

      {item.essential && <Badge tone="danger">essential</Badge>}

      <form action={async () => {
        "use server";
        const { toggleEssential } = await import("@/app/actions/packing");
        await toggleEssential(item.id, !item.essential);
      }}>
        <button
          type="submit"
          className={cn(
            "text-[0.75rem] font-medium transition-colors",
            item.essential
              ? "text-ink-400 hover:text-ink-600"
              : "text-lagoon-700 hover:text-lagoon-800",
          )}
        >
          {item.essential ? "unmark" : "mark essential"}
        </button>
      </form>
    </div>
  );
}
