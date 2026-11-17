import { CourseDetailRoute } from "@/features/teacher/routes";

export default async function TeacherCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CourseDetailRoute courseId={decodeURIComponent(id)} />;
}
