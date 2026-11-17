import { cn } from "@/lib/utils/cn";
import { STICKER_ICONS, type StickerIconName } from "./art.generated";

export type { StickerIconName };
export const STICKER_ICON_NAMES = Object.keys(STICKER_ICONS) as StickerIconName[];

export interface StickerIconProps {
  name: StickerIconName;
  size?: number;
  /** Accessible label. Omit for decorative icons next to visible text. */
  label?: string;
  className?: string;
}

/**
 * Hand-drawn sticker icon from the Mooshala prototype (brown outline, white
 * sticker edge). Icons are illustrations, never emoji.
 */
export function StickerIcon({ name, size = 24, label, className }: StickerIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn("inline-block shrink-0 [filter:drop-shadow(0_0_1px_#fff)_drop-shadow(0_1px_0_rgb(90_61_46/0.25))]", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      // Static, generated art from our own design file (no user input).
      dangerouslySetInnerHTML={{ __html: STICKER_ICONS[name] }}
    />
  );
}
