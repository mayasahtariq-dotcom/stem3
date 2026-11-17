/**
 * Game endpoints named in the web spec (section 8, "Game": GET /game/stats,
 * GET /game/quests, GET /game/league, POST /game/pots/{id}/open,
 * POST /game/freeze, GET /game/badges) but NOT implemented by the backend
 * yet. The payloads below are the web app's assumption and are mocked in
 * apps/web/src/mocks/game. See docs/web/backend-handoff.md before building
 * them; the backend owns every number (gems, rewards, ranks).
 *
 * Endpoints marked "assumed" are not even named in the spec; the web needs
 * them to finish a documented flow (claiming a quest, buying an outfit).
 */

export type MascotStage = "calf" | "cow" | "champion";

export interface GameStats {
  gems: number;
  /** Streak freezes stored (spec: up to two). */
  freezes: number;
  max_freezes: number;
  freeze_cost: number;
  mascot: { stage: MascotStage; xp_total: number; next_stage_xp: number | null; outfit: string | null };
  /** Cosmetic items the student owns (outfits, farm decorations). */
  owned: string[];
  /** Golu Pots waiting to be opened. */
  pending_pots: string[];
}

/** GET /game/shop (assumed): what gems can buy. Prices come from the server. */
export interface ShopItem {
  id: string;
  kind: "outfit" | "decoration";
  name: { en: string; hi: string; kn: string };
  icon: string;
  price: number;
  owned: boolean;
}

export interface Quest {
  id: string;
  period: "daily" | "weekly";
  kind: "answer_questions" | "combo" | "finish_lessons" | "perfect_lesson" | "earn_xp";
  title: { en: string; hi: string; kn: string };
  progress: number;
  goal: number;
  reward_gems: number;
  state: "active" | "complete" | "claimed";
  ends_at: string;
}

export interface LeagueMember {
  rank: number;
  name: string;
  weekly_xp: number;
  is_self: boolean;
  call_only: boolean;
}

export interface League {
  enabled: boolean;
  tier: "bronze" | "silver" | "gold" | "ruby" | "diamond";
  week_ends_at: string;
  promote_count: number;
  demote_count: number;
  members: LeagueMember[];
}

export interface Badge {
  id: string;
  name: { en: string; hi: string; kn: string };
  rule: { en: string; hi: string; kn: string };
  icon: string;
  earned_at: string | null;
  progress: number | null;
  goal: number | null;
}

/** POST /game/quests/{id}/claim (assumed) */
export interface QuestClaimed {
  quest: Quest;
  stats: GameStats;
}

export interface PotReward {
  kind: "gems" | "sticker" | "outfit";
  amount: number | null;
  item: string | null;
}

export interface PotOpened {
  pot_id: string;
  reward: PotReward;
  stats: GameStats;
}

export const GAME_PATHS = {
  stats: "/game/stats",
  freeze: "/game/freeze",
  shop: "/game/shop", // assumed
  buy: (item: string) => `/game/shop/${encodeURIComponent(item)}/buy`, // assumed
  equip: "/game/mascot/outfit", // assumed
  quests: "/game/quests",
  claimQuest: (id: string) => `/game/quests/${encodeURIComponent(id)}/claim`, // assumed
  league: "/game/league",
  badges: "/game/badges",
  openPot: (id: string) => `/game/pots/${encodeURIComponent(id)}/open`,
} as const;
