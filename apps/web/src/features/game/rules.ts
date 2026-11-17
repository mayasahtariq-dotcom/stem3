import type { GameStats, League, Quest } from "@mooshala/api-client";

/** Pure display rules for the game layer. Every number comes from the server. */

export function leagueZone(rank: number, l: Pick<League, "promote_count" | "demote_count" | "members">): "promote" | "demote" | null {
  if (rank <= l.promote_count) return "promote";
  if (l.members.length > l.promote_count + l.demote_count && rank > l.members.length - l.demote_count) return "demote";
  return null;
}

/** Whole days and hours left until an ISO time (never negative). */
export function timeLeft(iso: string, now: number): { days: number; hours: number } {
  const ms = Math.max(0, Date.parse(iso) - now);
  return { days: Math.floor(ms / 86400_000), hours: Math.floor((ms % 86400_000) / 3600_000) };
}

/** Claimable first, then active, then claimed; daily before weekly. */
export function sortQuests(qs: Quest[]): Quest[] {
  const order = { complete: 0, active: 1, claimed: 2 } as const;
  return [...qs].sort((a, b) => order[a.state] - order[b.state] || (a.period === b.period ? 0 : a.period === "daily" ? -1 : 1));
}

const STAGE_START = { calf: 0, cow: 500, champion: 2000 } as const;

/** How far Golu is toward the next stage (0..1), or null at the top stage. */
export function mascotProgress(m: GameStats["mascot"]): number | null {
  if (m.next_stage_xp === null) return null;
  const from = m.stage === "calf" ? 0 : STAGE_START[m.stage];
  const span = m.next_stage_xp - from;
  return span > 0 ? Math.max(0, Math.min(1, (m.xp_total - from) / span)) : 0;
}
