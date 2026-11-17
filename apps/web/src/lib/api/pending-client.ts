import { apiBaseUrl } from "@/lib/env";
import type { TokenProvider } from "./client";
import { ApiError, toApiError } from "./errors";

/**
 * A small typed client for endpoints the web spec names but the backend has
 * not built yet (game, call students, notifications). It speaks the same
 * conventions as the generated client (bearer token, `{"detail":{"code"}}`
 * errors), so moving an endpoint to the generated client later is a
 * one-line change per hook. Fakes for these live in src/mocks/{game,calls}.
 */
export interface PendingClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
}

export function buildPendingClient(getAccessToken: TokenProvider, baseUrl = apiBaseUrl): PendingClient {
  async function request<T>(method: string, path: string, body?: unknown, extra?: Record<string, string>): Promise<T> {
    const token = await getAccessToken();
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (extra) Object.assign(headers, extra);
    let res: Response;
    try {
      res = await globalThis.fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) {
      throw new ApiError("NETWORK", 0, e instanceof Error ? e.message : String(e));
    }
    const text = await res.text();
    const parsed: unknown = text ? JSON.parse(text) : null;
    if (!res.ok) throw toApiError(res.status, parsed);
    return parsed as T;
  }
  return {
    get: (p) => request("GET", p),
    post: (p, b, h) => request("POST", p, b, h),
    patch: (p, b) => request("PATCH", p, b),
    put: (p, b) => request("PUT", p, b),
  };
}
