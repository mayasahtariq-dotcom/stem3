import type { GameStats, MascotStage, ShopItem } from "@mooshala/api-client";
import { onFakeDbReset, registerFakeStore } from "../fake-db";
import { learner } from "../learning/state";

/**
 * MOCK ONLY. The backend has no game service yet (docs/web/backend-handoff.md).
 * Numbers that the web spec documents are used as-is: 5 gems per lesson,
 * 20 per quest, 50 per badge, streak freeze 100 gems (two stored at most),
 * mascot stages at 500 / 2,000 / 8,000 XP. Shop prices are placeholders the
 * real server will replace; the UI only ever shows what the server sends.
 */
export const GAME_RULES = {
  gemsPerLesson: 5,
  gemsPerQuest: 20,
  gemsPerBadge: 50,
  freezeCost: 100,
  maxFreezes: 2,
  mascotStages: [
    { stage: "calf" as MascotStage, xp: 500 },
    { stage: "cow" as MascotStage, xp: 2000 },
    { stage: "champion" as MascotStage, xp: 8000 },
  ],
};

/** Placeholder catalogue (prices are mock values, not from the spec). */
export const SHOP: Omit<ShopItem, "owned">[] = [
  { id: "outfit-straw-hat", kind: "outfit", name: { en: "Straw hat", hi: "पुआल की टोपी", kn: "ಹುಲ್ಲಿನ ಟೋಪಿ" }, icon: "hay", price: 60 },
  { id: "outfit-scarf", kind: "outfit", name: { en: "Red scarf", hi: "लाल दुपट्टा", kn: "ಕೆಂಪು ಶಾಲು" }, icon: "gift", price: 80 },
  { id: "deco-sunflowers", kind: "decoration", name: { en: "Sunflower patch", hi: "सूरजमुखी की क्यारी", kn: "ಸೂರ್ಯಕಾಂತಿ ಮಡಿ" }, icon: "sprout", price: 40 },
  { id: "deco-beehive", kind: "decoration", name: { en: "Beehive", hi: "मधुमक्खी का छत्ता", kn: "ಜೇನುಗೂಡು" }, icon: "bowl", price: 120 },
  { id: "deco-scarecrow", kind: "decoration", name: { en: "Scarecrow", hi: "बिजूका", kn: "ಬೆದರುಬೊಂಬೆ" }, icon: "people", price: 90 },
];

export interface GameUser {
  /** Append-only gems ledger (spec: every balance can be rebuilt). */
  ledger: { key: string; amount: number; at: number }[];
  freezes: number;
  owned: Set<string>;
  outfit: string | null;
  openedPots: Set<string>;
  claimedQuests: Set<string>;
}

let users: Map<string, GameUser>;
onFakeDbReset(() => {
  users = new Map();
  const asha = blank();
  asha.ledger.push({ key: "seed", amount: 135, at: 0 });
  // Badges Asha earned before the gems ledger existed (counted in the seed).
  for (const id of ["first-lesson", "streak-3", "xp-100"]) asha.ledger.push({ key: `badge:${id}`, amount: 0, at: 0 });
  asha.owned.add("deco-sunflowers");
  asha.freezes = 1;
  users.set("u-asha", asha);
});

registerFakeStore("game", () => users, (v) => (users = v));

function blank(): GameUser {
  return { ledger: [], freezes: 0, owned: new Set(), outfit: null, openedPots: new Set(), claimedQuests: new Set() };
}

/** Loads a player and books gems for any lesson finished since (5 each, once per finish). */
export function gameUser(userId: string): GameUser {
  let g = users.get(userId);
  if (!g) {
    g = blank();
    users.set(userId, g);
  }
  for (const [lessonId, p] of learner(userId).progress) {
    if (!p.completedAt) continue;
    const key = `lesson:${lessonId}:${p.completedAt}`;
    if (!g.ledger.some((e) => e.key === key)) g.ledger.push({ key, amount: GAME_RULES.gemsPerLesson, at: p.completedAt });
  }
  return g;
}

export const gems = (g: GameUser) => g.ledger.reduce((n, e) => n + e.amount, 0);

/** Golu Pots waiting: one per lesson finish that hasn't been opened. */
export function pendingPots(userId: string, g: GameUser): string[] {
  return g.ledger.filter((e) => e.key.startsWith("lesson:")).map((e) => `pot-${e.key.slice(7).replace(/:/g, "-")}`).filter((id) => !g.openedPots.has(id));
}

export function mascotFor(xp: number, outfit: string | null): GameStats["mascot"] {
  const stages = GAME_RULES.mascotStages;
  const reached = [...stages].reverse().find((s) => xp >= s.xp);
  const next = stages.find((s) => xp < s.xp);
  // Below 500 XP Golu is still a calf; the stages are reached at 500, 2,000 and 8,000.
  return { stage: reached?.stage ?? "calf", xp_total: xp, next_stage_xp: next?.xp ?? null, outfit };
}

export function gameStats(userId: string): GameStats {
  const g = gameUser(userId);
  return {
    gems: gems(g),
    freezes: g.freezes,
    max_freezes: GAME_RULES.maxFreezes,
    freeze_cost: GAME_RULES.freezeCost,
    mascot: mascotFor(learner(userId).xpTotal, g.outfit),
    owned: [...g.owned],
    pending_pots: pendingPots(userId, g),
  };
}

export const allGameUsers = () => users;
