"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEMO_CODE, DEMO_PHONES } from "@/features/auth/demo";
import { usePostSignIn } from "@/features/auth/use-post-sign-in";
import { toE164 } from "@/features/auth/validation";
import { env } from "@/lib/env";
import { useServices } from "@/lib/services";
import { StickerIcon, type StickerIconName } from "@/components/ui";
import { ROUTES } from "@/features/auth/routing";
import { ROLES, type Role } from "@/features/auth/types";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useAppStore } from "@/lib/store/app-store";
import { AuthFrame, ChoiceCard } from "./AuthFrame";

export function useRoleScreen() {
  const router = useRouter();
  const { auth, reporter } = useServices();
  const postSignIn = usePostSignIn();
  const selected = useAppStore((s) => s.draftRole);
  const setDraft = useAppStore((s) => s.setDraftRole);
  const [opening, setOpening] = useState<Role | null>(null);
  return {
    selected,
    opening,
    async choose(role: Role) {
      setDraft(role);
      if (!env.useFakes) return router.push(ROUTES.login);
      // Demo: open the chosen mode straight away with its sample account.
      setOpening(role);
      try {
        const phone = toE164(DEMO_PHONES[role]);
        await auth.requestOtp(phone);
        await postSignIn(await auth.verifyOtp(phone, DEMO_CODE));
      } catch (e) {
        reporter.capture(e, { where: "demoSignIn" });
        router.push(ROUTES.login);
      } finally {
        setOpening(null);
      }
    },
  };
}

const ICON: Record<Role, StickerIconName> = { student: "backpack", teacher: "teacher", parent: "people" };
const TILE: Record<Role, string> = { student: "bg-grass/20 border-grass-strong", teacher: "bg-sky-soft border-sky-strong", parent: "bg-coral/15 border-coral-strong" };

function RoleArt({ role }: { role: Role }) {
  return (
    <span className={`grid size-16 shrink-0 place-items-center rounded-card border-2 ${TILE[role]}`}>
      <StickerIcon name={ICON[role]} size={44} />
    </span>
  );
}

export function RoleScreen({ selected, onChoose, opening = null }: { selected: Role | null; onChoose: (r: Role) => void; opening?: Role | null }) {
  const t = useBilingual("role");
  return (
    <AuthFrame title={t("title")} backHref={ROUTES.language} golu={{ pose: "question", says: t("title") }}>
      <div className="flex flex-col gap-3">
        {ROLES.map((r) => (
          <ChoiceCard key={r} text={t(r)} hint={t(`${r}Hint`)} icon={<RoleArt role={r} />} onClick={() => !opening && onChoose(r)} selected={selected === r || opening === r} />
        ))}
      </div>
    </AuthFrame>
  );
}
