import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import type { GameStats } from "@mooshala/api-client";
import { DEMO } from "@/mocks/fake-db";
import { buildPath } from "@/mocks/learning/handlers";
import { gameUser } from "@/mocks/game/state";
import { makeTestServices, renderWithProviders, resetAuthStore, signInAs } from "@/test/render";
import { useLessonSessions } from "@/features/learning/session-store";
import { startSession } from "@/features/learning/session";
import { buildFarmScene, MAX_STATIONS } from "./farm-model";

// The 3D canvas is tested in src/three; here only the HTML around it.
vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="farm-canvas" /> }));

beforeEach(resetAuthStore);

const game: GameStats = { gems: 10, freezes: 0, max_freezes: 2, freeze_cost: 100, mascot: { stage: "cow", xp_total: 600, next_stage_xp: 2000, outfit: "outfit-scarf" }, owned: ["deco-beehive", "outfit-scarf"], pending_pots: ["p1"] };

describe("farm scene model", () => {
  it("turns the path into lesson markers, blooming flowers and growing crops", () => {
    const path = buildPath("u-asha");
    const scene = buildFarmScene(path, game);
    expect(scene.stations.map((s) => s.state)).toEqual(["done", "current", "locked", "locked", "locked", "locked"]);
    expect(scene.bloomedFlowers).toBe(1);
    expect(scene.cropGrowth).toBeCloseTo(0.2 + 0.8 / 6);
    expect(scene.decorations).toEqual(["deco-beehive"]);
    expect(scene.mascot).toEqual({ stage: "cow", outfit: "outfit-scarf" });
    expect(scene.potWaiting).toBe(true);
  });
  it("shows a window of markers around the current lesson on long courses", () => {
    const path = buildPath("u-asha");
    const many = { ...path, units: [{ ...path.units[0]!, lessons: Array.from({ length: 20 }, (_, i) => ({ ...path.units[0]!.lessons[0]!, id: `l${i}`, state: i < 12 ? "done" : i === 12 ? "current" : "locked" }) as never) }] };
    const scene = buildFarmScene(many, null);
    expect(scene.stations).toHaveLength(MAX_STATIONS);
    expect(scene.stations[2]!.id).toBe("l12");
  });
});

describe("FarmView destinations", () => {
  async function renderFarm() {
    const { FarmView } = await import("./FarmView");
    const services = makeTestServices();
    await signInAs(services, DEMO.studentPhone);
    renderWithProviders(<FarmView />, { services });
    await screen.findByRole("button", { name: /Parts of a cell/ });
  }
  const open = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name }));

  it("the learning barn offers the current lesson and chapter progress", async () => {
    await renderFarm();
    open(/Learning barn/);
    const panel = await screen.findByTestId("farm-panel");
    expect(within(panel).getByText("Lesson 2 of 6")).toBeInTheDocument();
    expect(within(panel).getByTestId("start-lesson")).toHaveAttribute("href", "/farm/lesson/lesson-2");
    expect(within(panel).getByText("Cell structure")).toBeInTheDocument();
  });

  it("a locked lesson marker says which lesson to finish first", async () => {
    await renderFarm();
    open(/Plant and animal cells/);
    const panel = await screen.findByTestId("farm-panel");
    expect(within(panel).getByText(/Finish .Parts of a cell. first/)).toBeInTheDocument();
    expect(within(panel).queryByTestId("start-lesson")).not.toBeInTheDocument();
  });

  it("the market spends gems through the server and never blocks lessons", async () => {
    await renderFarm();
    open(/Market stall/);
    const panel = await screen.findByTestId("farm-panel");
    await within(panel).findByText("140 gems");
    expect(within(panel).getByText(/never lock a lesson/)).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: /Buy Beehive for 120 gems/ }));
    await waitFor(() => expect(gameUser("u-asha").owned.has("deco-beehive")).toBe(true));
    expect(await within(panel).findByText("20 gems")).toBeInTheDocument();
  });

  it("a Golu Pot waits after a lesson; the server decides what's inside and it opens once", async () => {
    await renderFarm();
    open(/Golu Pot/);
    const panel = await screen.findByTestId("pot-panel");
    fireEvent.click(within(panel).getByTestId("open-pot"));
    expect(await within(panel).findByTestId("pot-reward")).toBeInTheDocument();
    expect(gameUser("u-asha").openedPots.size).toBe(1);
    expect(within(panel).queryByTestId("open-pot")).not.toBeInTheDocument();
    expect(within(panel).queryByText(/%/)).not.toBeInTheDocument(); // no odds shown
  });

  it("the farmhouse opens the word book and the lab opens Golu's doubt chat", async () => {
    await renderFarm();
    open(/Farmhouse study/);
    expect(await screen.findByTestId("open-terms")).toHaveAttribute("href", "/farm/terms?course=course-cell");
    open(/Farm lab/);
    expect(await screen.findByTestId("open-ask")).toHaveAttribute("href", "/farm/ask?course=course-cell");
  });

  it("offers to resume an interrupted lesson", async () => {
    useLessonSessions.getState().save({ courseId: "course-cell", title: { en: "Parts of a cell", hi: "कोशिका के भाग", kn: "ಜೀವಕೋಶದ ಭಾಗಗಳು" }, session: startSession("lesson-2", ["q-2-1"]), savedAt: Date.now() });
    await renderFarm();
    expect(screen.getByTestId("resume-lesson")).toHaveAttribute("href", "/farm/lesson/lesson-2");
  });
});
