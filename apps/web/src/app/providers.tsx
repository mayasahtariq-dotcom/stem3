"use client";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/Toast";
import { useRestoreSession } from "@/features/auth/hooks";
import { OfflineBanner } from "@/features/offline/OfflineBanner";
import { makeQueryClient } from "@/lib/api/query-client";
import { createServices } from "@/lib/create-services";
import { env } from "@/lib/env";
import { ServicesProvider, type Services } from "@/lib/services";
import { sounds } from "@/lib/sound/sound-manager";
import { useAppStore } from "@/lib/store/app-store";

function SessionBootstrap() {
  useRestoreSession();
  return null;
}

/** Unlocks sound on the first user gesture and keeps the mute switch in sync. */
function SoundBootstrap() {
  const muted = useAppStore((s) => s.soundMuted);
  useEffect(() => {
    sounds.setMuted(muted);
  }, [muted]);
  useEffect(() => {
    const unlock = () => sounds.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
  return null;
}

export function AppProviders({ children, services: injected }: { children: ReactNode; services?: Services }) {
  const [queryClient] = useState(makeQueryClient);
  const [services] = useState(() => injected ?? createServices());
  // With fakes on, the MSW worker must be running before the first API call.
  const [fakesReady, setFakesReady] = useState(!env.useFakes || Boolean(injected));

  useEffect(() => {
    if (fakesReady) return;
    let alive = true;
    import("@/mocks/browser")
      .then((m) => m.startBrowserFakes())
      .catch((err) => services.reporter.capture(err, { where: "startBrowserFakes" }))
      .finally(() => alive && setFakesReady(true));
    return () => {
      alive = false;
    };
  }, [fakesReady, services]);

  return (
    <QueryClientProvider client={queryClient}>
      <ServicesProvider services={services}>
        <SoundBootstrap />
        {fakesReady && (
          <>
            <SessionBootstrap />
            <OfflineBanner />
            {children}
          </>
        )}
        <Toaster />
      </ServicesProvider>
    </QueryClientProvider>
  );
}
