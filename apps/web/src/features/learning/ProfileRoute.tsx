"use client";
import { useLocale } from "next-intl";
import type { ReactNode } from "react";
import { toast } from "@/components/ui";
import { useProfile } from "@/features/auth/hooks";
import { useGameStats } from "@/features/game/api";
import { asApiError } from "@/lib/api/errors";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useSetDailyGoal, useStats } from "./api";
import { formatClock } from "./LessonRoute";
import { ProfileScreen } from "./ProfileScreen";

export function ProfileRoute({ children }: { children?: ReactNode }) {
  const locale = useLocale();
  const errors = useBilingual("errors");
  const profile = useProfile();
  const stats = useStats();
  const game = useGameStats();
  const goal = useSetDailyGoal();
  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-sky-soft to-cream">
      <ProfileScreen
        name={profile.data?.name ?? ""}
        stats={stats.data}
        statsError={stats.error}
        game={game.data}
        savingGoal={goal.isPending ? (goal.variables ?? null) : null}
        onGoal={(g) => goal.mutate(g, { onError: (e) => toast("error", errors(asApiError(e).code)) })}
        onRetry={() => void stats.refetch()}
        formatTime={(iso) => formatClock(iso, locale)}
      >
        {children}
      </ProfileScreen>
    </div>
  );
}
