"use client";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Schemas } from "@mooshala/api-client";
import { toast } from "@/components/ui";
import { useSpeak } from "@/features/learning/use-speak";
import { asApiError } from "@/lib/api/errors";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { isFullCode, normalizeCode, useApproveConsent, useChildDashboard, useChildren, useLinkChild, useLinkPreview, useRequestDeletion, useRevokeConsent, useUnlinkChild } from "./api";
import { ChildScreen } from "./ChildScreen";
import { ParentHomeScreen } from "./ParentHomeScreen";

export function ParentHomeRoute() {
  const t = useBilingual("parent");
  const router = useRouter();
  const children = useChildren();
  const [code, setCode] = useState("");
  const full = isFullCode(code) ? code : null;
  const preview = useLinkPreview(full);
  const link = useLinkChild();
  return (
    <ParentHomeScreen
      kids={children.data}
      loading={children.isLoading}
      error={children.error}
      code={code}
      preview={full ? preview.data : undefined}
      previewLoading={Boolean(full) && preview.isLoading}
      previewError={full ? preview.error : null}
      linking={link.isPending}
      linkError={link.error}
      onCode={(raw) => {
        link.reset();
        setCode(normalizeCode(raw));
      }}
      onLink={() => {
        if (!full || link.isPending) return;
        link.mutate(full, {
          onSuccess: (child) => {
            toast("success", t("linked", { name: child.name }));
            setCode("");
            router.push(`/parent/child/${child.id}`);
          },
        });
      }}
      onCancelLink={() => setCode("")}
      onRetry={() => void children.refetch()}
    />
  );
}

export function ChildRoute({ childId }: { childId: string }) {
  const t = useBilingual("parent");
  const errors = useBilingual("errors");
  const router = useRouter();
  const locale = useLocale();
  const dash = useChildDashboard(childId);
  const approve = useApproveConsent();
  const revoke = useRevokeConsent();
  const unlink = useUnlinkChild();
  const deletion = useRequestDeletion();
  const { speak, speaking } = useSpeak();
  const [deleted, setDeleted] = useState<Schemas["DeletionOut"] | null>(null);
  const onError = (e: unknown) => toast("error", errors(asApiError(e).code));
  return (
    <ChildScreen
      data={dash.data}
      loading={dash.isLoading}
      error={dash.error}
      consentBusy={approve.isPending || revoke.isPending}
      removing={unlink.isPending}
      deletion={deleted}
      speaking={speaking}
      onApprove={() => !approve.isPending && approve.mutate(childId, { onSuccess: () => toast("success", t("approved")), onError })}
      onRevoke={() => !revoke.isPending && revoke.mutate(childId, { onSuccess: () => toast("info", t("revoked")), onError })}
      onUnlink={() =>
        unlink.mutate(childId, {
          onSuccess: () => {
            toast("info", t("unlinked"));
            router.push("/parent");
          },
          onError,
        })
      }
      onDelete={() => !deletion.isPending && deletion.mutate(childId, { onSuccess: (out) => setDeleted(out), onError })}
      onListen={(text) => void speak(text)}
      onRetry={() => void dash.refetch()}
      formatDate={(iso) => new Intl.DateTimeFormat(locale === "kn" ? "kn-IN" : "hi-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso))}
    />
  );
}
