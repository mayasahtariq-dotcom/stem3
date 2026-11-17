import { StudentDetailRoute } from "@/features/teacher/routes";

export default async function TeacherStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudentDetailRoute studentId={decodeURIComponent(id)} />;
}
