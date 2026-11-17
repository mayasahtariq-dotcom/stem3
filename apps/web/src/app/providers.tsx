"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/session";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } },
  }));
  const lang = useSession((s) => s.lang);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => {   // offline support: register the service worker (PWA)
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
