"use client";
import { useEffect, useRef, type FormEvent } from "react";
import { BilingualText, ChunkyButton, EmptyState, GoluMascot, SourceChip, SpeechBubble, StickerIcon } from "@/components/ui";
import { useBilingual, type BilingualString } from "@/lib/i18n/use-bilingual";
import { cn } from "@/lib/utils/cn";

export type DoubtMode = "ask" | "simpler" | "example";
export interface ChatMessage {
  id: string;
  from: "me" | "golu";
  text?: string;
  answer?: BilingualString;
  inNotes?: boolean;
  pages?: number[];
  error?: BilingualString;
  question?: string;
}

export interface AskScreenProps {
  messages: ChatMessage[];
  draft: string;
  sending: boolean;
  left: number | null;
  about: BilingualString | null;
  noCourse: boolean;
  onDraft: (s: string) => void;
  onSend: (text: string, mode: DoubtMode) => void;
}

export const MAX_DOUBT_LENGTH = 500;

/** Doubt chat with Golu, the farm assistant (POST /doubts). Stateless. */
export function AskScreen(p: AskScreenProps) {
  const t = useBilingual("ask");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [p.messages.length]);
  if (p.noCourse) return <EmptyState className="h-full" message={t("noCourse")} />;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = p.draft.trim();
    if (text && !p.sending) p.onSend(text, "ask");
  };
  const lastQuestion = [...p.messages].reverse().find((m) => m.from === "golu" && m.answer)?.question;
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col px-4 pb-28 pt-20 laptop:max-w-4xl laptop:px-8 laptop:pb-8 laptop:pt-8">
      <header className="flex items-center gap-3 pb-3">
        <GoluMascot pose="question" size={64} />
        <div className="flex flex-col">
          <BilingualText as="h1" size="xl" text={t("title")} />
          {p.about && <BilingualText size="sm" text={p.about} />}
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto pb-3" aria-live="polite" aria-label={t("conversation").english} role="log">
        {p.messages.length === 0 && (
          <SpeechBubble tail="left" className="self-start">
            <BilingualText size="sm" text={t("intro")} />
          </SpeechBubble>
        )}
        {p.messages.map((m) =>
          m.from === "me" ? (
            <p key={m.id} className="max-w-[85%] self-end rounded-card rounded-br-sm bg-sky-strong px-4 py-2 text-white">
              {m.text}
            </p>
          ) : (
            <div key={m.id} className={cn("flex max-w-[90%] flex-col gap-2 self-start rounded-card rounded-bl-sm border-2 bg-white px-4 py-3", m.error ? "border-sun" : "border-line")} data-testid="golu-answer">
              {m.error ? <BilingualText size="sm" text={m.error} /> : m.answer && <BilingualText text={m.answer} />}
              {m.answer && (
                <div className="flex flex-wrap items-center gap-2">
                  {m.inNotes && m.pages?.length ? <SourceChip label={t("fromNotes", { pages: m.pages.join(", ") }).english} /> : <span className="text-xs text-stone">{t("notInNotes").regional} · {t("notInNotes").english}</span>}
                </div>
              )}
            </div>
          ),
        )}
        {p.sending && (
          <p className="self-start text-sm text-stone" role="status">
            {t("thinking").regional} · {t("thinking").english}
          </p>
        )}
        <div ref={end} />
      </div>
      {lastQuestion && !p.sending && (
        <div className="flex gap-2 pb-2">
          {(["simpler", "example"] as const).map((mode) => (
            <ChunkyButton key={mode} size="sm" variant="white" onClick={() => p.onSend(lastQuestion, mode)} disabled={p.left === 0}>
              <BilingualText as="span" size="sm" align="center" text={t(mode)} />
            </ChunkyButton>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <BilingualText as="span" size="sm" text={t("label")} />
          <textarea
            value={p.draft}
            onChange={(e) => p.onDraft(e.target.value.slice(0, MAX_DOUBT_LENGTH))}
            rows={2}
            maxLength={MAX_DOUBT_LENGTH}
            className="min-h-12 w-full resize-none rounded-card border-2 border-line bg-white px-3 py-2 focus:border-sky-strong focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) submit(e);
            }}
          />
        </label>
        <ChunkyButton type="submit" size="icon" disabled={!p.draft.trim() || p.sending || p.left === 0} aria-label={t("send").english} data-testid="send-doubt">
          <StickerIcon name="chat" size={24} />
        </ChunkyButton>
      </form>
      {p.left !== null && (
        <p className="pt-1 text-xs text-stone">
          {t("left", { n: p.left }).regional} · {t("left", { n: p.left }).english}
        </p>
      )}
    </div>
  );
}
