"use client";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import type { Stats } from "@/lib/types";
import { StickerIcon } from "./ui";

export function StreakFlame({ days, lit = true }: { days: number; lit?: boolean }) {
  return <span className="inline-flex items-center gap-1 font-bold text-flame" aria-label={`${days} day streak`}>
    <span className={clsx(lit && days > 0 && "anim-flicker", !lit && "grayscale opacity-50")}><StickerIcon name="flame" size={26} /></span>{days}</span>;
}
export function HeartMeter({ hearts }: { hearts: number }) {
  return <span className="inline-flex items-center gap-1 font-bold text-coral" aria-label={`${hearts} hearts`}>
    <StickerIcon name="heart" size={24} />{hearts}</span>;
}
export function GemCounter({ gems }: { gems: number }) {
  return <span className="inline-flex items-center gap-1 font-bold text-sky" aria-label={`${gems} gems`}>
    <StickerIcon name="gem" size={24} />{gems}</span>;
}

/* Daily goal ring that fills on the home screen. */
export function XPRing({ value, goal, size = 96 }: { value: number; goal: number; size?: number }) {
  const r = size / 2 - 8, c = 2 * Math.PI * r, pct = Math.min(1, goal ? value / goal : 0);
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}
         role="img" aria-label={`${value} of ${goal} XP today`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-line)" strokeWidth="10" fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-sun)" strokeWidth="10" fill="none"
          strokeLinecap="round" strokeDasharray={c} initial={false} animate={{ strokeDashoffset: c * (1 - pct) }} />
      </svg>
      <span className="absolute text-center text-sm font-bold leading-tight">{value}<br /><span className="text-xs text-muted">/ {goal} XP</span></span>
    </div>
  );
}

export function TopStatsBar({ stats }: { stats: Pick<Stats, "streak" | "gems" | "hearts"> & { xp?: number } }) {
  return <div className="flex items-center justify-around gap-4 py-2">
    <StreakFlame days={stats.streak} /><GemCounter gems={stats.gems} /><HeartMeter hearts={stats.hearts} /></div>;
}

/* XP pop that floats up after a correct answer. */
export function XPPop({ xp, id }: { xp: number; id: number }) {
  return <AnimatePresence>{xp > 0 ? <motion.span key={id} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -40 }}
    transition={{ duration: 1 }} className="pointer-events-none absolute right-6 top-2 text-2xl font-black text-flame">+{xp} XP</motion.span> : null}</AnimatePresence>;
}

/* Golu the cow: grows from calf to cow to champion; wears outfit pieces. */
export function GoluMascot({ stage = "calf", size = 120, mood = "happy", outfit = [] }:
  { stage?: string; size?: number; mood?: "happy" | "think" | "cheer"; outfit?: string[] }) {
  const scale = stage === "calf" ? 0.82 : stage === "cow" ? 0.95 : 1;
  return (
    <motion.svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={`Golu the ${stage}`}
      animate={mood === "cheer" ? { y: [0, -10, 0] } : { y: [0, -3, 0] }}
      transition={{ duration: mood === "cheer" ? 0.6 : 2.4, repeat: Infinity, ease: "easeInOut" }}>
      <g transform={`translate(60 64) scale(${scale}) translate(-60 -64)`}>
        <ellipse cx="60" cy="108" rx="34" ry="6" fill="#000" opacity=".08" />
        <ellipse cx="60" cy="78" rx="34" ry="26" fill="#fff" stroke="#3C3C3C" strokeWidth="3" />
        <ellipse cx="44" cy="76" rx="10" ry="8" fill="#3C3C3C" opacity=".85" />
        <ellipse cx="78" cy="86" rx="8" ry="6" fill="#3C3C3C" opacity=".85" />
        <path d="M34 34c-10-6-14 0-12 6 4 1 8 0 12-2zM86 34c10-6 14 0 12 6-4 1-8 0-12-2z" fill="#FFB8C6" stroke="#3C3C3C" strokeWidth="3" />
        <path d="M40 24c-2-8 2-12 6-12M80 24c2-8-2-12-6-12" stroke="#E8C07A" strokeWidth="6" strokeLinecap="round" />
        <circle cx="60" cy="44" r="26" fill="#fff" stroke="#3C3C3C" strokeWidth="3" />
        <ellipse cx="60" cy="56" rx="16" ry="11" fill="#FFB8C6" stroke="#3C3C3C" strokeWidth="3" />
        <circle cx="54" cy="56" r="2.5" fill="#3C3C3C" /><circle cx="66" cy="56" r="2.5" fill="#3C3C3C" />
        {mood === "think"
          ? <><circle cx="50" cy="40" r="3.5" fill="#3C3C3C" /><circle cx="70" cy="40" r="3.5" fill="#3C3C3C" /></>
          : <><path d="M46 40q4-5 8 0M66 40q4-5 8 0" stroke="#3C3C3C" strokeWidth="3.5" fill="none" strokeLinecap="round" /></>}
        <circle cx="42" cy="48" r="4" fill="#FF8FA3" opacity=".6" /><circle cx="78" cy="48" r="4" fill="#FF8FA3" opacity=".6" />
        {stage === "champion" ? <path d="M44 20l5 7 6-9 5 9 6-9 5 9 5-7v10H44z" fill="#FFC800" stroke="#3C3C3C" strokeWidth="2.5" /> : null}
        {outfit.includes("cap") ? <path d="M38 26q22-16 44 0v4H38z M76 28h14" fill="#1CB0F6" stroke="#3C3C3C" strokeWidth="2.5" /> : null}
        {outfit.includes("bow") ? <path d="M78 22l10-6v12zM78 22l-10-6v12z" fill="#CE82FF" stroke="#3C3C3C" strokeWidth="2" /> : null}
        {outfit.includes("scarf") ? <path d="M38 68q22 10 44 0v8q-22 10-44 0z" fill="#FF4B4B" stroke="#3C3C3C" strokeWidth="2.5" /> : null}
        {outfit.includes("glasses") ? <g stroke="#3C3C3C" strokeWidth="2.5" fill="#fff8"><circle cx="50" cy="40" r="7" /><circle cx="70" cy="40" r="7" /><path d="M57 40h6" /></g> : null}
        {outfit.includes("medal") ? <><path d="M54 66l6 10 6-10" stroke="#1CB0F6" strokeWidth="4" fill="none" /><circle cx="60" cy="80" r="6" fill="#FFC800" stroke="#3C3C3C" strokeWidth="2" /></> : null}
        {outfit.includes("cape") ? <path d="M30 70q30 40 60 0l6 30H24z" fill="#FF9600" opacity=".85" /> : null}
      </g>
    </motion.svg>
  );
}

/* Rolling meadow behind the path. */
export function MeadowScene({ className }: { className?: string }) {
  return (
    <svg className={clsx("pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-48 w-full", className)} viewBox="0 0 1200 200"
         preserveAspectRatio="none" aria-hidden>
      <path d="M0 120C200 60 400 140 600 100S1000 50 1200 110V200H0z" fill="#A5E26A" />
      <path d="M0 150C250 110 450 180 700 140S1050 120 1200 150V200H0z" fill="#58CC02" />
      {[120, 380, 820, 1050].map((x) => <g key={x}><circle cx={x} cy={150} r="6" fill="#FFC800" /><circle cx={x + 14} cy={158} r="5" fill="#fff" /></g>)}
    </svg>
  );
}
