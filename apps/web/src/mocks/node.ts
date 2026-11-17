import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/** Fake backend for Vitest. */
export const server = setupServer(...handlers);
