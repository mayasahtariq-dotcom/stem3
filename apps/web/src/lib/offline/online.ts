"use client";
import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Whether the browser thinks it is online. Server renders assume online. */
export const isOnline = () =>
  typeof navigator === "undefined" ? true : navigator.onLine !== false;

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, isOnline, () => true);
}
