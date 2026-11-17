import { QueryClient } from "@tanstack/react-query";
import { asApiError } from "./errors";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Retry network blips and 5xx twice; never retry 4xx answers.
        retry: (count, err) => count < 2 && asApiError(err).retryable,
      },
      mutations: { retry: false },
    },
  });
}
