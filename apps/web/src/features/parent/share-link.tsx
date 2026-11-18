"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@mooshala/api-client";
import { Hero, IconBubble, PlayfulPage, PlayStat, type Pastel } from "@/components/playful";
import { BilingualText, Card, ChunkyButton, EmptyState, LoadingState, Pill, StickerIcon, toast } from "@/components/ui";
import { useAuthStore } from "@/features/auth/auth-store";
import { useSpeak } from "@/features/learning/use-speak";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useTri } from "@/lib/i18n/use-tri";
import { useServices } from "@/lib/services";

/*
 * Each student has one private link for their parent (/p/<token>). Opening it shows the child's week,
 * with no sign-in. Students find it on their profile, teachers on the student's page; a new link
 * cancels the old one.
 */
type Link = { token: string; path: string };
const linkKeys = { mine: ["me", "parent-link"] as const, student: (c: string, s: string) => ["classrooms", c, "students", s, "parent-link"] as const };
const useSignedIn = () => useAuthStore((s) => s.status === "signedIn");

export function useMyParentLink() {
  const { pending } = useServices();
  return useQuery({ queryKey: linkKeys.mine, enabled: useSignedIn(), queryFn: () => pending.get<Link>("/me/parent-link") });
}

export function useResetParentLink() {
  const { pending } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => pending.post<Link>("/me/parent-link/reset"),
    onSuccess: (link) => qc.setQueryData(linkKeys.mine, link),
  });
}

export function useStudentParentLink(classId: string, studentId: string) {
  const { pending } = useServices();
  return useQuery({
    queryKey: linkKeys.student(classId, studentId),
    enabled: useSignedIn() && Boolean(classId && studentId),
    queryFn: () => pending.get<Link>(`/classrooms/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}/parent-link`),
  });
}

const topicArgs = (x: { regional: string; english: string }) => ({ topic: x.regional, topicEn: x.english });

const fullUrl = (path: string) => (typeof window === "undefined" ? path : `${window.location.origin}${path}`);

/** The link, with Copy, WhatsApp and (for the student) "make a new link". */
function LinkShareBox({ path, title, hint, onReset, resetting }: { path: string; title: { regional: string; english: string }; hint: { regional: string; english: string }; onReset?: () => void; resetting?: boolean }) {
  const t = useBilingual("parent");
  const url = fullUrl(path);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast("success", t("linkCopied"));
    } catch {
      window.prompt(t("copyLink").english, url);
    }
  };
  return (
    <Card className="flex flex-col gap-3" data-testid="parent-share-link">
      <div className="flex items-center gap-3">
        <IconBubble icon="people" pastel="lavender" size={30} />
        <BilingualText as="h2" size="lg" text={title} />
      </div>
      <BilingualText size="sm" text={hint} className="text-stone" />
      <p className="break-all rounded-2xl bg-white/80 px-3 py-2 font-mono text-sm" data-testid="parent-link-url">{url}</p>
      <div className="flex flex-wrap gap-2">
        <ChunkyButton size="sm" onClick={() => void copy()} data-testid="copy-parent-link">
          <BilingualText as="span" size="sm" tone="inverse" text={t("copyLink")} />
        </ChunkyButton>
        <ChunkyButton asChild size="sm" variant="white">
          <a href={`https://wa.me/?text=${encodeURIComponent(url)}`} target="_blank" rel="noopener">
            <BilingualText as="span" size="sm" text={t("shareWhatsApp")} />
          </a>
        </ChunkyButton>
        {onReset && (
          <ChunkyButton size="sm" variant="ghost" loading={resetting} onClick={onReset} data-testid="reset-parent-link">
            <BilingualText as="span" size="sm" text={t("newLink")} />
          </ChunkyButton>
        )}
      </div>
    </Card>
  );
}

/** Student profile: "Link for your parent". */
export function MyParentLinkCard() {
  const t = useBilingual("parent");
  const link = useMyParentLink();
  const reset = useResetParentLink();
  if (!link.data) return null;
  return (
    <LinkShareBox
      path={link.data.path}
      title={t("myLinkTitle")}
      hint={t("myLinkHint")}
      resetting={reset.isPending}
      onReset={() => reset.mutate(undefined, { onSuccess: () => toast("success", t("newLinkDone")) })}
    />
  );
}

