"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BilingualText, ChunkyButton, TextField } from "@/components/ui";
import { AuthFrame } from "@/features/onboarding/AuthFrame";
import { asApiError } from "@/lib/api/errors";
import { readLanguageCookie } from "@/lib/i18n/language";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useAppStore } from "@/lib/store/app-store";
import { useSaveProfile } from "./hooks";
import { HOME_BY_ROLE, ROUTES } from "./routing";
import { nameSchema } from "./validation";

export interface WelcomeState {
  name: string;
  nameError: string | null;
  saving: boolean;
  saveError: unknown;
}

/** View-model: creates the profile (PUT /me) from the onboarding choices plus the name. */
export function useWelcome() {
  const router = useRouter();
  const save = useSaveProfile();
  const draftRole = useAppStore((s) => s.draftRole);
  const draftLanguage = useAppStore((s) => s.draftLanguage);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  const submit = async () => {
    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) return setNameError(parsed.error.issues[0]?.message ?? "name_required");
    if (!draftRole) return router.replace(ROUTES.role);
    const languageMode = draftLanguage ?? readLanguageCookie() ?? "hindi";
    try {
      await save.mutateAsync({ name: parsed.data, languageMode, roles: [draftRole] });
      // New students join a class first (they can skip); others go home.
      router.replace(draftRole === "student" ? ROUTES.join : HOME_BY_ROLE[draftRole]);
    } catch {
      /* shown via save.error */
    }
  };

  const state: WelcomeState = { name, nameError, saving: save.isPending, saveError: save.error };
  return { state, setName: (v: string) => (setName(v.slice(0, 60)), setNameError(null)), submit };
}

export function WelcomeScreen({ state, onNameChange, onSubmit }: { state: WelcomeState; onNameChange: (v: string) => void; onSubmit: () => void }) {
  const t = useBilingual("welcome");
  const e = useBilingual("errors");
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    onSubmit();
  };
  return (
    <AuthFrame title={t("title")} golu={{ pose: "heart", says: t("title") }}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField label={t("nameLabel")} error={state.nameError ? t(state.nameError) : null} autoComplete="given-name" value={state.name} onChange={(ev) => onNameChange(ev.target.value)} autoFocus />
        {state.saveError ? (
          <p role="alert" className="font-semibold text-coral-strong">
            {e(asApiError(state.saveError).code).regional} · <span lang="en">{e(asApiError(state.saveError).code).english}</span>
          </p>
        ) : null}
        <ChunkyButton type="submit" size="lg" block loading={state.saving}>
          <BilingualText as="span" align="center" tone="inverse" text={t("save")} />
        </ChunkyButton>
      </form>
    </AuthFrame>
  );
}
