"use client";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor, useProgress } from "@react-three/drei";
import { Component, Suspense, useEffect, useReducer, useState, type ReactNode } from "react";
import { CAMERA } from "../config/camera";
import { LIGHTING } from "../config/lighting";
import type { QualitySettings } from "./quality";
import { initialSceneState, sceneReducer, type SceneStatus } from "./scene-status";
import { isWebGLAvailable } from "./webgl";

class CanvasBoundary extends Component<{ onError: (e: unknown) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Fires once its Suspense parent has resolved, i.e. the scene's required assets are in. */
function ReadySignal({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}

export interface SceneOverlays {
  loading: (progress: number) => ReactNode;
  error: (retry: () => void) => ReactNode;
  unsupported: () => ReactNode;
}

export interface SceneContainerProps {
  quality: QualitySettings;
  overlays: SceneOverlays;
  /** Accessible description of the canvas for screen readers. */
  label: string;
  onStatusChange?: (status: SceneStatus) => void;
  onError?: (error: unknown) => void;
  /** Injected for tests; defaults to a real WebGL probe. */
  webglAvailable?: () => boolean;
  children: ReactNode;
}

/**
 * Reusable 3D scene host: probes WebGL, owns the renderer lifecycle (create,
 * context loss and restore, retry by remount, disposal on unmount), applies
 * camera/lighting/quality config, and always shows a loading, error or
 * unsupported state instead of a blank canvas. Scenes are passed as children.
 */
export function SceneContainer({ quality, overlays, label, onStatusChange, onError, webglAvailable = isWebGLAvailable, children }: SceneContainerProps) {
  const [state, dispatch] = useReducer(sceneReducer, initialSceneState);
  const [dpr, setDpr] = useState<number>(quality.dpr[1]);
  const { active, progress } = useProgress();

  useEffect(() => {
    dispatch({ type: "webgl", available: webglAvailable() });
  }, [webglAvailable]);

  useEffect(() => {
    onStatusChange?.(state.status);
  }, [state.status, onStatusChange]);

  const fail = (error: unknown) => {
    onError?.(error);
    dispatch({ type: "failed", error });
  };

  const showCanvas = state.status === "loading" || state.status === "ready";

  return (
    <div className="relative h-full w-full" data-scene-status={state.status}>
      {showCanvas && (
        <CanvasBoundary key={state.attempt} onError={fail}>
          <Canvas
            role="img"
            aria-label={label}
            shadows={quality.shadows ? "soft" : false}
            dpr={dpr}
            gl={{ antialias: quality.antialias, powerPreference: "high-performance", preserveDrawingBuffer: false }}
            camera={{ fov: CAMERA.fov, near: CAMERA.near, far: CAMERA.far, position: CAMERA.position }}
            onCreated={({ gl }) => {
              const el = gl.domElement;
              el.addEventListener("webglcontextlost", (e) => {
                e.preventDefault(); // allow the browser to restore it
                dispatch({ type: "contextLost" });
              });
              el.addEventListener("webglcontextrestored", () => dispatch({ type: "contextRestored" }));
            }}
          >
            <color attach="background" args={[LIGHTING.background]} />
            <fog attach="fog" args={[LIGHTING.fog.color, LIGHTING.fog.near, LIGHTING.fog.far]} />
            <PerformanceMonitor onDecline={() => setDpr(quality.dpr[0])} onIncline={() => setDpr(quality.dpr[1])} />
            <Suspense fallback={null}>
              {children}
              <ReadySignal onReady={() => dispatch({ type: "assetsLoaded" })} />
            </Suspense>
          </Canvas>
        </CanvasBoundary>
      )}
      {(state.status === "checking" || (state.status === "loading" && active)) && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">{overlays.loading(progress)}</div>
      )}
      {(state.status === "error" || state.status === "contextLost") && (
        <div className="absolute inset-0 grid place-items-center bg-cream/80">{overlays.error(() => dispatch({ type: "retry" }))}</div>
      )}
      {state.status === "unsupported" && <div className="absolute inset-0">{overlays.unsupported()}</div>}
    </div>
  );
}
