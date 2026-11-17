"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BilingualText, ChunkyButton, StickerIcon, TextField, type StickerIconName } from "@/components/ui";
import { toast } from "@/components/ui/Toast";
import { AuthFrame } from "@/features/onboarding/AuthFrame";
import { useBilingual, type BilingualString } from "@/lib/i18n/use-bilingual";
import { useServices } from "@/lib/services";
import { ROUTES } from "./routing";
import { AuthError, ROLES, type Role, type Session } from "./types";
import { cn } from "@/lib/utils/cn";
import { otpSchema, phoneSchema, toE164 } from "./validation";

export const RESEND_SECONDS = 30;

export type PhoneStep = "phone" | "code";

/** All UI state of the phone OTP screen (a plain object: easy to preview and test). */
export interface PhoneLoginState {
  step: PhoneStep;
  phone: string;
  code: string;
  phoneError: string | null;
  codeError: string | null;
  sending: boolean;
  verifying: boolean;
  resendIn: number;
}

const toCode = (e: unknown) => (e instanceof AuthError ? e.code : "unknown");

/** View-model for phone OTP login. */
export function usePhoneLogin(onSignedIn: (s: Session) => Promise<void>) {
  const { auth, reporter } = useServices();
  const t = useBilingual("login");
  const [s, setS] = useState<PhoneLoginState>({ step: "phone", phone: "", code: "", phoneError: null, codeError: null, sending: false, verifying: false, resendIn: 0 });
  const patch = (p: Partial<PhoneLoginState>) => setS((prev) => ({ ...prev, ...p }));

  useEffect(() => {
    if (s.resendIn <= 0) return;
    const id = setTimeout(() => patch({ resendIn: s.resendIn - 1 }), 1000);
    return () => clearTimeout(id);
  }, [s.resendIn]);

  const send = async () => {
    const parsed = phoneSchema.safeParse(s.phone);
    if (!parsed.success) return patch({ phoneError: "invalid_phone" });
    patch({ sending: true, phoneError: null, codeError: null });
    try {
      await auth.requestOtp(toE164(parsed.data));
      patch({ step: "code", sending: false, resendIn: RESEND_SECONDS, code: "" });
      toast("info", t("codeSent"));
    } catch (e) {
      if (toCode(e) === "unknown") reporter.capture(e, { where: "requestOtp" });
      patch({ sending: false, [s.step === "code" ? "codeError" : "phoneError"]: toCode(e) });
    }
  };

  const verify = async () => {
    const phone = phoneSchema.safeParse(s.phone);
    if (!phone.success) return patch({ step: "phone", phoneError: "invalid_phone" });
    if (!otpSchema.safeParse(s.code).success) return patch({ codeError: "invalid_code" });
    patch({ verifying: true, codeError: null });
    try {
      const session = await auth.verifyOtp(toE164(phone.data), s.code);
      await onSignedIn(session);
    } catch (e) {
      if (toCode(e) === "unknown") reporter.capture(e, { where: "verifyOtp" });
      patch({ verifying: false, codeError: e instanceof AuthError ? e.code : "unknown" });
    }
  };

  return {
    state: s,
    setPhone: (phone: string) => patch({ phone: phone.replace(/[^\d\s-]/g, "").slice(0, 12), phoneError: null }),
    setCode: (code: string) => patch({ code: code.replace(/\D/g, "").slice(0, 6), codeError: null }),
    send,
    verify,
    changeNumber: () => patch({ step: "phone", code: "", codeError: null }),
  };
}

export interface PhoneLoginScreenProps {
  state: PhoneLoginState;
  onPhoneChange: (v: string) => void;
  onCodeChange: (v: string) => void;
  onSend: () => void;
  onVerify: () => void;
  onChangeNumber: () => void;
  /** Student, teacher or parent mode, picked right on the sign-in card. */
  role?: Role | null;
  onRoleChange?: (r: Role) => void;
  /** Demo only (fake backend): the sample number for the picked mode. */
  demoPhone?: string | null;
}

const ROLE_ICON: Record<Role, StickerIconName> = { student: "backpack", teacher: "teacher", parent: "people" };

