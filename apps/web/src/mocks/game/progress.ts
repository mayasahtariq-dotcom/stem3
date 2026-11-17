import type { Badge, League, PotOpened, PotReward, Quest } from "@mooshala/api-client";
import { fakeDb } from "../fake-db";
import { fakeNow, indiaDay, learner, RULES } from "../learning/state";
import { GAME_RULES, gameStats, gameUser, type GameUser } from "./state";

/**
 * MOCK ONLY: quests, the weekly league, badges and Golu Pots. The spec's
 * numbers are used (20 gems per quest, 50 per badge); quest goals, league
 * names and pot contents are placeholders the real server replaces. Pot
 * contents are decided on the server and the UI never shows odds.
 */
const tri = (en: string, hi: string, kn: string) => ({ en, hi, kn });
const DAY = 86400_000;
const IST = 5.5 * 3600_000;

/** Monday 00:00 IST of this week, and next Monday. */
export function weekBounds(now: number) {
  const ist = new Date(now + IST);
  const dow = (ist.getUTCDay() + 6) % 7;
  const start = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - dow * DAY - IST;
  return { start, end: start + 7 * DAY };
}

function counts(userId: string) {
  const now = fakeNow();
  const s = learner(userId);
  const today = indiaDay(now);
  const { start, end } = weekBounds(now);
  const answeredToday = s.attempts.filter((a) => indiaDay(a.at) === today).length;
  const finished = [...s.progress.values()].map((p) => p.completedAt).filter((x): x is number => Boolean(x));
  const finishedToday = finished.filter((t) => indiaDay(t) === today).length;
  const finishedWeek = finished.filter((t) => t >= start && t < end).length;
  const weekXp = s.attempts.filter((a) => a.at >= start && a.correct).reduce((n, a) => n + (a.firstTry ? RULES.xpFirstTry : RULES.xpRetry), 0) + finishedWeek * RULES.xpLessonBonus;
  return { s, today, end, answeredToday, finishedToday, finishedWeek, weekXp };
}

export function quests(userId: string): Quest[] {
  const c = counts(userId);
  const g = gameUser(userId);
  const dayEnd = new Date(Date.parse(`${c.today}T00:00:00Z`) + DAY - IST).toISOString();
  const weekKey = new Date(c.end).toISOString().slice(0, 10);
  const defs: Omit<Quest, "state" | "reward_gems">[] = [
    { id: `daily-xp-${c.today}`, period: "daily", kind: "earn_xp", title: tri("Earn 10 XP today", "आज 10 XP कमाओ", "ಇಂದು 10 XP ಗಳಿಸಿ"), progress: Math.min(10, c.s.xpToday), goal: 10, ends_at: dayEnd },
    { id: `daily-answer-${c.today}`, period: "daily", kind: "answer_questions", title: tri("Answer 10 questions", "10 प्रश्नों के जवाब दो", "10 ಪ್ರಶ್ನೆಗಳಿಗೆ ಉತ್ತರಿಸಿ"), progress: Math.min(10, c.answeredToday), goal: 10, ends_at: dayEnd },
    { id: `daily-lesson-${c.today}`, period: "daily", kind: "finish_lessons", title: tri("Finish a lesson", "एक पाठ पूरा करो", "ಒಂದು ಪಾಠ ಮುಗಿಸಿ"), progress: Math.min(1, c.finishedToday), goal: 1, ends_at: dayEnd },
    { id: `weekly-lessons-${weekKey}`, period: "weekly", kind: "finish_lessons", title: tri("Finish 5 lessons this week", "इस हफ़्ते 5 पाठ पूरे करो", "ಈ ವಾರ 5 ಪಾಠ ಮುಗಿಸಿ"), progress: Math.min(5, c.finishedWeek), goal: 5, ends_at: new Date(c.end).toISOString() },
  ];
  return defs.map((q) => ({ ...q, reward_gems: GAME_RULES.gemsPerQuest, state: g.claimedQuests.has(q.id) ? "claimed" : q.progress >= q.goal ? "complete" : "active" }));
}

export function claimQuest(userId: string, id: string): { error: "NOT_FOUND" | "ALREADY_CLAIMED" | "QUEST_NOT_COMPLETE" } | { quest: Quest } {
  const q = quests(userId).find((x) => x.id === id);
  if (!q) return { error: "NOT_FOUND" };
  if (q.state === "claimed") return { error: "ALREADY_CLAIMED" };
  if (q.state !== "complete") return { error: "QUEST_NOT_COMPLETE" };
  const g = gameUser(userId);
  g.claimedQuests.add(id);
  g.ledger.push({ key: `quest:${id}`, amount: GAME_RULES.gemsPerQuest, at: fakeNow() });
  return { quest: { ...q, state: "claimed" } };
}

const RIVALS: [string, number, boolean][] = [
  ["Bharat", 210, false],
  ["Esha", 160, false],
  ["Harsh", 95, false],
  ["Chitra", 70, false],
  ["Ramu", 55, true],
  ["Gauri", 30, false],
  ["Dev", 10, false],
  ["Farhan", 0, false],
];

