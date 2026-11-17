/** Tiny storage seam so session code is testable and SSR-safe. */
export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function browserStorage(kind: "local" | "session"): KeyValueStorage {
  const s = () => {
    if (typeof window === "undefined") return null;
    try {
      return kind === "local" ? window.localStorage : window.sessionStorage;
    } catch {
      return null; // blocked storage (private mode, policies)
    }
  };
  return {
    get: (k) => s()?.getItem(k) ?? null,
    set: (k, v) => {
      try {
        s()?.setItem(k, v);
      } catch {
        /* quota or blocked */
      }
    },
    remove: (k) => s()?.removeItem(k),
  };
}

export function memoryStorage(): KeyValueStorage {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v), remove: (k) => void m.delete(k) };
}
