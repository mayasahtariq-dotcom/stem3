"use client";
import { useT } from "@/lib/i18n";
import { useQuests } from "@/lib/queries";
import { ProgressBar, QueryState, StickerIcon } from "./ui";

export function QuestList({ compact = false }: { compact?: boolean }) {
  const { t } = useT();
  const q = useQuests();
  const list = (q.data ?? []).filter((x) => !compact || x.kind !== "weekly");
  return (
    <QueryState loading={q.isLoading} error={q.error} onRetry={() => q.refetch()}>
      <ul className="space-y-4">
        {list.map((x) => (
          <li key={x.code} className="flex items-center gap-3">
            <StickerIcon name={x.completed ? "check" : x.kind === "revision" ? "star" : "quest"} size={34} />
            <div className="flex-1">
              <div className="flex justify-between text-sm font-bold"><span>{t(`quest.${x.code}`)}</span>
                <span className="text-sky">{Math.min(x.progress, x.target)}/{x.target}</span></div>
              <ProgressBar value={x.progress} max={x.target} color={x.completed ? "bg-grass" : "bg-sun"} label={t(`quest.${x.code}`)} />
              {!compact && <div className="mt-1 flex items-center gap-1 text-xs text-muted"><StickerIcon name="gem" size={14} />+{x.gems}
                {x.concepts?.length ? <span className="ml-2">· {x.concepts.join(", ")}</span> : null}</div>}
            </div>
          </li>))}
      </ul>
    </QueryState>
  );
}
