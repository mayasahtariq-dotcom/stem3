"use client";
import { useSession } from "./session";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Fetch wrapper for the FastAPI backend (same-origin /v1, proxied by Next). */
export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const token = useSession.getState().token;
  const { json, headers, ...rest } = init;
  const res = await fetch(`/v1${path}`, {
    ...rest,
    method: rest.method ?? (json !== undefined ? "POST" : "GET"),
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
               ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 401) useSession.getState().logout();
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, typeof body.detail === "string" ? body.detail : `Error ${res.status}`);
  return body as T;
}
