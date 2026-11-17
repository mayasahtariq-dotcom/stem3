"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { playSound } from "@/lib/sound";
import type { CompleteResult } from "@/lib/types";
import { GoluMascot, MeadowScene } from "./game";
import { BilingualText, Card, ChunkyButton, StickerIcon } from "./ui";

/* End of lesson: XP, accuracy, combo, badges, quests, then the Golu Pot. Then stop: short daily habit. */
export function Celebration({ result, accuracy, bestCombo }: { result: CompleteResult; accuracy: number; bestCombo: number }) {
  const { t, bi } = useT();
  const qc = useQueryClient();
  const [reward, setReward] = useState<{ type: string; amount?: number; item?: string } | null>(null);
  const pot = useMutation({
    mutationFn: () => api<{ reward: { type: string; amount?: number; item?: string } }>(`/game/pots/${result.pot_id}/open`, { method: "POST" }),
    onSuccess: (r) => { setReward(r.reward); playSound("pot"); qc.invalidateQueries({ queryKey: ["stats"] }); qc.invalidateQueries({ queryKey: ["mascot"] }); },
  });
  const title = bi("celebrate.title");
  return (
    <section className="relative mx-auto mt-6 w-full max-w-lg space-y-5 pb-48 text-center">
      {/* Leaves and petals drift down: a meadow celebration, not generic confetti. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-4 h-64 overflow-hidden">
        {Array.from({ length: 16 }).map((_, i) => (
          <motion.span key={i} className="absolute h-3 w-2 rounded-full"
            style={{ left: `${(i * 37) % 100}%`, background: ["#58CC02", "#FFC800", "#FF9600", "#CE82FF"][i % 4] }}
            initial={{ y: -20, rotate: 0, opacity: 1 }} animate={{ y: 260, rotate: 360, opacity: 0 }}
            transition={{ duration: 2.2 + (i % 5) * 0.3, delay: (i % 6) * 0.15 }} />))}
      </div>
      <GoluMascot size={150} mood="cheer" stage={result.stats.stage} />
      <BilingualText as="h1" size="xl" regional={title.regional} english={title.english} />
      {result.practice && <p className="font-bold text-coral">{t("celebrate.practice")}</p>}
      <div className="grid grid-cols-3 gap-3">
        <Stat color="text-flame" border="border-sun" label={t("celebrate.xp")} value={`+${result.xp_gained}`} />
        <Stat color="text-grass-dark" border="border-grass" label={t("celebrate.accuracy")} value={`${accuracy}%`} />
        <Stat color="text-sky" border="border-sky" label={t("celebrate.bestCombo")} value={`x${bestCombo}`} />
      </div>
      {result.badges?.length ? <Card className="border-berry/50 bg-berry/10"><p className="font-black text-berry">{t("celebrate.newBadge")}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">{result.badges.map((b) =>
          <span key={b} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm font-bold"><StickerIcon name="trophy" size={18} />{b.replace(/_/g, " ")}</span>)}</div></Card> : null}
      {result.quests_completed?.length ? <Card className="border-sun/60 bg-sun/10"><p className="font-black text-flame">{t("celebrate.questDone")}</p>
        <p className="text-sm">{result.quests_completed.map((q) => t(`quest.${q}`)).join(" · ")}</p></Card> : null}
      {result.pot_id && !reward && (
        <motion.button type="button" onClick={() => pot.mutate()} disabled={pot.isPending} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          animate={{ rotate: [0, -4, 4, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}
          className="mx-auto flex flex-col items-center gap-2 font-black text-ink" aria-label={t("celebrate.openPot")}>
          <StickerIcon name="pot" size={96} />{t("celebrate.openPot")}</motion.button>)}
      <AnimatePresence>{reward && (
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-[16px] border-2 border-sun bg-sun/15 p-4 text-xl font-black">
          <StickerIcon name={reward.type === "gems" ? "gem" : reward.type === "outfit" ? "trophy" : "star"} size={40} className="mx-auto mb-2" />
          {reward.type === "gems" ? t("pot.gems", { n: reward.amount ?? 0 }) : reward.type === "sticker" ? t("pot.sticker", { item: reward.item ?? "" })
            : t("pot.outfit", { item: reward.item ?? "" })}
        </motion.div>)}</AnimatePresence>
      <p className="text-muted">{t("celebrate.stop")}</p>
      <Link href="/learn"><ChunkyButton className="w-full">{t("celebrate.home")}</ChunkyButton></Link>
      <MeadowScene className="fixed" />
    </section>
  );
}

function Stat({ label, value, color, border }: { label: string; value: string; color: string; border: string }) {
  return <div className={`rounded-[16px] border-2 ${border} bg-white p-3`}><div className={`text-2xl font-black ${color}`}>{value}</div>
    <div className="text-xs font-bold uppercase text-muted">{label}</div></div>;
}
