import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { resetFakeDb } from "@/mocks/fake-db";
import { server } from "@/mocks/node";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetFakeDb();
  localStorage.clear();
  sessionStorage.clear();
  // Tests start as if the language was already picked on this visit; the language-first tests clear it.
  sessionStorage.setItem("aaroh.languagePicked", "1");
  document.cookie = "mooshala_lang=; max-age=0; path=/";
});
afterAll(() => server.close());

// next/navigation is a Next runtime module; tests use a controllable router mock.
vi.mock("next/navigation", async () => {
  const { router, nav } = await import("./navigation");
  return { useRouter: () => router, usePathname: () => nav.pathname, useSearchParams: () => nav.search };
});
afterEach(async () => {
  const { router, nav } = await import("./navigation");
  Object.values(router).forEach((f) => f.mockReset());
  nav.pathname = "/";
  nav.search = new URLSearchParams();
});

// jsdom lacks matchMedia.
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    value: (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  });
}
