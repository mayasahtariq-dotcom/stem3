"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ChunkyTitle, Sparkles } from "@/components/playful";
import { BilingualText, ChunkyButton, TextField } from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useServices } from "@/lib/services";
import { PhoneDevice, usePhoneSimulator } from "./PhoneSimulator";

/**
 * "Call Aaroh": how a student without a smartphone learns. They dial Aaroh from their own phone number (the one
 * their teacher added); Aaroh recognises the number and runs their lesson and quiz by voice and key presses.
 * This page simulates that call in the browser (demo mode), so no phone line is needed.
 */
export function CallAarohScreen() {
  const t = useBilingual("phone");
  const { pending } = useServices();
  const [number, setNumber] = useState("");
  const [from, setFrom] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const sim = usePhoneSimulator(from ? (body) => pending.post(`/phone/call`, { ...body, from_phone: from }) : null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const digits = number.replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(digits)) return setError(true);
    setError(false);
    setFrom(digits);
  };
  return (
    <div className="playful sunburst relative isolate min-h-dvh overflow-hidden">
      <Sparkles />
      <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col items-center gap-4 px-4 pb-10 pt-6">
        <div className="flex w-full items-center">
          <Link href="/" className="inline-flex min-h-11 items-center rounded-full bg-white/70 px-3 font-bold text-ink hover:bg-white">
            ← {t("back").regional}
          </Link>
        </div>
        <ChunkyTitle text={t("title")} as="h1" className="self-start" />
        <BilingualText size="sm" text={t("hint")} className="self-start rounded-2xl bg-white/70 p-3" />
        {!from ? (
          <form onSubmit={submit} noValidate className="glass flex w-full flex-col gap-3 rounded-[28px] p-5" data-testid="dial-form">
            <TextField
              label={t("yourNumber")}
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="98765 43210"
              value={number}
              onChange={(e) => setNumber(e.target.value.replace(/[^\d\s-]/g, "").slice(0, 14))}
              error={error ? t("badNumber") : null}
            />
            <BilingualText size="sm" text={t("numberHint")} className="text-stone" />
            <ChunkyButton type="submit" size="lg" block data-testid="dial-continue">
              <BilingualText as="span" align="center" tone="inverse" text={t("next")} />
            </ChunkyButton>
          </form>
        ) : (
          <>
            <PhoneDevice sim={sim} callerLabel={`${t("callingFrom").regional} +91 ${from}`} />
            <button type="button" onClick={() => (sim.hangUp(), setFrom(null))} className="text-sm font-bold text-white underline">
              {t("changeNumber").regional} · {t("changeNumber").english}
            </button>
          </>
        )}
      </main>
    </div>
  );
}
