import { vi } from "vitest";

/** Controllable stand-in for next/navigation in tests. */
export const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() };
export const nav = { pathname: "/", search: new URLSearchParams() };
