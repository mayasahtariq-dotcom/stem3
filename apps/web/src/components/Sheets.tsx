"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { api } from "@/lib/api";
import { pick, useT } from "@/lib/i18n";
import { useTerms } from "@/lib/queries";
import type { Doubt } from "@/lib/types";
import { GoluMascot } from "./game";
import { ChunkyButton, ListenButton, QueryState, SourceChip, SpeechBubble } from "./ui";

function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const { t } = useT();
  return (
    <AnimatePresence>{open && (
      <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" initial={{ opacity: 0 }}
        animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
          initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
          className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-[16px] bg-white p-5 sm:rounded-[16px]">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black">{title}</h2>
            <button onClick={onClose} className="h-11 w-11 rounded-full text-2xl text-muted hover:bg-cloud" aria-label={t("common.close")}>×</button></div>
          {children}
        </motion.div>
      </motion.div>)}</AnimatePresence>
  );
}

export function TermsSheet({ open, courseId, onClose }: { open: boolean; courseId?: string; onClose: () => void }) {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const terms = useTerms(open ? courseId : undefined);
  const toggle = useMutation({
    mutationFn: ({ id, saved }: { id: string; saved: boolean }) => api(`/terms/${id}/save`, { method: saved ? "DELETE" : "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["terms", courseId] }),
  });
  return (
    <Sheet open={open} onClose={onClose} title={t("terms.title")}>
      <QueryState loading={terms.isLoading} error={terms.error} empty={terms.data?.length === 0} emptyText={t("terms.empty")}>
        <ul className="space-y-3">{terms.data?.map((x) => (
          <li key={x.id} className="rounded-[12px] border-2 border-line p-3">
            <div className="flex items-center gap-2">
              <div className="flex-1"><div className="text-lg font-black">{x.regional}</div><div className="text-sm text-muted">{x.english}</div></div>
              <ListenButton text={x.regional} label={t("lesson.listen")} />
              <ChunkyButton variant={x.saved ? "primary" : "white"} className="px-3 py-2 text-xs"
                onClick={() => toggle.mutate({ id: x.id, saved: !!x.saved })}>{x.saved ? t("terms.saved") : t("terms.save")}</ChunkyButton>
            </div>
            {x.definition && <p className="mt-2 text-sm">{pick(x.definition, lang)}</p>}
          </li>))}</ul>
      </QueryState>
    </Sheet>
  );
}

export function DoubtSheet({ open, lessonId, onClose }: { open: boolean; lessonId?: string; onClose: () => void }) {
  const { t } = useT();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const history = useQuery({ queryKey: ["doubts"], enabled: open, queryFn: () => api<Doubt[]>("/doubts") });
  const ask = useMutation({
    mutationFn: () => api<Doubt>("/doubts", { json: { text, lesson_id: lessonId } }),
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["doubts"] }); },
  });
  return (
    <Sheet open={open} onClose={onClose} title={t("doubt.title")}>
      <p className="mb-3 text-xs text-muted">{t("doubt.private")}</p>
      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim().length > 1) ask.mutate(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("doubt.placeholder")} aria-label={t("doubt.placeholder")}
          className="flex-1 rounded-[12px] border-2 border-line px-3 py-2 outline-none focus:border-sky" maxLength={500} />
        <ChunkyButton type="submit" variant="sky" disabled={ask.isPending || text.trim().length < 2}>{t("doubt.send")}</ChunkyButton>
      </form>
      {ask.error && <p role="alert" className="mb-3 font-bold text-coral">{(ask.error as Error).message}</p>}
      <QueryState loading={history.isLoading} error={history.error} empty={history.data?.length === 0} emptyText={t("doubt.placeholder")}>
        <ul className="space-y-4">{history.data?.map((d) => (
          <li key={d.id} className="space-y-2">
            <p className="ml-auto w-fit max-w-[85%] rounded-[12px] bg-sky px-3 py-2 font-bold text-white">{d.text}</p>
            <div className="flex items-start gap-2"><GoluMascot size={44} mood="think" />
              <SpeechBubble className="flex-1"><p>{d.answer}</p>
                {d.citation && <div className="mt-2"><SourceChip label={t("doubt.fromNotes", {
                  src: d.citation.page ? `p. ${d.citation.page}` : [d.citation.course, d.citation.term].filter(Boolean).join(" · ") })} /></div>}
              </SpeechBubble></div>
          </li>))}</ul>
      </QueryState>
    </Sheet>
  );
}
