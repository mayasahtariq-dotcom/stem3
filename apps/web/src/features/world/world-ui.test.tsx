import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import { DEMO } from "@/mocks/fake-db";
import { FIELD_GEOMETRY } from "@/lib/world/fields";
import { availableToPlace, findSpot, placementProblem } from "@/lib/world/placement";
import { makeTestServices, renderWithProviders, resetAuthStore, signInAs } from "@/test/render";
import { useWorldUi } from "./world-store";

// The 3D preview and canvas are tested in src/three; here only the HTML.
vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="farm-canvas" /> }));

beforeEach(() => {
  resetAuthStore();
  useWorldUi.setState({ field: "starter-meadow", sheet: null, draft: null, picked: null });
});

async function renderFarm() {
  const { FarmView } = await import("@/features/farm/FarmView");
  const services = makeTestServices();
  await signInAs(services, DEMO.studentPhone);
  renderWithProviders(<FarmView />, { services });
  await screen.findByTestId("world-tools");
}

describe("placement helpers", () => {
  it("finds a free, valid spot for a new item and counts what is left to place", () => {
    const g = FIELD_GEOMETRY["starter-meadow"];
    const spot = findSpot(g, "gazebo", [], -6, 14)!;
    expect(spot).not.toBeNull();
    expect(placementProblem(g, { uid: "n", item_id: "gazebo", ...spot }, [])).toBeNull();
    expect(availableToPlace(3, 1, 1)).toBe(1);
    expect(availableToPlace(1, 1, 1)).toBe(0);
  });
});

