"use client";
import type { Schemas } from "@mooshala/api-client";
import { BilingualText, Card, EmptyState, ErrorState, LoadingState, StickerIcon } from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useTri } from "@/lib/i18n/use-tri";
import { cn } from "@/lib/utils/cn";
import { filterStudents, type StudentFilter, type StudentSort } from "./students";
import { PageTitle, Pill, pct } from "./shared";

export interface StudentsScreenProps {
  rows: Schemas["StudentRow"][] | undefined;
  loading: boolean;
  error: unknown;
  noClasses: boolean;
  filter: StudentFilter;
  sort: StudentSort;
  query: string;
  onFilter: (f: StudentFilter) => void;
  onSort: (s: StudentSort) => void;
  onQuery: (q: string) => void;
  onOpen: (id: string) => void;
  onRetry: () => void;
}

export function StudentsScreen(p: StudentsScreenProps) {
  const t = useBilingual("teacher");
  const tri = useTri();
  if (p.noClasses) return <EmptyState message={t("empty")} className="min-h-[50vh]" />;
  if (p.error) return <ErrorState error={p.error} onRetry={p.onRetry} className="min-h-[50vh]" />;
  if (p.loading || !p.rows) return <LoadingState className="min-h-[50vh]" />;
  const shown = filterStudents(p.rows, p.filter, p.query, p.sort);
  return (
    <div className="flex flex-col gap-4">
      <PageTitle text={t("studentsTitle")} icon="people" />
      <div className="flex flex-wrap items-end gap-3">
        <div role="group" aria-label={t("filter").english} className="flex gap-2">
          {(["all", "help"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={p.filter === f}
              onClick={() => p.onFilter(f)}
              className={cn("min-h-11 rounded-button border-2 px-4 font-bold", p.filter === f ? "border-grass-strong bg-white" : "border-line bg-cloud text-stone")}
            >
              <BilingualText as="span" size="sm" text={f === "all" ? t("allStudents") : t("needsHelp")} />
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          <BilingualText as="span" size="sm" text={t("search")} />
          <input value={p.query} onChange={(e) => p.onQuery(e.target.value)} className="min-h-11 rounded-button border-2 border-line bg-white px-3" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          <BilingualText as="span" size="sm" text={t("sortBy")} />
          <select value={p.sort} onChange={(e) => p.onSort(e.target.value as StudentSort)} className="min-h-11 rounded-button border-2 border-line bg-white px-3">
            <option value="name">{t("sortName").regional}</option>
            <option value="accuracy">{t("sortAccuracy").regional}</option>
            <option value="streak">{t("sortStreak").regional}</option>
          </select>
        </label>
      </div>
      {p.rows.length === 0 ? (
        <EmptyState message={t("noStudentsYet")} />
      ) : shown.length === 0 ? (
        <EmptyState message={t("noMatch")} />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left">
            <caption className="sr-only">{t("studentsTitle").english}</caption>
            <thead className="border-b-2 border-line text-sm text-stone">
              <tr>
                <th scope="col" className="p-3">{t("colName").regional}</th>
                <th scope="col" className="p-3">{t("colLesson").regional}</th>
                <th scope="col" className="p-3">{t("colAccuracy").regional}</th>
                <th scope="col" className="p-3">{t("colStreak").regional}</th>
                <th scope="col" className="p-3">{t("colStatus").regional}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <th scope="row" className="p-3">
                    <button type="button" onClick={() => p.onOpen(s.id)} className="min-h-11 font-bold text-sky-strong underline-offset-2 hover:underline">
                      {s.name}
                    </button>
                  </th>
                  <td className="p-3">{s.current_lesson ? <BilingualText as="span" size="sm" text={tri(s.current_lesson)} /> : "–"}</td>
                  <td className="p-3 tabular-nums">{pct(s.accuracy)}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <StickerIcon name="flame" size={18} /> {s.streak}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="flex flex-wrap gap-1">
                      {s.idle && <Pill tone="warn">{t("idleDays", { n: s.idle_days }).regional}</Pill>}
                      {s.overdue > 0 && <Pill tone="warn">{t("overdueN", { n: s.overdue }).regional}</Pill>}
                      {s.behind && !s.idle && !s.overdue && <Pill tone="warn">{t("behindShort").regional}</Pill>}
                      {!s.idle && !s.behind && <Pill tone="good">{t("onTrack").regional}</Pill>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
