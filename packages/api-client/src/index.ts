import createClient, { type Client, type Middleware } from "openapi-fetch";
import type { components, paths } from "./generated/backend";

export type { components, paths };
export type Schemas = components["schemas"];
export * from "./pending-auth";

export type ApiClient = Client<paths>;

export interface CreateApiClientOptions {
  baseUrl: string;
  /** Returns the current bearer token, or null when signed out. */
  getAccessToken?: () => string | null | Promise<string | null>;
  fetch?: typeof globalThis.fetch;
  middleware?: Middleware[];
}

/** Typed client for the FastAPI backend, generated from its OpenAPI document. */
export function createApiClient(opts: CreateApiClientOptions): ApiClient {
  const client = createClient<paths>({ baseUrl: opts.baseUrl, fetch: opts.fetch });
  if (opts.getAccessToken) {
    const getToken = opts.getAccessToken;
    client.use({
      async onRequest({ request }) {
        const token = await getToken();
        if (token) request.headers.set("Authorization", `Bearer ${token}`);
        return request;
      },
    });
  }
  for (const m of opts.middleware ?? []) client.use(m);
  return client;
}
export * from "./pending-game";
export * from "./pending-calls";
export * from "./pending-teacher";
export * from "./pending-notes";
export * from "./pending-world";
