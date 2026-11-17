"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { asApiError } from "@/lib/api/errors";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useTri } from "@/lib/i18n/use-tri";
import { useAskDoubt, useHome, useTerms } from "./api";
import { AskScreen, type ChatMessage, type DoubtMode } from "./AskScreen";

export function AskRoute() {
  const params = useSearchParams();
  const t = useBilingual("ask");
  const errors = useBilingual("errors");
  const tri = useTri();
  const home = useHome();
  const courseId = params.get("course") || home.data?.continue_lesson?.course_id || home.data?.courses[0]?.id || null;
  const questionId = params.get("question");
  const termKey = params.get("term");
  const terms = useTerms(termKey ? courseId : null);
  const ask = useAskDoubt();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [left, setLeft] = useState<number | null>(null);

  const term = termKey ? terms.data?.find((x) => x.key === termKey) : null;
  const about = questionId ? t("aboutQuestion") : term ? t("aboutTerm", { term: tri((term.content as { forms?: never }).forms).regional, termEn: tri((term.content as { forms?: never }).forms).english }) : null;

  const send = (text: string, mode: DoubtMode) => {
    if (!courseId) return;
    const n = messages.length;
    setMessages((m) => [...m, { id: `me-${n}`, from: "me", text: mode === "ask" ? text : t(mode).regional }]);
    if (mode === "ask") setDraft("");
    ask.mutate(
      { course_id: courseId, question_id: questionId, term_key: termKey, text, mode },
      {
        onSuccess: (res) => {
          setLeft(res.doubts_left_today);
          setMessages((m) => [...m, { id: res.id, from: "golu", answer: tri(res.answer as never), inNotes: res.in_notes, pages: res.source_pages, question: text }]);
        },
        onError: (e) => {
          const code = asApiError(e).code;
          if (code === "DOUBT_LIMIT") setLeft(0);
          if (mode === "ask") setDraft(text);
          setMessages((m) => [...m, { id: `err-${n}`, from: "golu", error: code === "DOUBT_LIMIT" ? t("limit") : code === "AI_UNAVAILABLE" ? t("unavailable") : errors(code) }]);
        },
      },
    );
  };

  return (
    <div className="h-full bg-gradient-to-b from-sky-soft to-cream">
      <AskScreen messages={messages} draft={draft} sending={ask.isPending} left={left} about={about} noCourse={Boolean(home.data && !courseId)} onDraft={setDraft} onSend={send} />
    </div>
  );
}
