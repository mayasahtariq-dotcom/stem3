"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { BilingualText, ChunkyButton, TextField } from "@/components/ui";
import { AuthFrame } from "@/features/onboarding/AuthFrame";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useServices } from "@/lib/services";
import { ROUTES } from "./routing";
import { AuthError, type Session } from "./types";
import { formatJoinKey, joinKeySchema, nameSchema } from "./validation";

export interface SchoolLoginState {
  classKey: string;
  name: string;
  keyError: string | null;
  nameError: string | null;
  formError: string | null;
  submitting: boolean;
}

/** View-model for class key + name login on shared school computers. */
export function useSchoolLogin(onSignedIn: (s: Session) => Promise<void>) {
  const { auth, reporter } = useServices();
  const [s, setS] = useState<SchoolLoginState>({ classKey: "", name: "", keyError: null, nameError: null, formError: null, submitting: false });
  const patch = (p: Partial<SchoolLoginState>) => setS((prev) => ({ ...prev, ...p }));

  const submit = async () => {
    const key = joinKeySchema.safeParse(s.classKey);
    const name = nameSchema.safeParse(s.name);
    patch({ keyError: key.success ? null : "invalid_key", nameError: name.success ? null : (name.error.issues[0]?.message ?? "name_required"), formError: null });
    if (!key.success || !name.success) return;
    patch({ submitting: true });
    try {
      await onSignedIn(await auth.loginWithClassKey(key.data, name.data));
    } catch (e) {
      const code = e instanceof AuthError ? e.code : "unknown";
      if (code === "unknown") reporter.capture(e, { where: "classKeyLogin" });
      patch({ submitting: false, formError: code });
    }
  };

  return {
    state: s,
    setKey: (v: string) => patch({ classKey: formatJoinKey(v), keyError: null, formError: null }),
    setName: (v: string) => patch({ name: v.slice(0, 60), nameError: null, formError: null }),
    submit,
  };
}

export interface SchoolLoginScreenProps {
  state: SchoolLoginState;
  onKeyChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onSubmit: () => void;
}

export function SchoolLoginScreen({ state, onKeyChange, onNameChange, onSubmit }: SchoolLoginScreenProps) {
  const t = useBilingual("school");
  const l = useBilingual("login");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <AuthFrame title={t("title")} subtitle={t("subtitle")} backHref={ROUTES.login} golu={{ pose: "thumbs", says: l("welcome") }}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField
          label={t("keyLabel")}
          hint={t("keyHint")}
          error={state.keyError ? t(state.keyError) : null}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="BI09-K4X2"
          className="uppercase tracking-widest"
          value={state.classKey}
          onChange={(e) => onKeyChange(e.target.value)}
          autoFocus
        />
        <TextField
          label={t("nameLabel")}
          error={state.nameError ? t(state.nameError) : null}
          autoComplete="off"
          value={state.name}
          onChange={(e) => onNameChange(e.target.value)}
        />
        {state.formError && (
          <p role="alert" className="flex flex-col rounded-card border-2 border-coral-strong bg-white px-4 py-3 font-semibold text-coral-strong">
            <span>{l(state.formError).regional}</span>
            <span lang="en" className="text-sm font-medium">
              {l(state.formError).english}
            </span>
          </p>
        )}
        <ChunkyButton type="submit" size="lg" block loading={state.submitting}>
          <BilingualText as="span" align="center" tone="inverse" text={t("signIn")} />
        </ChunkyButton>
      </form>
      <Link href={ROUTES.login} className="inline-flex min-h-11 items-center justify-center font-bold text-sky-strong underline-offset-4 hover:underline">
        <BilingualText as="span" align="center" size="sm" text={l("usePhone")} />
      </Link>
    </AuthFrame>
  );
}
