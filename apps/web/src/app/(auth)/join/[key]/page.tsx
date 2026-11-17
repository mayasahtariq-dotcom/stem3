import { JoinRoute } from "@/features/classroom/JoinRoute";

/** Join links: https://<domain>/join/BI09-K4X2 open with the key filled in. */
export default async function JoinWithKeyPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <JoinRoute initialKey={decodeURIComponent(key)} />;
}