/** Teacher's student page: the parent link to hand over. */
export function StudentParentLinkCard({ classId, studentId, name }: { classId: string; studentId: string; name: string }) {
  const t = useBilingual("parent");
  const link = useStudentParentLink(classId, studentId);
  if (!link.data) return null;
  return <LinkShareBox path={link.data.path} title={t("teacherLinkTitle")} hint={t("teacherLinkHint", { name })} />;
}

/** The page a parent opens from the link: glassy, animated, read-only, no sign-in. */
export function ParentShareDashboard({ token }: { token: string }) {
  const t = useBilingual("parent");
  const tri = useTri();
  const { pending } = useServices();
  const { speak, speaking } = useSpeak();
  const q = useQuery({ queryKey: ["share", token], retry: false, queryFn: () => pending.get<Schemas["ChildDashboard"]>(`/share/${encodeURIComponent(token)}`) });
  if (q.isLoading) return <PlayfulPage tone="lavender"><LoadingState className="min-h-dvh" /></PlayfulPage>;
  if (!q.data)
    return (
      <PlayfulPage tone="lavender">
        <main className="mx-auto grid min-h-dvh max-w-xl place-items-center p-4">
          <EmptyState message={t("shareNotFound")} />
        </main>
      </PlayfulPage>
    );
  const d = q.data;
  const summary = tri(d.summary as never);
  const acc = d.accuracy.this_week;
  const tiles: { icon: Parameters<typeof PlayStat>[0]["icon"]; value: string; label: { regional: string; english: string }; pastel: Pastel }[] = [
    { icon: "flame", value: String(d.week.streak), label: t("streak"), pastel: "blue" },
    { icon: "book", value: `${d.week.lessons_this_week} ${{ up: "↑", down: "↓", same: "→" }[d.week.arrow]}`, label: t("lessonsThisWeek", { last: d.week.lessons_last_week }), pastel: "lavender" },
    { icon: "target", value: acc === null || acc === undefined ? "–" : `${Math.round(acc * 100)}%`, label: t("accuracyWeek"), pastel: "sky" },
    { icon: "timer", value: String(d.week.minutes_this_week), label: t("minutes"), pastel: "mint" },
  ];
  return (
    <PlayfulPage tone="lavender">
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 tablet:p-6" data-testid="parent-share-page">
        <Hero tone="lavender" pose="heart" eyebrow={t("thisWeek")} title={t("shareTitle", { name: d.child.name })} subtitle={t(`word_${d.accuracy.word}`)} />
        <section className="grid grid-cols-2 gap-3 tablet:grid-cols-4">
          {tiles.map((x) => <PlayStat key={x.label.english} {...x} />)}
        </section>
        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <StickerIcon name="chat" size={28} />
            <BilingualText as="h2" size="lg" text={t("summaryTitle")} className="flex-1" />
            <ChunkyButton size="sm" variant="white" loading={speaking} onClick={() => void speak(summary.regional)} data-testid="listen-share-summary">
              <StickerIcon name="speaker" size={18} />
              <BilingualText as="span" size="sm" text={t("listen")} />
            </ChunkyButton>
          </div>
          <BilingualText text={summary} />
        </Card>
        {d.subjects.some((s) => s.strongest || s.weakest) && (
          <div className="grid gap-3 tablet:grid-cols-2">
            {d.subjects.flatMap((s) => [
              s.strongest && <Card key={`${s.subject}-s`} className="flex items-center gap-3"><IconBubble icon="star" pastel="mint" size={28} /><BilingualText text={t("strongest", topicArgs(tri(s.strongest as never)))} /></Card>,
              s.weakest && <Card key={`${s.subject}-w`} className="flex items-center gap-3"><IconBubble icon="snail" pastel="lemon" size={28} /><BilingualText text={t("needsPractice", topicArgs(tri(s.weakest as never)))} /></Card>,
            ])}
          </div>
        )}
        <Card className="flex flex-col gap-3">
          <BilingualText as="h2" size="lg" text={t("assignments")} />
          {d.assignments.length === 0 ? (
            <BilingualText size="sm" text={t("noAssignments")} className="text-stone" />
          ) : (
            <ul className="flex flex-col gap-2">
              {d.assignments.map((a) => (
                <li key={a.course_id} className="flex items-center gap-3 rounded-2xl bg-white/70 p-3">
                  <StickerIcon name="books" size={26} />
                  <span className="flex-1"><BilingualText as="span" size="sm" text={tri(a.title as never)} /><span className="text-xs text-stone">{a.classroom}</span></span>
                  <Pill tone={a.status === "done" ? "good" : "info"}>{t(`status_${a.status}`).regional}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </PlayfulPage>
  );
}
