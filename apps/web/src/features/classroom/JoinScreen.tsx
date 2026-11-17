"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import type { Schemas } from "@mooshala/api-client";
import { BilingualText, ChunkyButton, ErrorState, LoadingState, StickerIcon, TextField } from "@/components/ui";
import { toast } from "@/components/ui/Toast";
import { HOME_BY_ROLE } from "@/features/auth/routing";
import { extractJoinKey, formatJoinKey, joinKeySchema } from "@/features/auth/validation";
import { AuthFrame } from "@/features/onboarding/AuthFrame";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { useClassPreview, useJoinClass } from "./api";
import { canScanQr, createQrDetector } from "./qr";

/** View-model: key entry, preview (with the backend's join errors), join. */
export function useJoinScreen(initialKey?: string) {
  const router = useRouter();
  const t = useBilingual("join");
  const [input, setInput] = useState(initialKey ? formatJoinKey(initialKey) : "");
  const [keyError, setKeyError] = useState<string | null>(null);
  const [lookupKey, setLookupKey] = useState<string | null>(() => {
    const p = joinKeySchema.safeParse(initialKey ?? "");
    return p.success ? p.data : null;
  });
  const preview = useClassPreview(lookupKey);
  const join = useJoinClass();

  return {
    input,
    keyError,
    preview,
    join,
    setInput: (v: string) => {
      setInput(formatJoinKey(v));
      setKeyError(null);
      setLookupKey(null);
    },
    find: (raw = input) => {
      const p = joinKeySchema.safeParse(raw);
      if (!p.success) return setKeyError("invalid_key");
      setInput(p.data);
      setLookupKey(p.data);
    },
    onScanned: (text: string) => {
      const key = extractJoinKey(text);
      if (!key) return setKeyError("invalid_key");
      setInput(key);
      setLookupKey(key);
    },
    confirm: async () => {
      if (!lookupKey) return;
      try {
        const c = await join.mutateAsync(lookupKey);
        toast("success", t("joined", { name: c.name }));
        router.replace(HOME_BY_ROLE.student);
      } catch {
        /* rendered from join.error */
      }
    },
    skip: () => router.replace(HOME_BY_ROLE.student),
  };
}

function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const t = useBilingual("join");
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then((s) => {
      if (stopped) return s.getTracks().forEach((tr) => tr.stop());
      stream = s;
      if (!video.current) return;
      video.current.srcObject = s;
      void video.current.play();
      const detector = createQrDetector();
      timer = setInterval(async () => {
        if (!video.current) return;
        const found = await detector.detect(video.current).catch(() => []);
        if (found[0]) onResult(found[0].rawValue);
      }, 400);
    }, onClose);
    return () => {
      stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [onResult, onClose]);
  return (
    <div className="flex flex-col gap-3">
      <video ref={video} muted playsInline className="aspect-square w-full rounded-card bg-ink object-cover" aria-label={t("scanning").english} />
      <BilingualText text={t("scanning")} size="sm" align="center" />
      <ChunkyButton variant="white" onClick={onClose}>
        {t("stopScan").regional}
      </ChunkyButton>
    </div>
  );
}

type JoinVm = ReturnType<typeof useJoinScreen>;
const noSubscribe = () => () => {};

/** Join a class by typed key, link (/join/KEY) or QR code. */
export function JoinScreen({ vm }: { vm: JoinVm }) {
  const t = useBilingual("join");
  const [scanning, setScanning] = useState(false);
  const scanSupported = useSyncExternalStore(noSubscribe, canScanQr, () => false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    vm.find();
  };
  const p: Schemas["ClassroomPreview"] | undefined = vm.preview.data;

  return (
    <AuthFrame title={t("title")} golu={{ pose: "wave", says: t("title") }}>
      {scanning ? (
        <QrScanner
          onResult={(text) => {
            setScanning(false);
            vm.onScanned(text);
          }}
          onClose={() => setScanning(false)}
        />
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <TextField
            label={t("keyLabel")}
            hint={t("keyHint")}
            error={vm.keyError ? t(vm.keyError) : null}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="BI09-K4X2"
            className="uppercase tracking-widest"
            value={vm.input}
            onChange={(e) => vm.setInput(e.target.value)}
          />
          <ChunkyButton type="submit" variant="sky" block loading={vm.preview.isFetching}>
            <BilingualText as="span" align="center" tone="inverse" text={t("find")} />
          </ChunkyButton>
          {scanSupported && (
            <ChunkyButton variant="white" block onClick={() => setScanning(true)}>
              <StickerIcon name="camera" size={22} />
              <BilingualText as="span" text={t("scan")} size="sm" />
            </ChunkyButton>
          )}
        </form>
      )}

      {vm.preview.isFetching && <LoadingState />}
      {vm.preview.isError && <ErrorState error={vm.preview.error} />}
      {p && !vm.preview.isFetching && (
        <div className="flex flex-col gap-3 rounded-card border-2 border-grass-strong bg-white p-4" data-testid="class-preview">
          <div className="flex items-center gap-3">
            <StickerIcon name="school" size={40} />
            <div className="flex flex-col">
              <span className="text-lg font-bold">{p.name}</span>
              <span className="text-sm text-stone">{t("teacher", { name: p.teacher_name }).regional}</span>
              <span className="text-sm text-stone">{t("students", { count: p.student_count }).regional}</span>
            </div>
          </div>
          {vm.join.isError && <ErrorState error={vm.join.error} />}
          <ChunkyButton size="lg" block onClick={vm.confirm} loading={vm.join.isPending}>
            <BilingualText as="span" align="center" tone="inverse" text={t("join")} />
          </ChunkyButton>
        </div>
      )}
      <ChunkyButton variant="ghost" onClick={vm.skip}>
        {t("skip").regional} · <span lang="en">{t("skip").english}</span>
      </ChunkyButton>
    </AuthFrame>
  );
}
