import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeBudgetSummary, type BudgetItem } from "@/lib/budget";
import { OptimizeButton } from "./optimize-button";
import { ExpenseList } from "@/components/expenses/expense-list";
import {
  PageShell,
  PageHeader,
  SectionHeading,
  Card,
  Alert,
  Stat,
  Progress,
  EmptyState,
  Figure,
  formatInr,
} from "@/components/ui";

export default async function BudgetPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await props.params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      groupMembers: { include: { user: true } },
      tripAccommodations: true,
      expenses: { include: { payer: true, ExpenseParticipant: true }, orderBy: { date: "desc" } },
      itineraryDays: {
        orderBy: { dayNumber: "asc" },
        include: { items: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!trip) redirect("/dashboard");

  const isMember = trip.groupMembers.some(
    (m) => m.userId === session.user!.id,
  );
  if (!isMember) redirect("/dashboard");

  const budgetItems: BudgetItem[] = trip.itineraryDays.flatMap((day) =>
    day.items.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      estimatedCostInr: item.estimatedCostInr,
      dayNumber: day.dayNumber,
    })),
  );

  const primaryAccommodation = trip.tripAccommodations[0];
  const stayCostInr = primaryAccommodation?.totalCostInr ?? 0;
  const summary = computeBudgetSummary(budgetItems, trip.budgetInr);
  const totalSpendWithStay = summary.estimatedSpend + stayCostInr;
  const remainingWithStay = trip.budgetInr - totalSpendWithStay;
  const isOverBudgetWithStay = remainingWithStay < 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      {budgetItems.length === 0 ? (
        <EmptyState
          title="No itinerary items to budget"
          hint="Generate an itinerary first."
        />
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat label="Total Budget" value={formatInr(summary.totalBudget)} />
            <Stat
              label="Estimated Spend"
              value={formatInr(totalSpendWithStay)}
              tone={isOverBudgetWithStay ? "negative" : "default"}
              detail={
                stayCostInr > 0
                  ? `Activities ${formatInr(summary.estimatedSpend)} + Stay ${formatInr(stayCostInr)}`
                  : undefined
              }
            />
            <Stat
              label={isOverBudgetWithStay ? "Over Budget" : "Remaining"}
              value={`${isOverBudgetWithStay ? "−" : ""}${formatInr(Math.abs(remainingWithStay))}`}
              tone={isOverBudgetWithStay ? "negative" : "positive"}
            />
          </div>

          {isOverBudgetWithStay && (
            <Alert tone="caution" title="Over budget">
              <p>
                The estimated spend exceeds your budget by{" "}
                <Figure>{formatInr(Math.abs(remainingWithStay))}</Figure>.
                {stayCostInr > 0 && " Consider a cheaper hotel or"} Use the
                optimizer to remove lower-value items.
              </p>
              <OptimizeButton tripId={trip.id} />
            </Alert>
          )}

          {primaryAccommodation && (
            <Card>
              <h2 className="font-display text-lg font-semibold text-ink-800 mb-3">
                Accommodation
              </h2>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-ink-800">
                    {primaryAccommodation.name}
                  </p>
                  <p className="text-[0.8125rem] text-ink-500 mt-0.5">
                    <Figure>
                      {formatInr(primaryAccommodation.costPerNightInr ?? 0)}
                    </Figure>
                    /night &times;{" "}
                    <Figure>{primaryAccommodation.nights ?? 0}</Figure> nights
                  </p>
                </div>
                <Figure className="font-semibold text-ink-900">
                  {formatInr(primaryAccommodation.totalCostInr ?? 0)}
                </Figure>
              </div>
            </Card>
          )}

          <section>
            <SectionHeading
              hint={
                stayCostInr > 0
                  ? "Activity spending only — accommodation shown separately above"
                  : undefined
              }
            >
              Planned Spend by Category
            </SectionHeading>

            <Card padding="dense">
              <div className="space-y-3">
                {summary.categoryTotals.map((cat) => {
                  const pct =
                    summary.estimatedSpend > 0
                      ? Math.round((cat.total / summary.estimatedSpend) * 100)
                      : 0;
                  return (
                    <div
                      key={cat.category}
                      className="flex items-center gap-3 text-[0.8125rem]"
                    >
                      <span className="w-24 shrink-0 capitalize font-medium text-ink-700">
                        {cat.category}
                      </span>
                      <Progress value={pct} size="sm" />
                      <Figure className="w-28 text-right text-ink-700">
                        {formatInr(cat.total)} ({pct}%)
                      </Figure>
                      <span className="w-16 text-right text-ink-400 text-[0.75rem]">
                        {cat.itemCount} items
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </section>

          <section>
            <SectionHeading hint="Based on actual logged expenses">
              Actual Spend by Category
            </SectionHeading>

            <Card padding="dense">
              <div className="space-y-3">
                {["food", "transport", "stay", "activity", "other"].map((catName) => {
                  const catExpenses = trip.expenses.filter((e) => e.category === catName);
                  const catTotal = catExpenses.reduce((sum, e) => sum + e.amountInr, 0);
                  if (catTotal === 0) return null; // Do not show zero categories unnecessarily

                  const totalActual = trip.expenses.reduce((sum, e) => sum + e.amountInr, 0);
                  const pct = totalActual > 0 ? Math.round((catTotal / totalActual) * 100) : 0;
                  
                  return (
                    <div
                      key={catName}
                      className="flex items-center gap-3 text-[0.8125rem]"
                    >
                      <span className="w-24 shrink-0 capitalize font-medium text-ink-700">
                        {catName}
                      </span>
                      <Progress value={pct} size="sm" />
                      <Figure className="w-28 text-right text-ink-700">
                        {formatInr(catTotal)} ({pct}%)
                      </Figure>
                      <span className="w-16 text-right text-ink-400 text-[0.75rem]">
                        {catExpenses.length} items
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </section>

          <section>
            <SectionHeading>All Items</SectionHeading>
            <Card padding="none" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[0.875rem]">
                  <thead className="bg-ink-100">
                    <tr className="text-[0.6875rem] uppercase tracking-wider text-ink-500">
                      <th className="text-left font-medium px-4 py-2.5">Day</th>
                      <th className="text-left font-medium px-4 py-2.5">Item</th>
                      <th className="text-left font-medium px-4 py-2.5">
                        Category
                      </th>
                      <th className="text-right font-medium px-4 py-2.5">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetItems.map((item) => (
                      <tr key={item.id} className="border-t border-ink-100">
                        <td className="px-4 py-2.5">
                          <Figure className="text-ink-500">
                            {item.dayNumber}
                          </Figure>
                        </td>
                        <td className="px-4 py-2.5 text-ink-800">{item.title}</td>
                        <td className="px-4 py-2.5 capitalize text-ink-600">
                          {item.category}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {item.estimatedCostInr !== null ? (
                            <Figure className="text-ink-800">
                              {formatInr(item.estimatedCostInr)}
                            </Figure>
                          ) : (
                            <span className="text-ink-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          <ExpenseList
            tripId={trip.id}
            initialExpenses={trip.expenses}
            groupMembers={trip.groupMembers.map(m => ({ userId: m.userId, name: m.user.name }))}
            currentUserId={session.user.id}
          />
        </div>
      )}

      {/* Render ExpenseList when there are no itinerary items, so users can log flights/hotels before planning */}
      {budgetItems.length === 0 && (
        <ExpenseList
          tripId={trip.id}
          initialExpenses={trip.expenses}
          groupMembers={trip.groupMembers.map(m => ({ userId: m.userId, name: m.user.name }))}
          currentUserId={session.user.id}
        />
      )}
    </div>
  );
}