/** Three-way switch for which mode to open after sign-in. */
export function RoleSwitch({ role, onChange }: { role: Role | null; onChange: (r: Role) => void }) {
  const r = useBilingual("role");
  return (
    <div role="radiogroup" aria-label={r("title").english} className="grid grid-cols-3 gap-2" data-testid="login-role-switch">
      {ROLES.map((x) => {
        const label = r(x);
        const on = role === x;
        return (
          <button
            key={x}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={label.english}
            onClick={() => onChange(x)}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-card border-2 px-1 py-2 font-bold",
              on ? "border-grass-strong bg-grass/20 text-ink" : "border-line bg-white text-ink hover:border-grass",
            )}
          >
            <StickerIcon name={ROLE_ICON[x]} size={26} />
            <span className="font-regional text-sm leading-tight">{label.regional}</span>
            <span className="text-xs font-medium text-stone" lang="en">
              {label.english}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Stateless phone OTP screen. */
export function PhoneLoginScreen({ state, onPhoneChange, onCodeChange, onSend, onVerify, onChangeNumber, role, onRoleChange, demoPhone }: PhoneLoginScreenProps) {
  const t = useBilingual("login");
  const codeRef = useRef<HTMLInputElement>(null);
  const err = (code: string | null): BilingualString | null => (code ? t(code) : null);
  useEffect(() => {
    if (state.step === "code") codeRef.current?.focus();
  }, [state.step]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (state.step === "phone") onSend();
    else onVerify();
  };

  return (
    <AuthFrame
      title={state.step === "phone" ? t("phoneTitle") : t("codeTitle")}
      subtitle={state.step === "code" ? t("codeSentTo", { phone: `+91 ${state.phone}` }) : undefined}
      backHref={ROUTES.role}
      golu={{ pose: state.step === "phone" ? "wave" : "thumbs", says: t("welcome") }}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {state.step === "phone" && onRoleChange && <RoleSwitch role={role ?? null} onChange={onRoleChange} />}
        {state.step === "phone" && demoPhone && (
          <div className="flex flex-wrap items-center gap-2 rounded-card border-2 border-dashed border-sun bg-sun-soft px-3 py-2" data-testid="demo-phone">
            <BilingualText size="sm" text={t("demoNumber", { phone: demoPhone })} className="flex-1" />
            <ChunkyButton type="button" size="sm" variant="white" onClick={() => onPhoneChange(demoPhone)}>
              <BilingualText as="span" size="sm" text={t("useDemo")} />
            </ChunkyButton>
          </div>
        )}
        {state.step === "phone" ? (
          <TextField
            label={t("phoneLabel")}
            hint={t("phoneHint")}
            error={err(state.phoneError)}
            prefix="+91"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98765 43210"
            value={state.phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            autoFocus
          />
        ) : (
          <TextField
            ref={codeRef}
            label={t("codeLabel")}
            error={err(state.codeError)}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="text-center tracking-[0.5em]"
            maxLength={6}
            value={state.code}
            onChange={(e) => onCodeChange(e.target.value)}
          />
        )}
        <ChunkyButton type="submit" size="lg" block loading={state.sending || state.verifying}>
          <BilingualText as="span" align="center" tone="inverse" text={state.step === "phone" ? t("sendCode") : t("verify")} />
        </ChunkyButton>
        {state.step === "code" && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ChunkyButton variant="ghost" onClick={onChangeNumber}>
              {t("changeNumber").regional}
            </ChunkyButton>
            <ChunkyButton variant="ghost" onClick={onSend} disabled={state.resendIn > 0 || state.sending}>
              {state.resendIn > 0 ? t("resendIn", { seconds: state.resendIn }).regional : t("resend").regional}
            </ChunkyButton>
          </div>
        )}
      </form>
      <Link href={ROUTES.schoolLogin} className="inline-flex min-h-11 items-center justify-center rounded-button text-center font-bold text-sky-strong underline-offset-4 hover:underline">
        <BilingualText as="span" align="center" size="sm" text={t("schoolComputer")} />
      </Link>
    </AuthFrame>
  );
}
