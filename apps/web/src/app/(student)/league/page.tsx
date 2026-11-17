"use client";
import clsx from "clsx";
import { BilingualText, Card, QueryState, StickerIcon } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { useLeague } from "@/lib/queries";

const TIER_COLOR: Record<string, string> = { bronze: "#C9772B", silver: "#A8B3BD", gold: "#FFC800", ruby: "#E0115F", diamond: "#1CB0F6" };

export default function LeaguePage() {
  const { t, bi } = useT();
  const q = useLeague();
  const d = q.data;
  const h = bi("league.title");
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <BilingualText as="h1" size="xl" regional={h.regional} english={h.english} />
      <QueryState loading={q.isLoading} error={q.error} onRetry={() => q.refetch()}>
        {d && !d.enabled ? <Card className="text-center text-muted">{t("league.off")}</Card> : d && <>
          {/* Own progress first */}
          <Card className="flex items-center gap-4">
            <svg width="64" height="64" viewBox="0 0 32 32" aria-hidden><path d="M6 6h20v8c0 7-5 11-10 13-5-2-10-6-10-13z"
              fill={TIER_COLOR[d.tier] ?? "#C9772B"} stroke="#fff" strokeWidth="2" /></svg>
            <div><div className="text-2xl font-black">{t(`tier.${d.tier}`)}</div>
              <div className="font-bold text-sky">{d.rank ? t("league.rank", { rank: d.rank }) : t("league.notYet")}</div>
              <div className="text-sm text-muted">{d.xp} XP</div></div>
          </Card>
          {d.pod.length > 0 && <Card>
            <p className="mb-3 text-sm text-muted">{t("league.zones", { up: d.promote_zone ?? 3, down: d.demote_zone ?? 3 })}</p>
            <ol className="divide-y-2 divide-line">{d.pod.map((r) => (
              <li key={r.rank} className={clsx("flex items-center gap-3 py-3", r.me && "-mx-2 rounded-[12px] bg-grass/10 px-2")}>
                <span className={clsx("w-8 text-center text-lg font-black", r.rank <= (d.promote_zone ?? 3) ? "text-grass-dark" : "text-muted")}>{r.rank}</span>
                <span className="flex-1 font-bold">{r.me ? `${r.name} (${t("league.you")})` : r.name}
                  {r.is_call && <StickerIcon name="phone" size={18} className="ml-2 inline" />}</span>
                <span className="font-bold text-flame">{r.xp} XP</span>
              </li>))}</ol>
          </Card>}
        </>}
      </QueryState>
    </div>
  );
}
