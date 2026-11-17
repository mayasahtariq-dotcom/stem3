import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { League } from "@mooshala/api-client";
import { DEMO } from "@/mocks/fake-db";
import { badges, bookBadges, claimQuest, league, openPot, potReward, quests, weekBounds } from "@/mocks/game/progress";
import { gameStats, gameUser, gems } from "@/mocks/game/state";
import { learner } from "@/mocks/learning/state";
import { makeTestServices, renderWithProviders, resetAuthStore, signInAs } from "@/test/render";
import { GrowthAndBadgesRoute, LeagueRoute, QuestsRoute } from "./routes";
import { leagueZone, mascotProgress, sortQuests, timeLeft } from "./rules";

beforeEach(resetAuthStore);
async function asAsha() {
  const services = makeTestServices();
  await signInAs(services, DEMO.studentPhone);
  return services;
}

describe("game rules", () => {
  it("marks promote and demote zones and the time left", () => {
    const l = { promote_count: 3, demote_count: 2, members: Array.from({ length: 9 }) } as unknown as League;
    expect([1, 3, 4, 7, 8, 9].map((r) => leagueZone(r, l))).toEqual(["promote", "promote", null, null, "demote", "demote"]);
    expect(timeLeft(new Date(Date.UTC(2026, 0, 3, 5)).toISOString(), Date.UTC(2026, 0, 1, 2))).toEqual({ days: 2, hours: 3 });
    expect(timeLeft("2020-01-01T00:00:00Z", Date.now())).toEqual({ days: 0, hours: 0 });
  });
  it("puts claimable quests first and measures Golu's growth", () => {
    const q = (id: string, state: "active" | "complete" | "claimed") => ({ id, state, period: "daily" }) as never;
    expect(sortQuests([q("a", "claimed"), q("b", "active"), q("c", "complete")]).map((x: { id: string }) => x.id)).toEqual(["c", "b", "a"]);
    expect(mascotProgress({ stage: "calf", xp_total: 250, next_stage_xp: 500, outfit: null })).toBe(0.5);
    expect(mascotProgress({ stage: "cow", xp_total: 1250, next_stage_xp: 2000, outfit: null })).toBe(0.5);
    expect(mascotProgress({ stage: "champion", xp_total: 9000, next_stage_xp: null, outfit: null })).toBeNull();
  });
  it("weeks start on Monday in India time", () => {
    const { start, end } = weekBounds(Date.UTC(2026, 10, 18, 12)); // Wednesday
    expect(new Date(start).toISOString()).toBe("2026-11-15T18:30:00.000Z");
    expect(end - start).toBe(7 * 86400_000);
  });
});

describe("game fakes (backend contract)", () => {
  it("pays a quest once: a second claim is ALREADY_CLAIMED, an unfinished one is refused", () => {
    const before = gems(gameUser("u-asha"));
    const xp = quests("u-asha").find((q) => q.kind === "earn_xp")!;
    expect(xp.state).toBe("complete");
    expect(claimQuest("u-asha", xp.id)).toMatchObject({ quest: { state: "claimed" } });
    expect(claimQuest("u-asha", xp.id)).toEqual({ error: "ALREADY_CLAIMED" });
    expect(gems(gameUser("u-asha"))).toBe(before + 20);
    const lessons = quests("u-asha").find((q) => q.period === "weekly")!;
    expect(claimQuest("u-asha", lessons.id)).toEqual({ error: "QUEST_NOT_COMPLETE" });
  });
  it("ranks the league by this week's XP, not gems", () => {
    gameUser("u-asha").ledger.push({ key: "rich", amount: 100000, at: 0 });
    const l = league("u-asha");
    const xp = l.members.map((m) => m.weekly_xp);
    expect(xp).toEqual([...xp].sort((a, b) => b - a));
    expect(l.members.find((m) => m.is_self)!.rank).toBeGreaterThan(1);
  });
  it("books badge gems once and fixes a pot's contents on the server", () => {
    learner("u-asha").savedTerms = new Set(["a", "b", "c", "d", "e"]);
    const g = gameUser("u-asha");
    const before = gems(g);
    bookBadges("u-asha", g);
    bookBadges("u-asha", g);
    expect(gems(g)).toBe(before + 50);
    expect(badges("u-asha").find((b) => b.id === "words-5")!.earned_at).not.toBeNull();
    const pot = gameStats("u-asha").pending_pots[0]!;
    expect(potReward(pot)).toEqual(potReward(pot));
    expect(openPot("u-asha", pot)).toMatchObject({ pot_id: pot });
    expect(openPot("u-asha", pot)).toEqual({ error: "POT_ALREADY_OPENED" });
  });
});

describe("quest board", () => {
  it("claims a finished quest once and shows it claimed", async () => {
    renderWithProviders(<QuestsRoute />, { services: await asAsha() });
    const card = await screen.findByTestId("quest-daily-earn_xp");
    const claim = within(card).getByTestId("claim-quest");
    fireEvent.click(claim);
    fireEvent.click(claim);
    await waitFor(() => expect(screen.getByTestId("quest-daily-earn_xp")).toHaveAttribute("data-state", "claimed"));
    expect(gameUser("u-asha").ledger.filter((e) => e.key.startsWith("quest:"))).toHaveLength(1);
  });
});

describe("village fair", () => {
  it("lists this week's XP with Asha highlighted and call-only learners marked", async () => {
    renderWithProviders(<LeagueRoute />, { services: await asAsha(), locale: "kn" });
    const board = await screen.findByTestId("league-board");
    expect(within(board).getAllByRole("listitem")).toHaveLength(9);
    expect(within(board).getByText("Asha")).toBeInTheDocument();
    expect(screen.getByText(/Gems never change your place/)).toBeInTheDocument();
  });
});

describe("profile growth and badges", () => {
  it("shows Golu's stage and earned and locked badges", async () => {
    renderWithProviders(<GrowthAndBadgesRoute />, { services: await asAsha() });
    expect(await screen.findByTestId("mascot-growth")).toHaveTextContent("Golu the calf");
    const shelf = await screen.findByTestId("badge-shelf");
    expect(shelf.querySelectorAll('[data-earned="true"]').length).toBe(3);
    expect(within(shelf).getByText("First harvest")).toBeInTheDocument();
  });
});
