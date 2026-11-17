import { setupWorker } from "msw/browser";
import { dumpFakeDb, loadFakeDb, resetFakeDb } from "./fake-db";
import { handlers } from "./handlers";

const SNAPSHOT_KEY = "mooshala.fakeBackend";

/**
 * Starts the fake backend in the browser (NEXT_PUBLIC_USE_FAKES=true). Its
 * data is kept in localStorage so a reload behaves like a real server.
 */
export async function startBrowserFakes() {
  try {
    const saved = localStorage.getItem(SNAPSHOT_KEY);
    if (saved) loadFakeDb(saved);
  } catch {
    /* storage blocked: start from the seed */
  }
  const worker = setupWorker(...handlers);
  worker.events.on("response:mocked", () => {
    try {
      localStorage.setItem(SNAPSHOT_KEY, dumpFakeDb());
    } catch {
      /* full or blocked: the demo still works for this page */
    }
  });
  await worker.start({ onUnhandledRequest: "bypass", quiet: true });
  return worker;
}

/** "Reset demo data" in the menu: back to the seeded farm. */
export function resetBrowserFakes() {
  resetFakeDb();
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    /* ignore */
  }
}
