import { getDestinationDetails } from "@/lib/destination-brain/details";
import { TripBuilder } from "./trip-builder";
import { Suspense } from "react";
import { PageShell, PageHeader } from "@/components/ui";

export default async function NewTripPage(props: { searchParams: Promise<{ destination?: string, startDate?: string, endDate?: string, budget?: string, pace?: string }> }) {
  const searchParams = await props.searchParams;
  const destination = searchParams.destination;
  
  let initialDetails = null;
  if (destination) {
    try {
      initialDetails = await getDestinationDetails(destination);
    } catch (err) {
      console.error("Destination not found:", err);
    }
  }

  return (
    <PageShell width="form">
      <PageHeader backHref="/dashboard" backLabel="Dashboard" title="Plan Your Next Adventure" />
      <Suspense fallback={<div>Loading...</div>}>
        <TripBuilder 
          initialDestination={destination || ""} 
          initialDetails={initialDetails} 
          initialData={searchParams}
        />
      </Suspense>
    </PageShell>
  );
}
