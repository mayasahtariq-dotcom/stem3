import { ParentShareDashboard } from "@/features/parent/share-link";

/** A student's private parent link: the child's week, no sign-in. */
export default async function ParentLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ParentShareDashboard token={decodeURIComponent(token)} />;
}
