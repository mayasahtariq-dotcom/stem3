"use client";
import { useLocale } from "next-intl";
import { useCallback, useState } from "react";
import { useAudio } from "./api";

/**
 * Reads a line aloud: POST /audio for the server's voice (Sarvam behind the
 * backend's SpeechProvider); when the server has no clip, the browser's own
 * speech synthesis reads it. Never plays before a user gesture.
 */
export function useSpeak() {
  const locale = useLocale();
  const audio = useAudio();
  const [speaking, setSpeaking] = useState(false);
  const speak = useCallback(
    async (text: string) => {
      setSpeaking(true);
      try {
        // the server translates an English line first, so the voice stays in the student's language
        const res: { url?: string; text?: string } = await audio.mutateAsync({ text, language: locale === "kn" ? "kn" : "hi" }).catch(() => ({ url: "" }));
        if (res.url) {
          const el = new Audio(res.url);
          el.onended = () => setSpeaking(false);
          await el.play();
          return;
        }
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          const u = new SpeechSynthesisUtterance(res.text || text);
          u.lang = locale === "kn" ? "kn-IN" : "hi-IN";
          u.onend = () => setSpeaking(false);
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(u);
          return;
        }
        setSpeaking(false);
      } catch {
        setSpeaking(false);
      }
    },
    [audio, locale],
  );
  return { speak, speaking };
}
