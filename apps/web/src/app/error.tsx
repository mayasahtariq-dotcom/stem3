"use client";
import { useEffect } from "react";
import { ErrorState, MeadowScene } from "@/components/ui";
import { useServices } from "@/lib/services";

/** Route-level error boundary: never a blank screen. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { reporter } = useServices();
  useEffect(() => {
    reporter.capture(error, { digest: error.digest });
  }, [error, reporter]);
  return (
    <MeadowScene className="grid place-items-center">
      <ErrorState error={error} onRetry={reset} />
    </MeadowScene>
  );
}
