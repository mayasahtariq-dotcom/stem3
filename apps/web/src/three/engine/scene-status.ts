/**
 * Scene lifecycle as a small state machine, so every state has UI (loading,
 * unsupported, error, lost context) and the transitions are unit-tested.
 */
export type SceneStatus = "checking" | "unsupported" | "loading" | "ready" | "error" | "contextLost";

export type SceneEvent =
  | { type: "webgl"; available: boolean }
  | { type: "assetsLoaded" }
  | { type: "failed"; error: unknown }
  | { type: "contextLost" }
  | { type: "contextRestored" }
  | { type: "retry" };

export interface SceneState {
  status: SceneStatus;
  error: unknown;
  /** Bumped on retry to remount the <Canvas> and re-request assets. */
  attempt: number;
}

export const initialSceneState: SceneState = { status: "checking", error: null, attempt: 0 };

export function sceneReducer(state: SceneState, event: SceneEvent): SceneState {
  switch (event.type) {
    case "webgl":
      return state.status === "checking" ? { ...state, status: event.available ? "loading" : "unsupported" } : state;
    case "assetsLoaded":
      return state.status === "loading" ? { ...state, status: "ready" } : state;
    case "failed":
      return state.status === "unsupported" ? state : { ...state, status: "error", error: event.error };
    case "contextLost":
      return state.status === "ready" || state.status === "loading" ? { ...state, status: "contextLost" } : state;
    case "contextRestored":
      return state.status === "contextLost" ? { ...state, status: "ready" } : state;
    case "retry":
      return state.status === "error" || state.status === "contextLost"
        ? { status: "loading", error: null, attempt: state.attempt + 1 }
        : state;
  }
}
