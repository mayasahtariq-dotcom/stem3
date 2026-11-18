"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useAuthStore } from "@/features/auth/auth-store";
import type { ApiClient } from "@mooshala/api-client";
import { useServices } from "@/lib/services";
import type { BilingualString } from "@/lib/i18n/use-bilingual";
import type { Tri } from "@/lib/i18n/use-tri";
import { appCallBackend, browserResumeStore } from "./app-backend";
import {
  CallEngine,
  type CallBackend,
  type CallState,
  type Prompt,
  type ResumeStore,
} from "./engine";
import { keyFromKeyboard, pressKey, type Key } from "./keypad";

export interface Voice {
  speak(text: string, lang: string): Promise<void>;
  stop(): void;
}

function browserSpeak(text: string, lang: string): Promise<void> {
  return new Promise((done) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return done();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 1.05;
    const cap = window.setTimeout(done, 12000 + text.length * 60);
    u.onend = u.onerror = () => (window.clearTimeout(cap), done());
    window.speechSynthesis.speak(u);
  });
}

/**
 * The tutor's voice: the server's voice (POST /audio, which also translates any English line into the
 * student's language), else the browser's speechSynthesis. Without either the transcript still works.
 */
export function appVoice(api: ApiClient): Voice {
  let current: HTMLAudioElement | null = null;
  return {
    async speak(text, lang) {
      const language = lang.startsWith("kn") ? "kn" : "hi";
      let res: { url?: string; text?: string } = {};
      try {
        res = (await api.POST("/audio", { body: { text, language } })).data ?? {};
      } catch {
        /* offline or no server voice: the browser reads it */
      }
      if (res.url) {
        const el = new Audio(res.url);
        current = el;
        const ok = await new Promise<boolean>((done) => {
          el.onended = () => done(true);
          el.onerror = () => done(false);
          el.play().catch(() => done(false));
        });
        if (ok || current !== el) return;
      }
      await browserSpeak(res.text || text, lang);
    },
    stop() {
      current?.pause();
      current = null;
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    },
  };
}

const isTri = (v: unknown): v is Tri => typeof v === "object" && v !== null && "en" in v;

/** Turns engine prompts into both lines of text. */
export function usePromptText() {
  const locale = useLocale();
  const regional = useTranslations("phoneSim");
  const english = useTranslations("_en.phoneSim");
  return useCallback(
    (parts: Prompt[]): BilingualString => {
      const pick = (t: Tri, en: boolean) => (en ? t.en : (locale === "kn" ? t.kn : t.hi) || t.en);
      const one = (pr: Prompt, en: boolean) => {
        if ("tri" in pr) return pick(pr.tri, en);
        const values = Object.fromEntries(
          Object.entries(pr.params ?? {}).map(([k, v]) => [k, isTri(v) ? pick(v, en) : v]),
        );
        return (en ? english : regional)(pr.key, values);
      };
      return {
        regional: parts.map((x) => one(x, false)).join(" "),
        english: parts.map((x) => one(x, true)).join(" "),
      };
    },
    [english, locale, regional],
  );
}

export interface PhoneCallModel {
  state: CallState;
  seconds: number;
  muted: boolean;
  setMuted: (m: boolean) => void;
  press: (k: Key) => void;
  dial: () => void;
  hangUp: () => void;
  demoSignIn: () => void;
  text: (parts: Prompt[]) => BilingualString;
}

/**
 * View-model for the call simulator: owns one CallEngine, speaks new lines, runs the call timer,
 * listens to the physical keyboard, and moves on after feedback once it has been spoken.
 */
export function usePhoneCall(opts: {
  demo: { id: string; pin: string };
  backend?: CallBackend;
  resume?: ResumeStore;
  voice?: Voice;
}): PhoneCallModel {
  const services = useServices();
  const qc = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  const locale = useLocale();
  const text = usePromptText();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const voice = useMemo(() => opts.voice ?? appVoice(services.api), []);
  const engine = useMemo(
    () =>
      new CallEngine(
        opts.backend ??
          appCallBackend({
            api: services.api,
            pending: services.pending,
            auth: services.auth,
            setSession: (s) => {
              qc.clear();
              setSession(s);
            },
            afterChange: () => void qc.invalidateQueries(),
          }),
        opts.resume ?? browserResumeStore,
      ),
    // one engine per page visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const state = useSyncExternalStore(
    useCallback((fn) => engine.subscribe(fn), [engine]),
    () => engine.state,
    () => engine.state,
  );
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const spoken = useRef(0);
  const speaking = useRef(Promise.resolve());

  // speak each new AI line in order; after feedback has been heard, go on
  useEffect(() => {
    const fresh = state.lines.slice(spoken.current).filter((l) => l.who === "ai");
    spoken.current = state.lines.length;
    if (fresh.length === 0) return;
    const lang = locale === "kn" ? "kn-IN" : "hi-IN";
    const phase = state.phase;
    const seq = state.speakSeq;
    speaking.current = speaking.current.then(async () => {
      if (muted) return;
      for (const l of fresh) await voice.speak(text(l.parts).regional, lang);
    });
    if (phase === "feedback") {
      const wait = muted ? new Promise((r) => setTimeout(r, 1800)) : speaking.current;
      void wait.then(() => {
        if (engine.state.phase === "feedback" && engine.state.speakSeq === seq)
          void engine.advance();
      });
    }
  }, [engine, locale, muted, state.lines, state.phase, state.speakSeq, text, voice]);

  useEffect(() => {
    if (!state.startedAt) return;
    const tick = () => setSeconds(engine.seconds);
    tick();
    if (state.phase === "ended") return;
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [engine, state.phase, state.startedAt]);

  const press = useCallback(
    (k: Key) => {
      voice.stop(); // a key press interrupts the voice, like a real phone menu
      speaking.current = Promise.resolve();
      pressKey(engine, k);
    },
    [engine, voice],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      )
        return;
      const k = keyFromKeyboard(e);
      if (!k || !engine.live) return;
      e.preventDefault();
      press(k);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine, press]);

  useEffect(
    () => () => {
      voice.stop();
      engine.hangUp(); // leaving the page ends the call (saved as an interrupted session)
    },
    [engine, voice],
  );

  return {
    state,
    seconds,
    muted,
    setMuted: (m) => {
      if (m) voice.stop();
      setMuted(m);
    },
    press,
    dial: () => engine.dial(),
    hangUp: () => {
      voice.stop();
      engine.hangUp();
    },
    demoSignIn: () => void engine.quickSignIn(opts.demo.id, opts.demo.pin),
    text,
  };
}
