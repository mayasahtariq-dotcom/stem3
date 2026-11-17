"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { BilingualText, ChunkyButton, GoluMascot, StickerIcon, type StickerIconName } from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useTri } from "@/lib/i18n/use-tri";
import { cn } from "@/lib/utils/cn";
import { optionText, seededOrder, type QuestionContent } from "./content";
import { QuestionBody, useNumberKeys, type QuestionProps } from "./questions";

/*
 * Mini-games: each question type is played as a small farm game. The answer
 * still goes up through onAnswer in the same shape and the server grades it,
 * so XP, hearts, combos, quests and gems work exactly as in the plain view.
 * No timers: slow readers are never punished.
 */
type Props = Omit<QuestionProps<QuestionContent>, "content"> & { content: QuestionContent };

const FOODS: StickerIconName[] = ["carrot", "corn", "melon", "berry", "peas", "hay", "cane", "leaf"];
const ok = "border-grass-strong bg-[#ecf8e4]";
const bad = "border-coral-strong bg-[#fdeeed]";
const picked = "border-sky-strong bg-sky-soft";

function GoButton({ disabled, busy, label, onClick }: { disabled: boolean; busy: boolean; label: { regional: string; english: string }; onClick: () => void }) {
  return (
    <ChunkyButton block size="lg" disabled={disabled} loading={busy} onClick={onClick} data-testid="check-answer">
      <BilingualText as="span" align="center" tone="inverse" text={label} />
    </ChunkyButton>
  );
}

/** Multiple choice: pick a basket and toss it into Golu's bowl. */
export function FeedGolu({ id, content, terms, result, busy, onAnswer }: QuestionProps<Extract<QuestionContent, { type: "multiple_choice" }>>) {
  const tri = useTri();
  const t = useBilingual("lesson");
  const [pick, setPick] = useState<number | null>(null);
  const locked = Boolean(result) || busy;
  useNumberKeys(content.options.length, setPick, !locked);
  const right = result ? Number(result.correctAnswer.index) : null;
  const foods = useMemo(() => seededOrder(FOODS.length, id).map((i) => FOODS[i]!), [id]);
  return (
    <div className="flex flex-col gap-4" data-testid="game-feed">
      <div className="flex items-end justify-center gap-2">
        <GoluMascot pose={!result ? "question" : result.correct ? "heart" : "sad"} size={96} />
        <div className="relative">
          <StickerIcon name="bowl" size={64} />
          {result?.correct && pick !== null && (
            <span className="anim-drop absolute -top-6 left-1/2 -translate-x-1/2">
              <StickerIcon name={foods[pick % foods.length]!} size={36} />
            </span>
          )}
        </div>
      </div>
      <div role="radiogroup" aria-label={t("chooseOne").english} className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
        {content.options.map((o, i) => {
          const isRight = right === i;
          const isBad = result && pick === i && !result.correct;
          return (
            <button
              key={i}
              type="button"
              aria-pressed={pick === i}
              disabled={locked}
              onClick={() => setPick(i)}
              className={cn(
                "flex min-h-16 items-center gap-3 rounded-card border-2 border-b-4 px-3 py-2 text-left transition-transform",
                isRight ? ok : isBad ? bad : pick === i ? cn(picked, "-translate-y-1") : "border-line bg-white hover:bg-cream",
              )}
            >
              <StickerIcon name={foods[i % foods.length]!} size={36} />
              <span className="text-xs font-bold text-stone">{i + 1}</span>
              <BilingualText as="span" size="sm" text={tri(optionText(o, terms))} className="flex-1" />
            </button>
          );
        })}
      </div>
      {!result && <GoButton disabled={pick === null} busy={busy} label={t("gameFeedGo")} onClick={() => pick !== null && onAnswer({ type: "multiple_choice", index: pick })} />}
    </div>
  );
}

