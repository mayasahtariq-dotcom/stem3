"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ApiClient, Schemas } from "@mooshala/api-client";
import { unwrap } from "@/lib/api/client";
import { asApiError } from "@/lib/api/errors";

/**
 * The offline outbox: lesson answers and lesson completions made without a
 * connection are kept on the device and sent, in order, when the phone is back
 * online. Every item carries an idempotency key (sent as `Idempotency-Key`),
 * so a replay after a dropped response never pays XP, hearts or a pot twice.
 *
 * Items belong to one user: on a shared school computer, the next student who
 * signs in never sends somebody else's answers.
 */
export type OutboxItem =
  | {
      id: string;
      userId: string;
      kind: "attempt";
      lessonId: string;
      body: Schemas["AttemptIn"];
      createdAt: number;
    }
  | { id: string; userId: string; kind: "complete"; lessonId: string; createdAt: number };

export type NewOutboxItem = OutboxItem extends infer T
  ? T extends OutboxItem
    ? Omit<T, "id" | "createdAt">
    : never
  : never;

interface OutboxState {
  items: OutboxItem[];
  /** Items the server refused for good (e.g. hearts ran out before they synced). */
  dropped: number;
  lastSyncedAt: number | null;
  enqueue: (item: NewOutboxItem, now?: number) => OutboxItem;
  remove: (id: string) => void;
  noteDropped: () => void;
  noteSynced: (at: number) => void;
  clearDropped: () => void;
}

export function newId(): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useOutbox = create<OutboxState>()(
  persist(
    (set) => ({
      items: [],
      dropped: 0,
      lastSyncedAt: null,
      enqueue: (item, now = Date.now()) => {
        const full = { ...item, id: newId(), createdAt: now } as OutboxItem;
        set((s) => ({ items: [...s.items, full] }));
        return full;
      },
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      noteDropped: () => set((s) => ({ dropped: s.dropped + 1 })),
      noteSynced: (at) => set({ lastSyncedAt: at }),
      clearDropped: () => set({ dropped: 0 }),
    }),
    { name: "mooshala.outbox", storage: createJSONStorage(() => localStorage), version: 1 },
  ),
);

export const pendingFor = (items: OutboxItem[], userId: string | null | undefined) =>
  userId ? items.filter((i) => i.userId === userId) : [];

export interface FlushResult {
  sent: number;
  dropped: number;
  /** True when a network error or 5xx stopped the run; the rest waits for next time. */
  stopped: boolean;
  lastStats: Schemas["StatsOut"] | null;
}

const header = (key: string) => ({ "Idempotency-Key": key });

async function sendItem(api: ApiClient, item: OutboxItem): Promise<Schemas["StatsOut"]> {
  if (item.kind === "attempt") {
    return unwrap(await api.POST("/attempts", { body: item.body, headers: header(item.id) })).stats;
  }
  return unwrap(
    await api.POST("/lessons/{lesson_id}/complete", {
      params: { path: { lesson_id: item.lessonId } },
      headers: header(item.id),
    }),
  ).stats;
}

let running: Promise<FlushResult> | null = null;

/**
 * Sends this user's queued items one at a time, oldest first. A network error
 * or 5xx stops the run (order matters: a completion must follow its answers);
 * a 4xx means the server will never accept the item, so it is dropped and
 * counted. Only one flush runs at a time.
 */
export function flushOutbox(api: ApiClient, userId: string): Promise<FlushResult> {
  if (running) return running;
  running = (async () => {
    const result: FlushResult = { sent: 0, dropped: 0, stopped: false, lastStats: null };
    for (const item of pendingFor(useOutbox.getState().items, userId)) {
      try {
        result.lastStats = await sendItem(api, item);
        result.sent++;
        useOutbox.getState().remove(item.id);
      } catch (e) {
        const err = asApiError(e);
        if (err.retryable || err.code === "UNAUTHORIZED" || err.status === 0) {
          result.stopped = true;
          break;
        }
        useOutbox.getState().remove(item.id);
        useOutbox.getState().noteDropped();
        result.dropped++;
      }
    }
    if (!result.stopped) useOutbox.getState().noteSynced(Date.now());
    return result;
  })().finally(() => {
    running = null;
  });
  return running;
}
