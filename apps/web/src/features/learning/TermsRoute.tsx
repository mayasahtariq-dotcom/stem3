"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/ui";
import { asApiError } from "@/lib/api/errors";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useHome, useTerms, useToggleSavedTerm } from "./api";
import { TermsScreen } from "./TermsScreen";
import { useSpeak } from "./use-speak";

export function TermsRoute() {
  const params = useSearchParams();
  const router = useRouter();
  const errors = useBilingual("errors");
  const home = useHome();
  const courseId = params.get("course") ?? home.data?.continue_lesson?.course_id ?? home.data?.courses[0]?.id ?? null;
  const terms = useTerms(courseId);
  const toggle = useToggleSavedTerm(courseId ?? "");
  const { speak } = useSpeak();
  const [query, setQuery] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(params.get("term"));
  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-sky-soft to-cream">
      <TermsScreen
        terms={terms.data}
        loading={terms.isLoading || home.isLoading}
        error={terms.error ?? home.error}
        noCourse={Boolean(home.data && !courseId)}
        query={query}
        savedOnly={savedOnly}
        openKey={openKey}
        onQuery={setQuery}
        onSavedOnly={setSavedOnly}
        onOpen={setOpenKey}
        onToggleSave={(term, save) => toggle.mutate({ term, save }, { onError: (e) => toast("error", errors(asApiError(e).code)) })}
        onAsk={(term) => router.push(`/farm/ask?course=${encodeURIComponent(courseId ?? "")}&term=${encodeURIComponent(term)}`)}
        onSpeak={(text) => void speak(text)}
        onRetry={() => void (home.error ? home.refetch() : terms.refetch())}
      />
    </div>
  );
}
