"use client";
import { useEffect, useRef, useState } from "react";
import { BilingualText, ChunkyButton, Dialog, GoluMascot, StickerIcon } from "@/components/ui";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useServices } from "@/lib/services";
import { cn } from "@/lib/utils/cn";

/*
 * Phone simulator: the teacher hears exactly what a phone student hears. Each step runs the real call
 * engine on the server (POST /call-students/{id}/simulate, Sarvam voices when on); nothing is dialled.
 * Clips play in order, then the keypad waits for a key, like a real phone.
 */
type Item = { type: "say" | "play"; text: string; url?: string; lang?: string };
type Target = { step?: string; session?: string };
type Step = { before: Item[]; gather: (Target & { items: Item[] }) | null; after: Item[]; redirect: Target | null; hangup: boolean };
type Line = { who: "aaroh" | "me"; text: string };
type Phase = "idle" | "dialing" | "talking" | "waiting" | "ended" | "error";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

export function usePhoneSimulator(studentId: string | null) {
  const { pending } = useServices();
  const [phase, setPhase] = useState<Phase>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [seconds, setSeconds] = useState(0);
  const gather = useRef<(Target & { after: Item[]; redirect: Target | null; hangup: boolean }) | null>(null);
  const run = useRef(0);                        // bumps on every new step/hang-up so stale playback stops
  const audio = useRef<HTMLAudioElement | null>(null);

  const stopVoice = () => {
    audio.current?.pause();
    audio.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  };

  const speak = (item: Item, my: number) =>
    new Promise<void>((done) => {
      if (my !== run.current) return done();
      setLines((l) => [...l, { who: "aaroh", text: item.text || "…" }]);
      const finish = () => done();
      if (item.type === "play" && item.url) {
        const el = new Audio(item.url);
        audio.current = el;
        el.playbackRate = 1.15;          // a little quicker than a real call
        el.onended = finish;
        el.onerror = finish;
        const cap = window.setTimeout(finish, 20000);
        el.play().catch(finish).finally(() => window.clearTimeout(cap));
        return;
      }
      if ("speechSynthesis" in window && item.text) {
        const u = new SpeechSynthesisUtterance(item.text);
        u.lang = item.lang || "hi-IN";
        u.rate = 1.15;
        u.onend = finish;
        u.onerror = finish;
        window.speechSynthesis.speak(u);
        window.setTimeout(finish, 15000);
        return;
      }
      window.setTimeout(finish, 600);
    });

  const playAll = async (items: Item[], my: number) => {
    for (const it of items) {
      if (my !== run.current) return;
      await speak(it, my);
    }
  };

  // send and handle call each other; the ref always holds this render's send (current student).
  const sendRef = useRef<(step: string, session?: string, digits?: string) => Promise<void>>(async () => {});

  const handle = async (s: Step) => {
    const my = ++run.current;
    stopVoice();
    // keys work as soon as the menu starts (press while Golu is still speaking, like a real phone)
    gather.current = s.gather ? { step: s.gather.step, session: s.gather.session, after: s.after, redirect: s.redirect, hangup: s.hangup } : null;
    setPhase("talking");
    await playAll([...s.before, ...(s.gather?.items ?? [])], my);
    if (my !== run.current) return;
    if (s.gather) {
      setPhase("waiting");
      return;
    }
    await playAll(s.after, my);
    if (my !== run.current) return;
    if (s.redirect?.step && s.redirect.session) return sendRef.current(s.redirect.step, s.redirect.session);
    setPhase("ended");
  };

  const send = async (step: string, session?: string, digits?: string) => {
    if (!studentId) return;
    try {
      const s = await pending.post<Step>(`/call-students/${encodeURIComponent(studentId)}/simulate`, { step, session, digits });
      await handle(s);
    } catch {
      run.current++;
      stopVoice();
      setPhase("error");
    }
  };
  useEffect(() => {
    sendRef.current = send;
  });

  const start = () => {
    run.current++;
    stopVoice();
    setLines([]);
    setSeconds(0);
    setPhase("dialing");
    void send("incoming");
  };

  const press = (key: string) => {
    if (phase !== "waiting" && phase !== "talking") return;
    const g = gather.current;
    if (!g?.step || !g.session) return;                 // keys only count while the phone listens
    setLines((l) => [...l, { who: "me", text: key }]);
    void sendRef.current(g.step, g.session, key);
  };

  /** Like letting a real phone ring out: the call's "no answer" path. */
  const noAnswer = () => {
    const g = gather.current;
    if (!g) return;
    const my = ++run.current;
    gather.current = null;
    setPhase("talking");
    void playAll(g.after, my).then(() => {
      if (my !== run.current) return;
      if (g.redirect?.step && g.redirect.session) void sendRef.current(g.redirect.step, g.redirect.session);
      else setPhase("ended");
    });
  };

  const hangUp = () => {
    run.current++;
    stopVoice();
    gather.current = null;
    setPhase("ended");
  };

  useEffect(() => {
    if (phase !== "talking" && phase !== "waiting") return;
    const id = window.setInterval(() => setSeconds((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);
  // closing the simulator stops any sound (no state change: React may mount twice in development)
  useEffect(() => () => {
    run.current++;
    stopVoice();
  }, []);

  return { phase, lines, seconds, start, press, noAnswer, hangUp };
}

/** The simulator in a dialog: a glassy phone with the caller, the transcript, a keypad and a red hang-up. */
export function PhoneSimulator({ open, onOpenChange, studentId, studentName }: { open: boolean; onOpenChange: (o: boolean) => void; studentId: string | null; studentName: string }) {
  const t = useBilingual("calls");
  const sim = usePhoneSimulator(open ? studentId : null);
  const feed = useRef<HTMLOListElement>(null);
  useEffect(() => {
    feed.current?.scrollTo({ top: feed.current.scrollHeight, behavior: "smooth" });
  }, [sim.lines.length]);
  const close = (o: boolean) => {
    if (!o) sim.hangUp();
    onOpenChange(o);
  };
  const live = sim.phase === "talking" || sim.phase === "waiting";
  const clock = `${String(Math.floor(sim.seconds / 60)).padStart(2, "0")}:${String(sim.seconds % 60).padStart(2, "0")}`;
  const status = sim.phase === "dialing" ? t("simCalling") : live ? `${t("simConnected").regional} · ${clock}` : sim.phase === "ended" ? t("simEnded").regional : sim.phase === "error" ? t("simFailed").regional : t("simReady").regional;
  return (
    <Dialog open={open} onOpenChange={close} title={t("simTitle")} description={t("simHint", { name: studentName })}>
      <div className="flex flex-col items-center gap-3">
        <BilingualText size="sm" align="center" text={t("simHint", { name: studentName })} className="text-stone" />
        <div className="w-full max-w-[300px] rounded-[44px] bg-gradient-to-b from-[#1c2a4a] to-[#0d1526] p-3 shadow-[0_24px_60px_rgb(10_30_80/0.45)]" data-testid="phone-sim" data-phase={sim.phase}>
          <div className="relative flex flex-col gap-3 overflow-hidden rounded-[34px] bg-gradient-to-b from-[#2b6fd6] via-[#3b82f6] to-[#1e3a8a] p-4 text-white">
            <span aria-hidden className="mx-auto h-1.5 w-20 rounded-full bg-black/30" />
            <div className="flex items-center gap-3">
              <div className={cn("rounded-full bg-white/20 p-1", live && "motion-safe:animate-pulse")}>
                <GoluMascot pose={live ? "heart" : "wave"} size={48} />
              </div>
              <div className="min-w-0">
                <p className="font-display text-xl tracking-wide">Aaroh</p>
                <p className="text-xs text-white/85" aria-live="polite" data-testid="sim-status">
                  {typeof status === "string" ? status : `${status.regional}`}
                </p>
              </div>
            </div>
            <ol ref={feed} className="flex h-44 flex-col gap-1.5 overflow-y-auto rounded-2xl bg-white/12 p-2 text-sm backdrop-blur-sm" aria-label={t("simTranscript").english} data-testid="sim-transcript">
              {sim.lines.length === 0 && <li className="m-auto text-center text-white/70">{t("simEmpty").regional}</li>}
              {sim.lines.map((l, i) => (
                <li key={i} className={cn("max-w-[85%] rounded-2xl px-3 py-1.5 leading-snug", l.who === "aaroh" ? "self-start bg-white/90 text-ink" : "self-end bg-[#22c55e] font-bold text-white")}>
                  {l.who === "me" ? `${t("simPressed").regional} ${l.text}` : l.text}
                </li>
              ))}
            </ol>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={t("simKeypad").english}>
              {KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => sim.press(k)}
                  disabled={sim.phase !== "waiting" && sim.phase !== "talking"}
                  className="grid h-11 place-items-center rounded-full bg-white/18 text-lg font-extrabold transition active:scale-95 enabled:hover:bg-white/30 disabled:opacity-40"
                  data-testid={`sim-key-${k}`}
                >
                  {k}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-center gap-3">
              {live ? (
                <>
                  {sim.phase === "waiting" && (
                    <button type="button" onClick={sim.noAnswer} className="rounded-full bg-white/20 px-3 py-2 text-xs font-bold hover:bg-white/30" data-testid="sim-no-answer">
                      {t("simNoAnswer").regional}
                    </button>
                  )}
                  <button type="button" onClick={sim.hangUp} aria-label={t("simHangUp").english} className="grid size-14 place-items-center rounded-full bg-[#ef4444] shadow-lg transition active:scale-95" data-testid="sim-hang-up">
                    <StickerIcon name="speaker" size={26} />
                  </button>
                </>
              ) : (
                <button type="button" onClick={sim.start} disabled={sim.phase === "dialing"} className="flex items-center gap-2 rounded-full bg-[#22c55e] px-5 py-3 font-extrabold shadow-lg transition active:scale-95 disabled:opacity-60" data-testid="sim-call">
                  <StickerIcon name="speaker" size={22} /> {sim.phase === "idle" ? t("simCall").regional : t("simAgain").regional}
                </button>
              )}
            </div>
          </div>
        </div>
        <ChunkyButton variant="ghost" size="sm" onClick={() => close(false)}>
          <BilingualText as="span" size="sm" text={t("simClose")} />
        </ChunkyButton>
      </div>
    </Dialog>
  );
}