// jsdom has no full PointerEvent, so window pointer events are sent as mouse-style events (they carry clientX/Y).
describe("Farm worlds UI", () => {
  it("Meadow levels show every field with its lock and XP still needed", async () => {
    await renderFarm();
    fireEvent.click(screen.getByTestId("open-levels"));
    const sheet = await screen.findByTestId("levels-sheet");
    await within(sheet).findByTestId("field-card-mountain-paradise");
    expect(within(sheet).getByTestId("field-card-starter-meadow")).toHaveAttribute("data-locked", "false");
    expect(within(sheet).getByTestId("field-card-blossom-meadow")).toHaveAttribute("data-locked", "true");
    expect(within(sheet).getByText(/Unlocks at 2,000 XP/)).toBeInTheDocument();
    expect(within(sheet).getByText(/Unlocks at 8,000 XP/)).toBeInTheDocument();
  });

  it("the store blocks buying when gems are short and buys when they are enough", async () => {
    await renderFarm();
    fireEvent.click(screen.getByTestId("open-store"));
    const sheet = await screen.findByTestId("store-sheet");
    fireEvent.click(await within(sheet).findByRole("tab", { name: /Buildings/ }));
    fireEvent.click(await within(sheet).findByTestId("store-item-cottage"));
    await waitFor(() => expect(within(sheet).getByTestId("buy")).toBeDisabled());
    expect(within(sheet).getByTestId("buy")).toHaveTextContent(/Need \d+ more gems/);
    fireEvent.click(within(sheet).getByRole("tab", { name: /Decorations/ }));
    fireEvent.click(await within(sheet).findByTestId("store-item-lamp-post"));
    await waitFor(() => expect(within(sheet).getByTestId("buy")).toBeEnabled());
    fireEvent.click(within(sheet).getByTestId("buy"));
    await within(sheet).findByTestId("place-from-store");
  });

  it("placing from the inventory shows rotate, cancel and confirm, and saves the field", async () => {
    await renderFarm();
    fireEvent.click(screen.getByTestId("open-inventory"));
    const sheet = await screen.findByTestId("inventory-sheet");
    fireEvent.click(await within(sheet).findByTestId("place-flower-pot"));
    const bar = await screen.findByTestId("placement-bar");
    expect(within(bar).getByTestId("placement-status")).toHaveAttribute("data-valid", "true");
    fireEvent.click(within(bar).getByTestId("rotate"));
    expect(useWorldUi.getState().draft!.rotation).toBeCloseTo(Math.PI / 4);
    // Moving it into the pond is refused with a "Not quite" reason.
    const pond = FIELD_GEOMETRY["starter-meadow"].water[0]!;
    useWorldUi.getState().moveDraft(pond.x, pond.z);
    await waitFor(() => expect(within(bar).getByTestId("confirm-place")).toBeDisabled());
    expect(within(bar).getByText(/Not quite: it can't go in water/)).toBeInTheDocument();
    useWorldUi.getState().moveDraft(-6, 18);
    await waitFor(() => expect(within(bar).getByTestId("confirm-place")).toBeEnabled());
    fireEvent.click(within(bar).getByTestId("confirm-place"));
    await waitFor(() => expect(screen.queryByTestId("placement-bar")).not.toBeInTheDocument());
    fireEvent.click(screen.getByTestId("open-inventory"));
    const inv = within(await screen.findByTestId("inventory-sheet"));
    await waitFor(() => expect(inv.getByTestId("place-flower-pot")).toBeDisabled());
  });

  it("drags an item from the inventory onto the farm and places it where it is dropped", async () => {
    const { groundPicker } = await import("@/three/worlds/ground-picker");
    groundPicker.pick = (x, y) => (y < 500 ? { x: -6 + x / 1000, z: 18 } : null);     // stand-in for the 3D ground
    try {
      await renderFarm();
      fireEvent.click(screen.getByTestId("open-inventory"));
      const grip = await within(await screen.findByTestId("inventory-sheet")).findByTestId("drag-inv-flower-pot");
      fireEvent.pointerDown(grip, { clientX: 300, clientY: 700 });
      expect(screen.queryByTestId("inventory-sheet")).not.toBeInTheDocument();          // the sheet steps aside
      act(() => void window.dispatchEvent(new MouseEvent("pointermove", { clientX: 200, clientY: 300 })));
      expect(useWorldUi.getState().draft).toMatchObject({ item_id: "flower-pot", z: 18 });
      expect(screen.getByTestId("drag-ghost")).toHaveTextContent(/Drop here|यहाँ छोड़ो/);
      act(() => void window.dispatchEvent(new MouseEvent("pointerup", { clientX: 200, clientY: 300 })));
      await waitFor(() => expect(useWorldUi.getState().draft).toBeNull());               // placed and saved
      fireEvent.click(screen.getByTestId("open-inventory"));
      const inv = within(await screen.findByTestId("inventory-sheet"));
      await waitFor(() => expect(inv.getByTestId("place-flower-pot")).toBeDisabled());   // nothing left to place
    } finally {
      groundPicker.pick = null;
    }
  });

  it("letting go over the menus places nothing", async () => {
    const { groundPicker } = await import("@/three/worlds/ground-picker");
    groundPicker.pick = (_x, y) => (y < 500 ? { x: -6, z: 18 } : null);
    try {
      await renderFarm();
      fireEvent.click(screen.getByTestId("open-inventory"));
      fireEvent.pointerDown(await within(await screen.findByTestId("inventory-sheet")).findByTestId("drag-inv-flower-pot"), { clientX: 300, clientY: 700 });
      act(() => void window.dispatchEvent(new MouseEvent("pointermove", { clientX: 300, clientY: 300 })));
      act(() => void window.dispatchEvent(new MouseEvent("pointerup", { clientX: 300, clientY: 800 })));
      expect(useWorldUi.getState().draft).toBeNull();
      expect(screen.queryByTestId("drag-ghost")).not.toBeInTheDocument();
    } finally {
      groundPicker.pick = null;
    }
  });

  it("cancel drops the draft without saving", async () => {
    await renderFarm();
    fireEvent.click(screen.getByTestId("open-inventory"));
    fireEvent.click(await within(await screen.findByTestId("inventory-sheet")).findByTestId("place-flower-pot"));
    fireEvent.click(within(await screen.findByTestId("placement-bar")).getByTestId("cancel-place"));
    expect(screen.queryByTestId("placement-bar")).not.toBeInTheDocument();
    expect(useWorldUi.getState().draft).toBeNull();
  });
});

describe("Farm worlds on a backend without the world endpoints", () => {
  it("hides the store and editing tools and keeps the farm", async () => {
    const { http, HttpResponse } = await import("msw");
    const { server } = await import("@/mocks/node");
    server.use(http.get(/\/world$/, () => HttpResponse.json({ detail: "Not Found" }, { status: 404 })));
    const { FarmView } = await import("@/features/farm/FarmView");
    const services = makeTestServices();
    await signInAs(services, DEMO.studentPhone);
    renderWithProviders(<FarmView />, { services });
    await screen.findByTestId("farm-canvas");
    await waitFor(() => expect(screen.queryByTestId("world-tools")).not.toBeInTheDocument());
    await screen.findByRole("button", { name: /Learning barn/ });
  });
});
