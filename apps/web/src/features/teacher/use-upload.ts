"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useReducer, useRef } from "react";
import type { Schemas } from "@mooshala/api-client";
import { unwrap } from "@/lib/api/client";
import { putFile } from "@/lib/api/put-file";
import { queryKeys } from "@/lib/api/query-keys";
import { useServices } from "@/lib/services";
import { allPagesDone, initialRun, runReducer, type PageDraft, type UploadMeta } from "./upload";

/** Poll interval while the AI pipeline works. */
export const POLL_MS = 1000;

/**
 * Runs an upload: POST /uploads, PUT each page to its signed link (with
 * progress and per-page retry), POST /uploads/{id}/start, then polls
 * GET /uploads/{id} until the pipeline is ready or fails.
 */
export function useUpload() {
  const { api } = useServices();
  const qc = useQueryClient();
  const [run, dispatch] = useReducer(runReducer, initialRun);
  const targets = useRef<Schemas["PageTarget"][]>([]);
  const files = useRef<PageDraft[]>([]);

  const sendPage = useCallback(async (index: number) => {
    const target = targets.current[index];
    const page = files.current[index];
    if (!target?.upload_url || !page?.file) return;
    dispatch({ type: "pageProgress", index, progress: 0 });
    try {
      await putFile(target.upload_url, page.file, target.headers ?? {}, (f) => dispatch({ type: "pageProgress", index, progress: f }), target.method || "PUT");
      dispatch({ type: "pageDone", index });
    } catch {
      dispatch({ type: "pageFailed", index });
    }
  }, []);

  const submit = useCallback(
    async (pages: PageDraft[], meta: UploadMeta) => {
      files.current = pages;
      dispatch({ type: "create", pageCount: pages.length });
      let created: Schemas["UploadCreated"];
      try {
        created = unwrap(
          await api.POST("/uploads", {
            body: {
              // file_name is a requested addition to PageIn (backend-handoff.md): the materials list shows it.
              pages: pages.map((p) => ({ ...(p.kind === "text" ? { kind: "text" as const, text: p.text ?? "" } : { kind: p.kind, size_bytes: p.size }), file_name: p.name })),
              subject: meta.subject,
              grade: meta.grade,
              classroom_id: meta.classroomId,
              personal: !meta.classroomId,
            },
          }),
        );
      } catch (e) {
        dispatch({ type: "createFailed", error: e });
        return;
      }
      targets.current = created.pages;
      dispatch({ type: "created", uploadId: created.id, textPages: pages.map((p, i) => (p.kind === "text" ? i : -1)).filter((i) => i >= 0) });
      // Pages go one at a time: phone networks in the pilot schools are slow.
      for (let i = 0; i < pages.length; i++) if (pages[i]!.kind !== "text") await sendPage(i);
    },
    [api, sendPage],
  );

  const start = useCallback(async () => {
    if (!run.uploadId) return;
    dispatch({ type: "start" });
    try {
      const s = unwrap(await api.POST("/uploads/{upload_id}/start", { params: { path: { upload_id: run.uploadId } } }));
      dispatch({ type: "status", status: s });
    } catch (e) {
      dispatch({ type: "startFailed", error: e });
    }
  }, [api, run.uploadId]);

  // Start the pipeline once every page is stored.
  const ready = run.phase === "uploading" && allPagesDone(run) && !run.error;
  useEffect(() => {
    if (ready) void start();
  }, [ready, start]);

  const status = useQuery({
    queryKey: queryKeys.teacher.upload(run.uploadId ?? ""),
    enabled: run.phase === "processing" && Boolean(run.uploadId),
    refetchInterval: POLL_MS,
    queryFn: async () => unwrap(await api.GET("/uploads/{upload_id}", { params: { path: { upload_id: run.uploadId! } } })),
  });
  useEffect(() => {
    if (status.data && run.phase === "processing") {
      dispatch({ type: "status", status: status.data });
      if (status.data.status === "ready") void qc.invalidateQueries({ queryKey: queryKeys.teacher.courses });
    }
  }, [status.data, run.phase, qc]);

  return {
    run,
    pollError: run.phase === "processing" ? status.error : null,
    submit,
    retryPage: sendPage,
    retryStart: start,
    reset: () => dispatch({ type: "reset" }),
  };
}
