import { redirect } from "next/navigation";

// "Info" was a placeholder tab ("will be implemented here"). Accessibility notes and
// preferences live on /preferences, so keep old /info links working by sending them there.
export default async function InfoPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  redirect(`/trips/${id}/preferences`);
}
