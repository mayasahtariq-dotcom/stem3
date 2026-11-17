"use client";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { homeFor } from "@/components/AuthGate";
import { GoluMascot, MeadowScene } from "@/components/game";
import { BilingualText, Card, ChunkyButton, SpeechBubble } from "@/components/ui";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { type Lang, type Role, type User, useSession } from "@/lib/session";

type Step = "lang" | "role" | "phone" | "code" | "classkey";
interface SessionOut { access_token: string; user: User }

export default function Login() {
  const router = useRouter();
  const { t, bi } = useT();
  const { setLang, setSession, lang } = useSession();
  const [step, setStep] = useState<Step>("lang");
  const [role, setRole] = useState<Role>("student");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [classKey, setClassKey] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true); setErr(null);
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  }
  const finish = (s: SessionOut) => { setSession(s.access_token, s.user); router.replace(homeFor(s.user.role)); };

  const label = (k: string) => { const b = bi(k); return <BilingualText regional={b.regional} english={b.english} />; };
  const input = "w-full rounded-[12px] border-2 border-line bg-cloud px-4 py-3 text-lg outline-none focus:border-sky";

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 overflow-hidden px-4 pb-48 pt-8">
      <div className="flex items-end gap-3">
        <GoluMascot size={110} mood={step === "code" ? "think" : "happy"} />
        <SpeechBubble className="mb-6 flex-1">
          <BilingualText size="lg" regional="आरोह · ಆರೋಹ · Aaroh" english={t("app.tagline")} />
        </SpeechBubble>
      </div>

      {step === "lang" && <Card className="space-y-3">
        <BilingualText size="lg" regional="अपनी भाषा चुनो · ನಿನ್ನ ಭಾಷೆ ಆರಿಸು" english="Choose your language" />
        {([["hi", "हिंदी", "Hindi"], ["kn", "ಕನ್ನಡ", "Kannada"]] as [Lang, string, string][]).map(([code, native, eng]) =>
          <ChunkyButton key={code} variant={lang === code ? "primary" : "white"} className="w-full normal-case"
            onClick={() => { setLang(code); setStep("role"); }}>
            <BilingualText regional={native} english={eng} /></ChunkyButton>)}
      </Card>}

      {step === "role" && <Card className="space-y-3">
        {label("onb.chooseRole")}
        {(["student", "teacher", "parent"] as Role[]).map((r) =>
          <ChunkyButton key={r} variant="white" className="w-full normal-case" onClick={() => { setRole(r); setStep("phone"); }}>
            {label(`role.${r}`)}</ChunkyButton>)}
        <button className="w-full text-sm font-bold text-sky" onClick={() => setStep("lang")}>{t("auth.back")}</button>
      </Card>}

      {step === "phone" && <Card className="space-y-3">
        <label className="block space-y-2">{label("auth.phone")}
          <input className={input} inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone}
                 onChange={(e) => setPhone(e.target.value)} /></label>
        <ChunkyButton className="w-full" disabled={busy || phone.replace(/\D/g, "").length < 10}
          onClick={() => run(async () => {
            const r = await api<{ sent: boolean; dev_code: string | null }>("/auth/otp", { json: { phone } });
            setDevCode(r.dev_code); setStep("code");
          })}>{t("auth.sendCode")}</ChunkyButton>
        {role === "student" && <button className="w-full text-sm font-bold text-sky" onClick={() => setStep("classkey")}>{t("auth.classKey")}</button>}
        <button className="w-full text-sm font-bold text-muted" onClick={() => setStep("role")}>{t("auth.back")}</button>
      </Card>}

      {step === "code" && <Card className="space-y-3">
        <p className="text-sm text-muted">{t("auth.codeSent")}</p>
        {devCode && <p className="rounded-[12px] bg-sun/20 px-3 py-2 text-sm font-bold">{t("auth.devCode", { code: devCode })}</p>}
        <label className="block space-y-2">{label("auth.code")}
          <input className={clsx(input, "tracking-[0.5em]")} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                 value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></label>
        <label className="block space-y-2">{label("auth.name")}
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" /></label>
        <ChunkyButton className="w-full" disabled={busy || code.length !== 6}
          onClick={() => run(async () => finish(await api<SessionOut>("/auth/verify", {
            json: { phone, code, role, name: name || undefined, language: lang } })))}>{t("auth.verify")}</ChunkyButton>
        <button className="w-full text-sm font-bold text-muted" onClick={() => setStep("phone")}>{t("auth.back")}</button>
      </Card>}

      {step === "classkey" && <Card className="space-y-3">
        <label className="block space-y-2">{label("auth.classKeyLabel")}
          <input className={clsx(input, "uppercase tracking-widest")} value={classKey} maxLength={16}
                 onChange={(e) => setClassKey(e.target.value)} /></label>
        <label className="block space-y-2">{label("auth.name")}
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <ChunkyButton className="w-full" disabled={busy || classKey.length < 4 || !name.trim()}
          onClick={() => run(async () => finish(await api<SessionOut>("/auth/class-key", { json: { class_key: classKey, name } })))}>
          {t("auth.verify")}</ChunkyButton>
        <button className="w-full text-sm font-bold text-sky" onClick={() => setStep("phone")}>{t("auth.phoneLogin")}</button>
      </Card>}

      {err && <p role="alert" className="rounded-[12px] bg-coral/10 px-4 py-3 font-bold text-coral">{err}</p>}
      <MeadowScene />
    </main>
  );
}
