"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { Schemas } from "@mooshala/api-client";
import { BilingualText, Card, ChunkyButton, ErrorState, LoadingState, StickerIcon } from "@/components/ui";
import { useAuthStore } from "@/features/auth/auth-store";
import { unwrap } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useServices } from "@/lib/services";

/** GET /me/classrooms */
export function useMyClassrooms() {
  const { api } = useServices();
  const signedIn = useAuthStore((s) => s.status === "signedIn");
  return useQuery({ queryKey: queryKeys.myClassrooms, enabled: signedIn, queryFn: async () => unwrap(await api.GET("/me/classrooms")) });
}

/** Stateless: the student's classes and a way to join another with the teacher's code. */
export function MyClassesPanel({ classes, loading, error, onRetry }: { classes: Schemas["StudentClassroomOut"][] | undefined; loading?: boolean; error?: unknown; onRetry?: () => void }) {
  const t = useBilingual("myClasses");
  return (
    <Card className="flex flex-col gap-3 p-4" data-testid="my-classes">
      <div className="flex items-center gap-2">
        <StickerIcon name="school" size={30} />
        <BilingualText as="h2" size="lg" text={t("title")} className="flex-1" />
      </div>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : classes?.length ? (
        <ul className="flex flex-col gap-2">
          {classes.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-card border-2 border-line bg-white p-3">
              <StickerIcon name="teacher" size={24} />
              <span className="flex-1 font-bold">{c.name}</span>
              <span className="text-sm text-stone">{c.teacher_name}</span>
            </li>
          ))}
        </ul>
      ) : (
        <BilingualText size="sm" text={t("none")} />
      )}
      <ChunkyButton asChild variant="white" block>
        <Link href="/join" data-testid="join-class-link">
          <BilingualText as="span" align="center" text={t("join")} />
        </Link>
      </ChunkyButton>
    </Card>
  );
}

export function MyClassesCard() {
  const q = useMyClassrooms();
  return <MyClassesPanel classes={q.data} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} />;
}
