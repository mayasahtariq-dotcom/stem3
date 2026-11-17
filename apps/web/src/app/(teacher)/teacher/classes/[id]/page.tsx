import { ClassDetailRoute } from "@/features/teacher/routes";

export default async function TeacherClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClassDetailRoute classId={decodeURIComponent(id)} />;
}