/** The weekly league: ranked by XP earned this week, never by gems. */
export function league(userId: string): League {
  const c = counts(userId);
  const self = fakeDb().users;
  const name = [...self.values()].find((u) => u.id === userId)?.name ?? "You";
  const seedXp = userId === "u-asha" ? 40 : 0;
  const rows = [...RIVALS.map(([n, xp, callOnly]) => ({ name: n, weekly_xp: xp, is_self: false, call_only: callOnly })), { name, weekly_xp: seedXp + c.weekXp, is_self: true, call_only: false }];
  rows.sort((a, b) => b.weekly_xp - a.weekly_xp || Number(b.is_self) - Number(a.is_self));
  return { enabled: true, tier: "bronze", week_ends_at: new Date(c.end).toISOString(), promote_count: 3, demote_count: 2, members: rows.map((r, i) => ({ rank: i + 1, ...r })) };
}

interface BadgeDef {
  id: string;
  name: ReturnType<typeof tri>;
  rule: ReturnType<typeof tri>;
  icon: string;
  goal: number;
  value: (userId: string) => number;
}

export const BADGES: BadgeDef[] = [
  { id: "first-lesson", name: tri("First harvest", "पहली फ़सल", "ಮೊದಲ ಫಸಲು"), rule: tri("Finish your first lesson", "अपना पहला पाठ पूरा करो", "ನಿಮ್ಮ ಮೊದಲ ಪಾಠ ಮುಗಿಸಿ"), icon: "corn", goal: 1, value: (u) => [...learner(u).progress.values()].filter((p) => p.completedAt).length },
  { id: "streak-3", name: tri("Three sunny days", "तीन धूप वाले दिन", "ಮೂರು ಬಿಸಿಲಿನ ದಿನ"), rule: tri("Learn 3 days in a row", "लगातार 3 दिन सीखो", "ಸತತ 3 ದಿನ ಕಲಿಯಿರಿ"), icon: "flame", goal: 3, value: (u) => learner(u).longestStreak },
  { id: "streak-7", name: tri("Full week", "पूरा हफ़्ता", "ಪೂರ್ಣ ವಾರ"), rule: tri("Learn 7 days in a row", "लगातार 7 दिन सीखो", "ಸತತ 7 ದಿನ ಕಲಿಯಿರಿ"), icon: "trophy", goal: 7, value: (u) => learner(u).longestStreak },
  { id: "xp-100", name: tri("Hundred club", "सौ का क्लब", "ನೂರರ ಕ್ಲಬ್"), rule: tri("Earn 100 XP", "100 XP कमाओ", "100 XP ಗಳಿಸಿ"), icon: "star", goal: 100, value: (u) => learner(u).xpTotal },
  { id: "words-5", name: tri("Word collector", "शब्द संग्राहक", "ಪದ ಸಂಗ್ರಾಹಕ"), rule: tri("Save 5 words", "5 शब्द सेव करो", "5 ಪದ ಉಳಿಸಿ"), icon: "books", goal: 5, value: (u) => learner(u).savedTerms.size },
  { id: "lessons-5", name: tri("Busy farmer", "मेहनती किसान", "ಶ್ರಮಜೀವಿ ರೈತ"), rule: tri("Finish 5 lessons", "5 पाठ पूरे करो", "5 ಪಾಠ ಮುಗಿಸಿ"), icon: "seeds", goal: 5, value: (u) => [...learner(u).progress.values()].filter((p) => p.completedAt).length },
];

/** Books 50 gems once for each badge reached (the ledger key makes it idempotent). */
export function bookBadges(userId: string, g: GameUser) {
  for (const b of BADGES) {
    if (b.value(userId) < b.goal) continue;
    const key = `badge:${b.id}`;
    if (!g.ledger.some((e) => e.key === key)) g.ledger.push({ key, amount: GAME_RULES.gemsPerBadge, at: fakeNow() });
  }
}

export function badges(userId: string): Badge[] {
  const g = gameUser(userId);
  return BADGES.map((b) => {
    const v = b.value(userId);
    const earned = g.ledger.find((e) => e.key === `badge:${b.id}`);
    return { id: b.id, name: b.name, rule: b.rule, icon: b.icon, earned_at: v >= b.goal && earned ? new Date(earned.at || fakeNow()).toISOString() : null, progress: v >= b.goal ? null : v, goal: v >= b.goal ? null : b.goal };
  });
}

/** Server-side pot contents: fixed per pot id, so reopening can't reroll. */
export function potReward(potId: string): PotReward {
  let h = 0;
  for (const ch of potId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  if (h % 4 === 0) return { kind: "sticker", amount: null, item: ["sprout", "duck", "carrot"][h % 3]! };
  return { kind: "gems", amount: 5 + (h % 3) * 5, item: null };
}

export function openPot(userId: string, potId: string): { error: "NOT_FOUND" | "POT_ALREADY_OPENED" } | PotOpened {
  const g = gameUser(userId);
  if (g.openedPots.has(potId)) return { error: "POT_ALREADY_OPENED" };
  if (!gameStats(userId).pending_pots.includes(potId)) return { error: "NOT_FOUND" };
  const reward = potReward(potId);
  g.openedPots.add(potId);
  if (reward.kind === "gems") g.ledger.push({ key: `pot:${potId}`, amount: reward.amount!, at: fakeNow() });
  if (reward.kind !== "gems" && reward.item) g.owned.add(`sticker-${reward.item}`);
  return { pot_id: potId, reward, stats: gameStats(userId) };
}
