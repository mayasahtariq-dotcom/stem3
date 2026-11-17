"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BilingualText, ChunkyButton, Dialog, StickerIcon } from "@/components/ui";
import { useAuth } from "@/features/auth/hooks";
import { ROUTES } from "@/features/auth/routing";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useAppStore } from "@/lib/store/app-store";
import { env } from "@/lib/env";

/** One-tap sound mute plus a menu with sign out. Shared by all shells. */
export function HudControls({ tone = "game" }: { tone?: "game" | "plain" }) {
  const c = useBilingual("common");
  const n = useBilingual("nav");
  const muted = useAppStore((s) => s.soundMuted);
  const toggle = useAppStore((s) => s.toggleSound);
  const { signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const btn = tone === "game" ? "white" : "ghost";
  return (
    <div className="flex items-center gap-2">
      <ChunkyButton
        variant={btn}
        size="icon"
        onClick={toggle}
        aria-pressed={!muted}
        aria-label={muted ? c("soundOff").english : c("soundOn").english}
      >
        <StickerIcon
          name="speaker"
          size={24}
          className={muted ? "opacity-40 grayscale" : undefined}
        />
      </ChunkyButton>
      <ChunkyButton
        variant={btn}
        size="icon"
        onClick={() => setOpen(true)}
        aria-label={n("menu").english}
      >
        <StickerIcon name="calendar" size={24} />
      </ChunkyButton>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={n("menu")}
        actions={
          <>
            {env.useFakes && (
              <ChunkyButton
                variant="ghost"
                block
                onClick={async () => {
                  const { resetBrowserFakes } = await import("@/mocks/browser");
                  resetBrowserFakes();
                  window.location.reload();
                }}
              >
                <BilingualText as="span" align="center" text={c("resetDemo")} size="sm" />
              </ChunkyButton>
            )}
            <ChunkyButton
              variant="white"
              block
              onClick={async () => {
                setOpen(false);
                await signOut();
                router.replace(ROUTES.role);
              }}
            >
              <BilingualText as="span" align="center" text={c("signOut")} size="sm" />
            </ChunkyButton>
          </>
        }
      />
    </div>
  );
}
