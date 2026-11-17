import { http, HttpResponse } from "msw";
import { GAME_PATHS, type GameStats, type ShopItem } from "@mooshala/api-client";
import { userForToken } from "../fake-db";
import { GAME_RULES, SHOP, gameStats, gameUser, gems } from "./state";
import { badges, bookBadges, claimQuest, league, openPot, quests } from "./progress";

/**
 * MOCK ONLY: game endpoints the backend hasn't built (see state.ts and
 * docs/web/backend-handoff.md). Kept apart from the real-endpoint fakes.
 */
const err = (status: number, code: string) => HttpResponse.json({ detail: { code } }, { status });
const auth = (request: Request) => {
  const h = request.headers.get("Authorization") ?? "";
  return h.startsWith("Bearer ") ? userForToken(h.slice(7)) : null;
};
const json = <T,>(body: T) => HttpResponse.json(body as never);
const ERR_STATUS = { NOT_FOUND: 404, ALREADY_CLAIMED: 409, QUEST_NOT_COMPLETE: 409, POT_ALREADY_OPENED: 409 } as const;

export function makeGameHandlers(base: string) {
  return [
    http.get(`${base}${GAME_PATHS.stats}`, ({ request }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      bookBadges(u.id, gameUser(u.id));
      return json<GameStats>(gameStats(u.id));
    }),

    http.get(`${base}${GAME_PATHS.quests}`, ({ request }) => {
      const u = auth(request);
      return u ? json(quests(u.id)) : err(401, "UNAUTHORIZED");
    }),

    http.post(`${base}/game/quests/:id/claim`, ({ request, params }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      const r = claimQuest(u.id, String(params.id));
      if ("error" in r) return err(ERR_STATUS[r.error], r.error);
      return json({ quest: r.quest, stats: gameStats(u.id) });
    }),

    http.get(`${base}${GAME_PATHS.league}`, ({ request }) => {
      const u = auth(request);
      return u ? json(league(u.id)) : err(401, "UNAUTHORIZED");
    }),

    http.get(`${base}${GAME_PATHS.badges}`, ({ request }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      bookBadges(u.id, gameUser(u.id));
      return json(badges(u.id));
    }),

    http.post(`${base}/game/pots/:id/open`, ({ request, params }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      const r = openPot(u.id, String(params.id));
      if ("error" in r) return err(ERR_STATUS[r.error], r.error);
      return json(r);
    }),

    http.post(`${base}${GAME_PATHS.freeze}`, ({ request }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      const g = gameUser(u.id);
      if (g.freezes >= GAME_RULES.maxFreezes) return err(409, "FREEZES_FULL");
      if (gems(g) < GAME_RULES.freezeCost) return err(409, "NOT_ENOUGH_GEMS");
      g.ledger.push({ key: `freeze:${Date.now()}:${g.ledger.length}`, amount: -GAME_RULES.freezeCost, at: Date.now() });
      g.freezes += 1;
      return json<GameStats>(gameStats(u.id));
    }),

    http.get(`${base}${GAME_PATHS.shop}`, ({ request }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      const g = gameUser(u.id);
      return json<ShopItem[]>(SHOP.map((i) => ({ ...i, owned: g.owned.has(i.id) })));
    }),

    http.post(`${base}/game/shop/:item/buy`, ({ request, params }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      const item = SHOP.find((i) => i.id === params.item);
      if (!item) return err(404, "NOT_FOUND");
      const g = gameUser(u.id);
      if (g.owned.has(item.id)) return err(409, "ALREADY_OWNED");
      if (gems(g) < item.price) return err(409, "NOT_ENOUGH_GEMS");
      g.ledger.push({ key: `buy:${item.id}`, amount: -item.price, at: Date.now() });
      g.owned.add(item.id);
      return json<GameStats>(gameStats(u.id));
    }),

    http.put(`${base}${GAME_PATHS.equip}`, async ({ request }) => {
      const u = auth(request);
      if (!u) return err(401, "UNAUTHORIZED");
      const { outfit } = (await request.json()) as { outfit: string | null };
      const g = gameUser(u.id);
      if (outfit && !g.owned.has(outfit)) return err(403, "NOT_FOUND");
      g.outfit = outfit;
      return json<GameStats>(gameStats(u.id));
    }),
  ];
}
