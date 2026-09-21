export default async function InfoPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Trip Info</h1>
      <p>Accessibility notes and preferences will be implemented here.</p>
    </div>
  );
}
