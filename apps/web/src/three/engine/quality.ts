/**
 * Render quality tiers. School PCs (4 GB, integrated GPU) and budget phones get
 * the low tier: lower pixel ratio, smaller or no shadow maps, fewer props.
 * Pure function of device hints so it is unit-tested; <PerformanceMonitor>
 * can still step down at runtime.
 */
export type QualityTier = "low" | "medium" | "high";

export interface QualitySettings {
  tier: QualityTier;
  dpr: [number, number];
  antialias: boolean;
  shadows: boolean;
  shadowMapSize: number;
  /** Multiplier for decorative instance counts (grass tufts, flowers). */
  detail: number;
}

export const QUALITY: Record<QualityTier, QualitySettings> = {
  low: { tier: "low", dpr: [1, 1], antialias: false, shadows: false, shadowMapSize: 512, detail: 0.4 },
  medium: { tier: "medium", dpr: [1, 1.5], antialias: true, shadows: true, shadowMapSize: 1024, detail: 0.7 },
  high: { tier: "high", dpr: [1, 2], antialias: true, shadows: true, shadowMapSize: 2048, detail: 1 },
};

export interface DeviceHints {
  /** navigator.deviceMemory in GB (Chromium only). */
  memoryGb?: number;
  cores?: number;
  /** Coarse pointer and narrow screen: probably a phone. */
  mobile?: boolean;
  saveData?: boolean;
}

export function pickQuality(h: DeviceHints): QualitySettings {
  if (h.saveData) return QUALITY.low;
  if ((h.memoryGb !== undefined && h.memoryGb <= 4) || (h.cores !== undefined && h.cores <= 4)) return QUALITY.low;
  if (h.mobile) return QUALITY.medium;
  if ((h.memoryGb ?? 8) >= 8 && (h.cores ?? 8) >= 8) return QUALITY.high;
  return QUALITY.medium;
}

export function readDeviceHints(): DeviceHints {
  if (typeof navigator === "undefined") return {};
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return {
    memoryGb: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
    mobile: typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches && window.innerWidth < 768,
    saveData: nav.connection?.saveData,
  };
}
