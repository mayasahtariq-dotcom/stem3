"use client";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import type { ReactNode } from "react";
import { useStats } from "./api";
import { LessonPlayerScreen } from "./LessonPlayerScreen";
import { useLessonPlayer } from "./use-lesson-player";
import { useSpeak } from "./use-speak";

export function formatClock(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "kn" ? "kn-IN" : "hi-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

export function LessonRoute({ lessonId, completeExtras }: { lessonId: string; completeExtras?: (lessonId: string) => ReactNode }) {
  const router = useRouter();
  const locale = useLocale();
  const model = useLessonPlayer(lessonId);
  const stats = useStats();
  const { speak } = useSpeak();
  return (
    <div className="h-full bg-white">
      <LessonPlayerScreen
        model={model}
        stats={stats.data}
        onExit={() => router.push("/farm")}
        onSpeak={(text) => void speak(text)}
        formatTime={(iso) => formatClock(iso, locale)}
        completeExtras={model.session?.phase === "done" && model.session.complete ? completeExtras?.(lessonId) : undefined}
      />
    </div>
  );
}