/** True / false: send the crate to the True barn or the False barn (keys 1/2 or arrows). */
export function BarnSort({ content, result, busy, onAnswer }: QuestionProps<Extract<QuestionContent, { type: "true_false" }>>) {
  const tri = useTri();
  const t = useBilingual("lesson");
  const [pick, setPick] = useState<number | null>(null);
  const locked = Boolean(result) || busy;
  useNumberKeys(2, setPick, !locked);
  useEffect(() => {
    if (locked) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setPick(0);
      if (e.key === "ArrowRight") setPick(1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [locked]);
  const right = result ? (result.correctAnswer.value === true ? 0 : 1) : null;
  const barns = [t("true"), t("false")];
  return (
    <div className="flex flex-col gap-4" data-testid="game-sort">
      <div
        className={cn(
          "wood-grain mx-auto w-full max-w-md rounded-card p-4 text-white transition-transform duration-300 [text-shadow:0_1px_0_rgb(0_0_0/0.4)]",
          pick === 0 && "-translate-x-6 -rotate-2",
          pick === 1 && "translate-x-6 rotate-2",
        )}
      >
        <BilingualText size="lg" tone="inverse" text={tri(content.statement)} />
      </div>
      <div role="radiogroup" aria-label={t("chooseOne").english} className="grid grid-cols-2 gap-3">
        {barns.map((label, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={pick === i}
            disabled={locked}
            onClick={() => setPick(i)}
            className={cn(
              "flex min-h-24 flex-col items-center justify-center gap-1 rounded-card border-2 border-b-4 p-3",
              right === i ? ok : result && pick === i && !result.correct ? bad : pick === i ? picked : "border-line bg-white hover:bg-cream",
            )}
          >
            <span className="text-xs font-bold text-stone">{i + 1}</span>
            <StickerIcon name={i === 0 ? "sparkle" : "warn"} size={40} />
            <BilingualText as="span" align="center" text={label} />
          </button>
        ))}
      </div>
      {!result && <GoButton disabled={pick === null} busy={busy} label={t("gameSortGo")} onClick={() => pick !== null && onAnswer({ type: "true_false", value: pick === 0 })} />}
    </div>
  );
}

/**
 * Match pairs as a memory game: every part and its match are face-down patches.
 * Flip two; a part with its own match stays open. A miss flips back and costs
 * no heart; the answer is sent once every pair is found, with the miss count.
 */
export function MemoryPatch({ id, content, terms, result, busy, onAnswer }: QuestionProps<Extract<QuestionContent, { type: "match_pairs" }>>) {
  const tri = useTri();
  const t = useBilingual("lesson");
  const n = content.pairs.length;
  const cards = useMemo(() => seededOrder(2 * n, id).map((k) => ({ pair: k % n, side: k < n ? ("left" as const) : ("right" as const) })), [n, id]);
  const [open, setOpen] = useState<number[]>([]);
  const [found, setFound] = useState<number[]>([]);
  const [miss, setMiss] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const locked = Boolean(result) || busy || miss.length > 0;

  const flip = (i: number) => {
    if (locked || open.includes(i) || found.includes(cards[i]!.pair)) return;
    const next = [...open, i];
    if (next.length < 2) return setOpen(next);
    const [a, b] = next.map((k) => cards[k]!) as [(typeof cards)[number], (typeof cards)[number]];
    if (a.pair === b.pair && a.side !== b.side) {
      const done = [...found, a.pair];
      setFound(done);
      setOpen([]);
      if (done.length === n) onAnswer({ type: "match_pairs", pairs: done.map((p) => [p, p] as [number, number]), mistakes });
    } else {
      setOpen(next);
      setMiss(next);
      setMistakes((m) => m + 1);
      timer.current = setTimeout(() => {
        setMiss([]);
        setOpen([]);
      }, 900);
    }
  };

  return (
    <div className="flex flex-col gap-3" data-testid="game-memory">
      <p className="text-sm text-stone" aria-live="polite">
        {t("matchProgress", { done: found.length, total: n }).regional} · {t("matchProgress", { done: found.length, total: n }).english}
      </p>
      <ul className="grid grid-cols-2 gap-3 tablet:grid-cols-4">
        {cards.map((c, i) => {
          const isFound = found.includes(c.pair);
          const up = isFound || open.includes(i);
          const p = content.pairs[c.pair]!;
          const text = tri(optionText(c.side === "left" ? p.left : p.right, terms));
          return (
            <li key={i}>
              <button
                type="button"
                disabled={locked || isFound}
                onClick={() => flip(i)}
                aria-label={up ? text.english : t("gameFlip", { n: i + 1 }).english}
                data-testid={`memory-card-${i}`}
                className={cn(
                  "flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-card border-2 border-b-4 p-2 text-center",
                  isFound ? cn(ok, "opacity-90") : miss.includes(i) ? cn(bad, "motion-safe:animate-[shake_.35s_ease-in-out]") : up ? picked : "border-[#8a5a2b] bg-[#c8935a] hover:brightness-105",
                )}
              >
                {up ? (
                  <>
                    <StickerIcon name={c.side === "left" ? "seeds" : "sprout"} size={22} />
                    <BilingualText as="span" size="sm" align="center" text={text} />
                  </>
                ) : (
                  <>
                    <StickerIcon name="grass" size={32} />
                    <span className="text-xs font-bold text-white">{i + 1}</span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {mistakes > 0 && !result && (
        <p className="text-sm text-stone">
          {t("matchNoHeart").regional} · {t("matchNoHeart").english}
        </p>
      )}
    </div>
  );
}

const GAME = {
  multiple_choice: { name: "gameFeed", hint: "gameFeedHint", icon: "bowl" },
  true_false: { name: "gameSort", hint: "gameSortHint", icon: "hay" },
  match_pairs: { name: "gameMemory", hint: "gameMemoryHint", icon: "puzzle" },
} as const;

const PLAIN_KEY = "aaroh.plainQuestions";
function readPlain(): boolean {
  try {
    return localStorage.getItem(PLAIN_KEY) === "1";
  } catch {
    return false;
  }
}

/** A question as a mini-game, with a switch back to the plain view (remembered on this device). */
export function QuestionStage(props: Props) {
  const t = useBilingual("lesson");
  // questions only render on the client, after the lesson loads, so reading storage here is safe
  const [plain, setPlain] = useState(readPlain);
  const c = props.content;
  const game = c.type in GAME ? GAME[c.type as keyof typeof GAME] : null;
  const toggle = () => {
    const next = !plain;
    setPlain(next);
    try {
      localStorage.setItem(PLAIN_KEY, next ? "1" : "0");
    } catch {
      /* private mode: the switch still works for this lesson */
    }
  };
  if (!game) return <QuestionBody {...props} />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-card bg-sun-soft px-3 py-2">
        {!plain && <StickerIcon name={game.icon} size={28} />}
        <span className="flex flex-1 flex-col">
          {!plain && <BilingualText as="span" size="sm" text={t(game.name)} className="font-bold" />}
          {!plain && <BilingualText as="span" size="sm" text={t(game.hint)} className="text-stone" />}
        </span>
        <ChunkyButton type="button" size="sm" variant="white" onClick={toggle} data-testid="game-toggle">
          <BilingualText as="span" size="sm" text={plain ? t("gameView") : t("plainView")} />
        </ChunkyButton>
      </div>
      {plain ? (
        <QuestionBody {...props} />
      ) : c.type === "multiple_choice" ? (
        <FeedGolu {...props} content={c} />
      ) : c.type === "true_false" ? (
        <BarnSort {...props} content={c} />
      ) : c.type === "match_pairs" ? (
        <MemoryPatch {...props} content={c} />
      ) : null}
    </div>
  );
}
