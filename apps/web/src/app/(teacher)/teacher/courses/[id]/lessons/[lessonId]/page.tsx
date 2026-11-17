import { LessonReviewRoute } from "@/features/teacher/routes";

export default async function LessonReviewPage({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const { id, lessonId } = await params;
  return <LessonReviewRoute courseId={decodeURIComponent(id)} lessonId={decodeURIComponent(lessonId)} />;
}
