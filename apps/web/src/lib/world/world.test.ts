import type { FieldLayout, PurchaseResult, StoreItem, WorldState } from "@mooshala/api-client";
import { DEMO } from "@/mocks/fake-db";
import { makeTestServices, resetAuthStore, signInAs } from "@/test/render";
import { CATALOG } from "./catalog";
import { FIELD_GEOMETRY, FIELD_IDS, fieldsUnlockedAt, nextField } from "./fields";
import { groundAt, heightAt } from "./geometry";
import { placementProblem } from "./placement";

const meadow = FIELD_GEOMETRY["starter-meadow"];

describe("field geometry", () => {
  it("every field is a different place: water, paths and pads differ", () => {
    const sig = FIELD_IDS.map((f) => JSON.stringify([FIELD_GEOMETRY[f].water, FIELD_GEOMETRY[f].paths[0], FIELD_GEOMETRY[f].pads[0]]));
    expect(new Set(sig).size).toBe(5);
  });
  it("buildings stand on level pads, the pond is lower and is water", () => {
    const pad = meadow.pads[0]!;
    expect(Math.abs(heightAt(meadow, pad.x, pad.z) - pad.h)).toBeLessThan(0.05);
    const pond = meadow.water[0]!;
    expect(heightAt(meadow, pond.x, pond.z)).toBeLessThan(-1);
    expect(groundAt(meadow, pond.x, pond.z)).toBe("water");
    expect(groundAt(meadow, 13, 4)).toBe("soil");
  });
  it("mountains rise behind the farm (real elevation, not a flat plane)", () => {
    expect(heightAt(FIELD_GEOMETRY["mountain-paradise"], 20, -95)).toBeGreaterThan(40);
    expect(heightAt(meadow, 0, -60)).toBeGreaterThan(heightAt(meadow, 0, 0) + 5);
  });
});

describe("unlocking fields with XP", () => {
  it("follows 0 / 2,000 / 4,000 / 6,000 / 8,000 XP", () => {
    expect(fieldsUnlockedAt(120)).toEqual(["starter-meadow"]);
    expect(fieldsUnlockedAt(4000)).toEqual(["starter-meadow", "blossom-meadow", "golden-valley"]);
    expect(nextField(2500)).toEqual({ id: "golden-valley", xp: 4000 });
    expect(nextField(9000)).toBeNull();
  });
});

describe("placement rules", () => {
  const bench = { uid: "a", item_id: "garden-bench" };
  it("allows open grass and refuses water, paths, buildings, steep hills and the edge", () => {
    expect(placementProblem(meadow, { ...bench, x: -7, z: 13 }, [])).toBeNull();
    expect(placementProblem(meadow, { ...bench, x: -15, z: 5 }, [])).toBe("water");
    expect(placementProblem(meadow, { ...bench, x: 1, z: 20 }, [])).toBe("path");
    expect(placementProblem(meadow, { ...bench, x: 0, z: -9 }, [])).toBe("structure");
    expect(placementProblem(meadow, { ...bench, x: 0, z: -40 }, [])).toBe("outside");
  });
  it("stops objects overlapping but lets fences join into a line", () => {
    const other = { uid: "b", item_id: "garden-bench", x: -7, z: 13, rotation: 0 };
    expect(placementProblem(meadow, { ...bench, x: -7.5, z: 13.2 }, [other])).toBe("overlap");
    const fenceA = { uid: "f1", item_id: "fence", x: -6, z: 24, rotation: 0 };
    expect(placementProblem(meadow, { uid: "f2", item_id: "fence", x: -4.6, z: 24 }, [fenceA])).toBeNull();
  });
  it("every store item has a price, a model and a footprint", () => {
    for (const i of CATALOG) expect(i.price > 0 && i.model && i.radius > 0).toBe(true);
  });
});

describe("store, inventory and layouts (fake backend)", () => {
  beforeEach(() => resetAuthStore());
  async function asha() {
    const s = makeTestServices();
    await signInAs(s, DEMO.studentPhone);
    return s;
  }

  it("buying spends gems once even if the request is retried, and refuses when gems run short", async () => {
    const s = await asha();
    const before = await s.pending.get<WorldState>("/world");
    const key = { "Idempotency-Key": "buy-1" };
    const p1 = await s.pending.post<PurchaseResult>("/world/store/purchase", { item_id: "lamp-post" }, key);
    expect(p1.gems).toBe(before.gems - 20);
    // Same idempotency key again (a retry after a dropped connection): one charge.
    const p2 = await s.pending.post<PurchaseResult>("/world/store/purchase", { item_id: "lamp-post" }, key);
    expect(p2.gems).toBe(p1.gems);
    const store = await s.pending.get<StoreItem[]>("/world/store");
    expect(store.find((i) => i.id === "lamp-post")!.owned).toBe(1);
    await expect(s.pending.post("/world/store/purchase", { item_id: "cottage" })).rejects.toMatchObject({ status: 409 });
  });

  it("each field saves its own arrangement, and stale saves don't overwrite", async () => {
    const s = await asha();
    const l = await s.pending.get<FieldLayout>("/world/fields/starter-meadow/layout");
    expect(l.objects).toHaveLength(2);
    const moved = { ...l.objects[0]!, x: -8, z: 18, rotation: 1 };
    const saved = await s.pending.put<FieldLayout>("/world/fields/starter-meadow/layout", { version: l.version, objects: [moved, l.objects[1]] });
    expect(saved.version).toBe(l.version + 1);
    expect((await s.pending.get<FieldLayout>("/world/fields/starter-meadow/layout")).objects[0]).toMatchObject({ x: -8, z: 18, rotation: 1 });
    // Another field is untouched and locked fields refuse saves.
    expect((await s.pending.get<FieldLayout>("/world/fields/blossom-meadow/layout")).objects).toEqual([]);
    await expect(s.pending.put("/world/fields/blossom-meadow/layout", { version: 0, objects: [] })).rejects.toMatchObject({ status: 403 });
    await expect(s.pending.put("/world/fields/starter-meadow/layout", { version: l.version, objects: [] })).rejects.toMatchObject({ status: 409 });
  });

  it("refuses placing more copies than owned, or in invalid spots", async () => {
    const s = await asha();
    const l = await s.pending.get<FieldLayout>("/world/fields/starter-meadow/layout");
    const extra = { uid: "x", item_id: "garden-bench", x: 8, z: 26, rotation: 0 };
    await expect(s.pending.put("/world/fields/starter-meadow/layout", { version: l.version, objects: [...l.objects, extra] })).rejects.toMatchObject({ status: 422 });
    const inPond = { ...l.objects[0]!, x: -15, z: 5 };
    await expect(s.pending.put("/world/fields/starter-meadow/layout", { version: l.version, objects: [inPond] })).rejects.toMatchObject({ status: 422 });
  });

  it("teachers can't reach the store", async () => {
    const s = makeTestServices();
    await signInAs(s, DEMO.teacherPhone);
    await expect(s.pending.get("/world/store")).rejects.toMatchObject({ status: 403 });
  });
});
