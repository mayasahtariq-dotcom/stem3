import { LessonRoute } from "@/features/learning/LessonRoute";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LessonRoute lessonId={decodeURIComponent(id)} />;
}
