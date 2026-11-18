"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BilingualText, ErrorState, LoadingState } from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useServices } from "@/lib/services";

/** GET /classrooms/{id}/sim-activity (teacher) and /parent/children/{id}/sim-activity (parent). */
export interface SimActivity {
  simulator_users: number;
  sessions: number;
  lessons_completed: number;
  correct: number;
  incorrect: number;
  call_seconds: number;
  interrupted: number;
  channels: {
    app: { answers: number; lessons: number };
    phone_simulator: { answers: number; lessons: number };
  };
  recent: {
    id: string;
    student_name: string;
    started_at: string;
    seconds: number;
    status: "active" | "completed" | "interrupted";
    answered: number;
    correct: number;
    question_count: number;
  }[];
}

export function useSimActivity(path: string | null) {
  const { pending } = useServices();
  return useQuery({
    queryKey: ["sim-activity", path],
    enabled: Boolean(path),
    queryFn: () => pending.get<SimActivity>(path!),
    refetchInterval: 15_000,
  });
}

const STATUS = { active: "sActive", completed: "sCompleted", interrupted: "sInterrupted" } as const;

/** Simulator activity next to the app's own numbers: one student, two channels. */
export function SimActivityCard({
  data,
  loading,
  error,
  onRetry,
  showUsers = true,
}: {
  data?: SimActivity;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  showUsers?: boolean;
}) {
  const t = useBilingual("phoneSim");
  return (
    <section
      className="flex flex-col gap-3 rounded-card border-2 border-line bg-white p-5"
      data-testid="sim-activity"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BilingualText as="h2" size="lg" text={t("actTitle")} />
        <Link href="/phone" className="text-sm font-bold text-ink underline">
          {t("openSim").regional} · {t("openSim").english}
        </Link>
      </div>
      {loading ? (
        <LoadingState />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 tablet:grid-cols-4">
            {[
              ...(showUsers ? [["actUsers", data.simulator_users]] : []),
              ["actSessions", data.sessions],
              ["actLessons", data.lessons_completed],
              ["actCorrect", data.correct],
              ["actIncorrect", data.incorrect],
              ["actMinutes", Math.round(data.call_seconds / 6) / 10],
              ["actInterrupted", data.interrupted],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-2xl bg-cream p-3">
                <dt>
                  <BilingualText size="sm" text={t(k as string)} />
                </dt>
                <dd className="text-2xl font-extrabold text-ink" data-testid={`sim-${k}`}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          <div>
            <BilingualText size="sm" text={t("actByChannel")} />
            <table className="mt-1 w-full text-sm">
              <tbody>
                {(["app", "phone_simulator"] as const).map((ch) => (
                  <tr key={ch} className="border-t border-line" data-testid={`channel-${ch}`}>
                    <th className="py-1 text-left font-bold">
                      {t(ch === "app" ? "chApp" : "chPhone").regional} ·{" "}
                      {t(ch === "app" ? "chApp" : "chPhone").english}
                    </th>
                    <td className="py-1 text-right">
                      {data.channels[ch].answers} {t("actAnswers").english.toLowerCase()}
                    </td>
                    <td className="py-1 text-right">
                      {data.channels[ch].lessons} {t("actLessons").english.toLowerCase()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.recent.length === 0 ? (
            <BilingualText size="sm" className="text-stone" text={t("actEmpty")} />
          ) : (
            <div>
              <BilingualText size="sm" text={t("actRecent")} />
              <ul className="mt-1 flex flex-col gap-1 text-sm">
                {data.recent.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap justify-between gap-2 border-t border-line py-1"
                  >
                    <span className="font-bold">{r.student_name}</span>
                    <span>
                      {r.correct}/{r.answered} · {Math.floor(r.seconds / 60)}:
                      {String(r.seconds % 60).padStart(2, "0")} · {t(STATUS[r.status]).english}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
