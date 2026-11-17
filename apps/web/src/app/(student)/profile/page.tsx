"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GemCounter, GoluMascot, HeartMeter, StreakFlame } from "@/components/game";
import { BilingualText, Card, ChunkyButton, QueryState, StickerIcon } from "@/components/ui";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useBadges, useMascot, useStats } from "@/lib/queries";
import { type Lang, useSession } from "@/lib/session";
import type { Term } from "@/lib/types";

const OUTFITS = ["bow", "cap", "scarf", "glasses", "medal", "cape"];

export default function Profile() {
  const { t, lang } = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, setLang, sound, toggleSound, logout } = useSession();
  const stats = useStats(), badges = useBadges(), mascot = useMascot();
  const saved = useQuery({ queryKey: ["saved-terms"], queryFn: () => api<Term[]>("/me/saved-terms") });
  const [msg, setMsg] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [nick, setNick] = useState("");
  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => { setMsg(null); qc.invalidateQueries(); },
    onError: (e) => setMsg((e as Error).message),
  });
  const owned = mascot.data?.outfit.owned ?? [];
  const earned = (badges.data ?? []).filter((b) => b.earned);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Card className="flex items-center gap-4">
        <GoluMascot size={120} stage={mascot.data?.stage} outfit={owned} />
        <div className="flex-1">
          <BilingualText size="lg" regional={user?.name ?? ""} english={t("profile.golu") + " · " + (mascot.data?.stage ?? "")} />
          {mascot.data?.next_unlock_at_xp && <p className="text-sm text-muted">{t("profile.nextUnlock", { xp: mascot.data.next_unlock_at_xp })}</p>}
          {stats.data && <div className="mt-2 flex flex-wrap gap-4"><StreakFlame days={stats.data.streak} /><GemCounter gems={stats.data.gems} />
            <HeartMeter hearts={stats.data.hearts} /><span className="font-bold text-flame">{stats.data.xp} XP</span></div>}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-black">{t("profile.trophies")} ({earned.length})</h2>
        <QueryState loading={badges.isLoading} error={badges.error}>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">{(badges.data ?? []).slice(0, 24).map((b) => (
            <li key={b.code} className={clsx("flex flex-col items-center rounded-[12px] border-2 p-2 text-center text-xs font-bold",
              b.earned ? "border-sun bg-sun/10" : "border-line opacity-40 grayscale")} title={b.title.en}>
              <StickerIcon name="trophy" size={34} />{b.title[lang as "en"] ?? b.title.en}</li>))}</ul>
        </QueryState>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-black">{t("profile.shop")}</h2>
        <div className="flex flex-wrap gap-2">
          <ChunkyButton variant="sky" className="text-xs" onClick={() => act.mutate(() => api("/game/freeze", { method: "POST" }))}>{t("profile.freeze")}</ChunkyButton>
          <ChunkyButton variant="coral" className="text-xs" onClick={() => act.mutate(() => api("/game/hearts/refill", { method: "POST" }))}>{t("profile.refill")}</ChunkyButton>
        </div>
        <div className="flex flex-wrap gap-2">{OUTFITS.map((o) => (
          <ChunkyButton key={o} variant={owned.includes(o) ? "primary" : "white"} className="text-xs normal-case" disabled={owned.includes(o)}
            onClick={() => act.mutate(() => api("/game/outfits/buy", { json: { item: o } }))}>{owned.includes(o) ? o : t("profile.outfit", { item: o })}</ChunkyButton>))}</div>
        {msg && <p role="alert" className="font-bold text-coral">{msg}</p>}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-black">{t("profile.settings")}</h2>
        <div><div className="mb-1 text-sm font-bold">{t("profile.language")}</div>
          <div className="flex gap-2">{([["hi", "हिंदी"], ["kn", "ಕನ್ನಡ"], ["en", "English"]] as [Lang, string][]).map(([c, l]) =>
            <ChunkyButton key={c} variant={lang === c ? "primary" : "white"} className="text-xs normal-case" onClick={() => setLang(c)}>{l}</ChunkyButton>)}</div></div>
        <div><div className="mb-1 text-sm font-bold">{t("profile.dailyGoal")}</div>
          <div className="flex gap-2">{[20, 50, 100].map((g) =>
            <ChunkyButton key={g} variant={stats.data?.daily_goal === g ? "primary" : "white"} className="text-xs"
              onClick={() => act.mutate(() => api("/game/settings", { method: "PATCH", json: { daily_goal: g } }))}>{g} XP</ChunkyButton>)}</div></div>
        <div className="flex gap-2"><input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={20} placeholder={t("profile.nickname")}
          aria-label={t("profile.nickname")} className="flex-1 rounded-[12px] border-2 border-line px-3 py-2" />
          <ChunkyButton variant="white" className="text-xs" onClick={() => act.mutate(() => api("/game/settings", { method: "PATCH", json: { nickname: nick } }))}>{t("profile.save")}</ChunkyButton></div>
        <label className="flex min-h-11 items-center gap-3 font-bold"><input type="checkbox" className="h-5 w-5"
          onChange={(e) => act.mutate(() => api("/game/settings", { method: "PATCH", json: { league_opt_out: e.target.checked } }))} />{t("profile.leagueOptOut")}</label>
        <label className="flex min-h-11 items-center gap-3 font-bold"><input type="checkbox" className="h-5 w-5" checked={sound} onChange={toggleSound} />{t("profile.sound")}</label>
      </Card>

      <Card className="space-y-2">
        <h2 className="text-lg font-black">{t("profile.parentCode")}</h2>
        {code ? <p className="text-3xl font-black tracking-widest text-sky">{code}</p>
          : <ChunkyButton variant="white" onClick={async () => setCode((await api<{ code: string }>("/me/link-code", { method: "POST" })).code)}>{t("profile.getCode")}</ChunkyButton>}
      </Card>

      <Card><h2 className="mb-2 text-lg font-black">{t("profile.savedTerms")}</h2>
        <QueryState loading={saved.isLoading} error={saved.error} empty={saved.data?.length === 0} emptyText="—">
          <ul className="space-y-1">{saved.data?.map((x) => <li key={x.id}><b>{x.regional}</b> <span className="text-muted">{x.english}</span></li>)}</ul>
        </QueryState></Card>

      <ChunkyButton variant="white" className="w-full" onClick={() => { logout(); qc.clear(); router.replace("/login"); }}>{t("profile.logout")}</ChunkyButton>
    </div>
  );
}
