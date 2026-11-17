"use client";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { pick } from "@/lib/i18n";
import type { Lang } from "@/lib/session";

export function AnswerOption({ index, label, sub, selected, state, disabled, onSelect }:
  { index: number; label: string; sub?: string; selected: boolean; state?: "right" | "wrong"; disabled?: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} disabled={disabled} aria-pressed={selected}
      className={clsx("flex min-h-14 w-full items-center gap-3 rounded-[12px] border-2 px-4 py-3 text-left transition",
        "shadow-[0_4px_0_var(--color-line)] active:translate-y-[2px] active:shadow-none",
        state === "right" && "border-grass bg-grass/15 shadow-[0_4px_0_var(--color-grass)]",
        state === "wrong" && "anim-shake border-coral bg-coral/10 shadow-[0_4px_0_var(--color-coral)]",
        !state && selected && "border-sky bg-sky/10 shadow-[0_4px_0_var(--color-sky)]",
        !state && !selected && "border-line bg-white hover:bg-cloud")}>
      <kbd className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 border-line text-sm font-bold text-muted">{index}</kbd>
      <span><span className="block text-lg font-bold">{label}</span>{sub && sub !== label ? <span className="block text-sm text-muted">{sub}</span> : null}</span>
    </button>
  );
}

export function FillIn({ value, onChange, disabled, placeholder }: { value: string; onChange: (v: string) => void; disabled?: boolean; placeholder: string }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder}
    aria-label={placeholder} autoFocus
    className="w-full rounded-[12px] border-2 border-line bg-white px-4 py-4 text-xl font-bold outline-none focus:border-sky" />;
}

/* Match / interactive: options are [left..., right...]; tap a left item, then its partner. */
export function MatchPairs({ options, value, onChange, disabled, lang, interactive }:
  { options: unknown[]; value: Record<string, string>; onChange: (v: Record<string, string>) => void;
    disabled?: boolean; lang: Lang; interactive?: boolean }) {
  const n = Math.floor(options.length / 2);
  const left = options.slice(0, n), right = useMemo(() => options.slice(n), [options, n]);
  const [active, setActive] = useState<string | null>(null);
  const key = (o: unknown) => (typeof o === "string" ? o : JSON.stringify(o));
  const usedRight = new Set(Object.values(value));
  const colors = ["bg-sun/30 border-sun", "bg-berry/25 border-berry", "bg-sky/20 border-sky", "bg-flame/25 border-flame", "bg-grass/20 border-grass"];
  const pairIndex = (l: string) => Object.keys(value).indexOf(l);
  return (
    <div className={clsx("grid grid-cols-2 gap-3", interactive && "rounded-[16px] bg-grass/5 p-3")}>
      <div className="space-y-3">{left.map((o) => { const k = key(o); const pi = pairIndex(k);
        return <button key={k} type="button" disabled={disabled} onClick={() => setActive(active === k ? null : k)}
          className={clsx("min-h-14 w-full rounded-[12px] border-2 px-3 py-2 font-bold shadow-[0_4px_0_var(--color-line)]",
            pi >= 0 ? colors[pi % colors.length] : active === k ? "border-sky bg-sky/10" : "border-line bg-white")}>{pick(o, lang)}</button>; })}</div>
      <div className="space-y-3">{right.map((o) => { const k = key(o); const owner = Object.keys(value).find((l) => value[l] === k);
        const pi = owner ? pairIndex(owner) : -1;
        return <button key={k} type="button" disabled={disabled || (!active && !owner)} onClick={() => {
            const next = { ...value };
            if (owner) delete next[owner];
            if (active) { next[active] = k; setActive(null); }
            onChange(next);
          }}
          className={clsx("min-h-14 w-full rounded-[12px] border-2 px-3 py-2 font-bold shadow-[0_4px_0_var(--color-line)]",
            pi >= 0 ? colors[pi % colors.length] : usedRight.has(k) ? "opacity-50" : "border-line bg-white")}>{pick(o, lang)}</button>; })}</div>
    </div>
  );
}
