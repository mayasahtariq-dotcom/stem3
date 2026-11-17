"use client";
import { useState } from "react";
import { toast } from "@/components/ui";
import { asApiError } from "@/lib/api/errors";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useBadges, useClaimQuest, useGameStats, useLeague, useQuests } from "./api";
import { GrowthAndBadges } from "./GrowthAndBadges";
import { LeagueScreen } from "./LeagueScreen";
import { QuestsScreen } from "./QuestsScreen";

const useNow = () => useState(() => Date.now())[0];

export function QuestsRoute() {
  const t = useBilingual("game");
  const errors = useBilingual("errors");
  const quests = useQuests();
  const claim = useClaimQuest();
  const now = useNow();
  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-sky-soft to-cream">
      <QuestsScreen
        quests={quests.data}
        loading={quests.isLoading}
        error={quests.error}
        claimingId={claim.isPending ? claim.variables : null}
        now={now}
        onClaim={(id) => {
          if (claim.isPending) return;
          claim.mutate(id, { onSuccess: (out) => toast("success", t("claimedToast", { n: out.quest.reward_gems })), onError: (e) => toast("error", errors(asApiError(e).code)) });
        }}
        onRetry={() => void quests.refetch()}
      />
    </div>
  );
}

export function LeagueRoute() {
  const league = useLeague();
  const now = useNow();
  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-sky-soft to-cream">
      <LeagueScreen league={league.data} loading={league.isLoading} error={league.error} now={now} onRetry={() => void league.refetch()} />
    </div>
  );
}

/** Profile additions: Golu's growth and the badge shelf. */
export function GrowthAndBadgesRoute() {
  const game = useGameStats();
  const badges = useBadges();
  return <GrowthAndBadges game={game.data} badges={badges.data} badgesError={badges.error} />;
}
