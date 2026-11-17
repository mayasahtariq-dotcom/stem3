"use client";
import * as RT from "@radix-ui/react-toast";
import { create } from "zustand";
import type { BilingualString } from "@/lib/i18n/use-bilingual";
import { cn } from "@/lib/utils/cn";
import { StickerIcon, type StickerIconName } from "./StickerIcon";

export type ToastTone = "success" | "info" | "error";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: BilingualString;
}

interface ToastState {
  items: ToastItem[];
  push: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
export const useToastStore = create<ToastState>()((set) => ({
  items: [],
  push: (t) => set((s) => ({ items: [...s.items.slice(-2), { ...t, id: nextId++ }] })),
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

/** Shows a notification toast from anywhere: `toast("success", msg)`. */
export const toast = (tone: ToastTone, message: BilingualString) => useToastStore.getState().push({ tone, message });

const TONE: Record<ToastTone, { icon: StickerIconName; cls: string }> = {
  success: { icon: "star", cls: "border-grass-strong" },
  info: { icon: "sparkle", cls: "border-sky-strong" },
  error: { icon: "warn", cls: "border-coral-strong" },
};

/** Toast viewport; mounted once in <AppProviders>. */
export function Toaster() {
  const { items, dismiss } = useToastStore();
  return (
    <RT.Provider swipeDirection="up" duration={4000}>
      {items.map((t) => (
        <RT.Root
          key={t.id}
          type={t.tone === "error" ? "foreground" : "background"}
          onOpenChange={(open) => !open && dismiss(t.id)}
          className={cn(
            "flex items-center gap-3 rounded-card border-2 border-b-4 bg-white px-4 py-3 shadow-float-2 motion-safe:animate-[pop-in_var(--duration-base)_var(--ease-spring)]",
            TONE[t.tone].cls,
          )}
        >
          <StickerIcon name={TONE[t.tone].icon} size={28} />
          <RT.Description className="flex flex-col">
            <span className="font-regional font-bold">{t.message.regional}</span>
            <span lang="en" className="text-sm text-stone">
              {t.message.english}
            </span>
          </RT.Description>
        </RT.Root>
      ))}
      <RT.Viewport className="fixed left-1/2 top-4 z-[60] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2 outline-none" />
    </RT.Provider>
  );
}
