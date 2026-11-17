import { createApiClient, type ApiClient } from "@mooshala/api-client";
import { apiBaseUrl } from "@/lib/env";
import { ApiError, toApiError } from "./errors";

export type TokenProvider = () => string | null | Promise<string | null>;

/**
 * Builds the typed backend client: attaches the bearer token and turns every
 * non-2xx response into a thrown ApiError, so callers (TanStack Query hooks)
 * only see data or an ApiError.
 */
export function buildApiClient(getAccessToken: TokenProvider, baseUrl = apiBaseUrl): ApiClient {
  return createApiClient({
    baseUrl,
    getAccessToken,
    // Resolve fetch at call time so test and MSW interceptors are honoured.
    fetch: (input) => globalThis.fetch(input),
    middleware: [
      {
        async onResponse({ response }) {
          if (response.ok) return response;
          let body: unknown = null;
          try {
            body = await response.clone().json();
          } catch {
            /* not JSON */
          }
          throw toApiError(response.status, body);
        },
        onError({ error }) {
          if (error instanceof ApiError) return error;
          return new ApiError("NETWORK", 0, error instanceof Error ? error.message : String(error));
        },
      },
    ],
  });
}

/** Unwraps an openapi-fetch result whose errors were already thrown by the middleware. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined) throw toApiError(result.response.status, result.error);
  return result.data as T;
}
