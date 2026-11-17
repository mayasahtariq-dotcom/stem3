"use client";
import Link from "next/link";
import type { Schemas } from "@mooshala/api-client";
import { BilingualText, ChunkyButton, EmptyState, ErrorState, LoadingState, ProgressBar, StickerIcon } from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useTri } from "@/lib/i18n/use-tri";
import { cn } from "@/lib/utils/cn";
import { useHome, usePath } from "./api";

/** The learning path as a list: the accessible, no-3D view of the same lessons the farm path shows. */
export function PathScreen({ home, path, onRetry }: { home: { data?: Schemas["HomeOut"]; error: unknown; isLoading: boolean }; path: { data?: Schemas["PathOut"]; error: unknown; isLoading: boolean }; onRetry: () => void }) {
  const t = useBilingual("path");
  const f = useBilingual("farm");
  const tri = useTri();
  if (home.error || path.error) return <ErrorState error={home.error ?? path.error} onRetry={onRetry} className="h-full" />;
  if (home.isLoading || (home.data?.courses.length && path.isLoading)) return <LoadingState className="h-full" />;
  if (!home.data?.courses.length || !path.data)
    return (
      <EmptyState
        className="h-full"
        message={f("noCourse")}
        action={
          <ChunkyButton asChild>
            <Link href="/join">
              <BilingualText as="span" align="center" tone="inverse" text={f("joinClass")} />
            </Link>
          </ChunkyButton>
        }
      />
    );
  const p = path.data;
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 pb-32 pt-20 laptop:max-w-4xl laptop:px-8 laptop:pb-12 laptop:pt-8">
      <header className="flex flex-col gap-2">
        <BilingualText as="h1" size="2xl" text={tri(p.title as never)} />
        <ProgressBar value={p.lesson_count ? p.done_count / p.lesson_count : 0} label={f("courseProgress", { done: p.done_count, total: p.lesson_count }).english} />
        <BilingualText size="sm" text={f("courseProgress", { done: p.done_count, total: p.lesson_count })} />
      </header>
      {p.units.map((u, ui) => (
        <section key={u.id} aria-labelledby={`unit-${u.id}`} className="flex flex-col gap-3">
          <div id={`unit-${u.id}`} className="wood-grain rounded-card px-4 py-2 text-white [text-shadow:0_1px_0_rgb(0_0_0/0.4)]">
            <BilingualText as="h2" size="lg" tone="inverse" text={t("unit", { n: ui + 1, title: tri(u.title as never).regional, titleEn: tri(u.title as never).english })} />
          </div>
          <ol className="flex flex-col gap-2">
            {u.lessons.map((l) => {
              const ready = l.generation_status === "ready";
              const playable = l.state !== "locked" && ready;
              const body = (
                <>
                  <StickerIcon name={l.state === "done" ? "star" : l.state === "locked" ? "lock" : "sprout"} size={32} className={l.state === "locked" ? "opacity-60 grayscale" : undefined} />
                  <span className="flex flex-1 flex-col">
                    <BilingualText as="span" text={tri(l.title as never)} />
                    <span className="text-xs text-stone">
                      {f(`state_${l.state}`).regional} · {f(`state_${l.state}`).english}
                      {l.state === "locked" && l.unlocked_by ? ` · ${f("finishFirst", { title: tri(l.unlocked_by as never).regional, titleEn: tri(l.unlocked_by as never).english }).english}` : ""}
                      {!ready && l.state !== "locked" ? ` · ${f("lessonMaking").english}` : ""}
                    </span>
                  </span>
                </>
              );
              const cls = cn("flex min-h-14 items-center gap-3 rounded-card border-2 border-b-4 bg-white px-3 py-2", l.state === "current" ? "border-sun" : l.state === "done" ? "border-grass" : "border-line");
              return (
                <li key={l.id}>
                  {playable ? (
                    <Link href={`/farm/lesson/${encodeURIComponent(l.id)}`} className={cn(cls, "hover:bg-cream")} aria-current={l.state === "current" ? "step" : undefined}>
                      {body}
                    </Link>
                  ) : (
                    <div className={cls} aria-disabled="true">
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

export function PathRoute() {
  const home = useHome();
  const courseId = home.data?.continue_lesson?.course_id ?? home.data?.courses[0]?.id ?? null;
  const path = usePath(courseId);
  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-sky-soft to-cream">
      <PathScreen home={home} path={path} onRetry={() => (home.error ? home.refetch() : path.refetch())} />
    </div>
  );
}
