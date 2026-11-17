"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { useProfile } from "@/features/auth/hooks";
import { queryKeys } from "@/lib/api/query-keys";
import { useOnline } from "@/lib/offline/online";
import { flushOutbox, pendingFor, useOutbox } from "@/lib/offline/outbox";
import { useServices } from "@/lib/services";

export const RETRY_MS = 30_000;

export type SyncStatus = "idle" | "syncing";

export interface OfflineSyncModel {
  online: boolean;
  pending: number;
  dropped: number;
  status: SyncStatus;
  syncNow: () => void;
  dismissDropped: () => void;
}

/**
 * Sends the outbox when the app starts, when the browser comes back online and
 * when the tab becomes visible again; then refreshes stats, the farm and the
 * game so synced rewards show up. Mounted once, in the app providers.
 */
export function useOfflineSync(): OfflineSyncModel {
  const { api } = useServices();
  const qc = useQueryClient();
  const online = useOnline();
  const userId = useProfile().data?.id ?? null;
  const items = useOutbox((s) => s.items);
  const dropped = useOutbox((s) => s.dropped);
  const pending = pendingFor(items, userId).length;
  // Items wait only until the next successful run, so pending while online means syncing.
  const status: SyncStatus = online && pending > 0 ? "syncing" : "idle";

  const syncNow = useCallback(() => {
    if (!userId || !navigator.onLine || pendingFor(useOutbox.getState().items, userId).length === 0)
      return;
    void flushOutbox(api, userId)
      .then((r) => {
        if (r.lastStats) qc.setQueryData(queryKeys.stats, r.lastStats);
        if (r.sent || r.dropped) {
          void qc.invalidateQueries({ queryKey: queryKeys.home });
          void qc.invalidateQueries({ queryKey: ["courses"] });
          void qc.invalidateQueries({ queryKey: ["game"] });
        }
      });
  }, [api, qc, userId]);

  // On start, on reconnect and whenever new items arrive while online.
  useEffect(() => {
    if (online && pending > 0) syncNow();
  }, [online, pending, syncNow]);

  // A failed run (server blip while "online") is retried every 30 seconds.
  useEffect(() => {
    if (!online || pending === 0) return;
    const t = window.setInterval(syncNow, RETRY_MS);
    return () => window.clearInterval(t);
  }, [online, pending, syncNow]);

  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && syncNow();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [syncNow]);

  return {
    online,
    pending,
    dropped,
    status,
    syncNow,
    dismissDropped: () => useOutbox.getState().clearDropped(),
  };
}
