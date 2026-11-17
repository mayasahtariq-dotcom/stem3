"use client";
import type { ReactNode } from "react";
import { useBilingual, type BilingualString } from "@/lib/i18n/use-bilingual";
import { asApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils/cn";
import { BilingualText } from "./BilingualText";
import { ChunkyButton } from "./ChunkyButton";
import { GoluMascot, type CowPose } from "./GoluMascot";
import { SpeechBubble } from "./SpeechBubble";

interface StateFrameProps {
  pose: CowPose;
  message: BilingualString;
  action?: ReactNode;
  role?: "status" | "alert";
  className?: string;
}

function StateFrame({ pose, message, action, role = "status", className }: StateFrameProps) {
  return (
    <div role={role} className={cn("flex flex-col items-center justify-center gap-5 p-6 text-center", className)}>
      <SpeechBubble className="max-w-sm">
        <BilingualText text={message} align="center" />
      </SpeechBubble>
      <GoluMascot pose={pose} size={110} />
      {action}
    </div>
  );
}

/** Loading: Golu thinking. Never a blank screen. */
export function LoadingState({ message, className }: { message?: BilingualString; className?: string }) {
  const t = useBilingual("common");
  return <StateFrame pose="question" message={message ?? t("loading")} className={className} />;
}

/** Empty: Golu napping, with an optional call to action. */
export function EmptyState({ message, action, className }: { message: BilingualString; action?: ReactNode; className?: string }) {
  return <StateFrame pose="sleep" message={message} action={action} className={className} />;
}

/** Error: maps an ApiError code to a bilingual message, with a retry. */
export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const t = useBilingual("errors");
  const c = useBilingual("common");
  return (
    <StateFrame
      role="alert"
      pose="sad"
      message={t(asApiError(error).code)}
      className={className}
      action={
        onRetry && (
          <ChunkyButton variant="white" onClick={onRetry}>
            <BilingualText as="span" text={c("retry")} size="sm" align="center" />
          </ChunkyButton>
        )
      }
    />
  );
}
