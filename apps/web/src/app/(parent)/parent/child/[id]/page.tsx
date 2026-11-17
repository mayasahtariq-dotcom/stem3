import { ChildRoute } from "@/features/parent/routes";

export default async function ChildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChildRoute childId={decodeURIComponent(id)} />;
}
