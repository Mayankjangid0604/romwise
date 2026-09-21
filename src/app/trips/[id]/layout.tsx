import { TripWorkspaceNav } from "@/components/ui";

export default async function TripLayout(props: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-white border-b border-ink-100 sticky top-0 z-10 px-6 py-4">
        <h1 className="text-xl font-semibold">Trip Workspace</h1>
        <TripWorkspaceNav tripId={id} />
      </div>
      <div className="flex-1 overflow-auto bg-ink-50 p-6">
        {props.children}
      </div>
    </div>
  );
}
