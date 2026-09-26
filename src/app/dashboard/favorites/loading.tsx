import { LoadingState, PageShell, Skeleton } from "@/components/ui";

export default function FavoritesLoading() {
  return (
    <PageShell>
      <LoadingState label="Loading favorites…">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </LoadingState>
    </PageShell>
  );
}
