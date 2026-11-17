"use client";
import { StickerIcon, type StickerIconName } from "@/components/ui";
import type { Role } from "@/features/auth/types";
import { useBilingual } from "@/lib/i18n/use-bilingual";
import { cn } from "@/lib/utils/cn";

const STYLE: Record<Role, { icon: StickerIconName; cls: string }> = {
  student: { icon: "backpack", cls: "border-grass-strong bg-grass/20" },
  teacher: { icon: "teacher", cls: "border-sky-strong bg-sky-soft" },
  parent: { icon: "people", cls: "border-coral-strong bg-coral/15" },
};

/** Always-visible badge saying which mode the user is in: Student, Teacher or Parent. */
export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  const r = useBilingual("role");
  const label = r(role);
  const s = STYLE[role];
  return (
    <span
      data-testid="role-badge"
      data-role={role}
      aria-label={label.english}
      className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-full border-2 px-3 text-sm font-bold text-ink", s.cls, className)}
    >
      <StickerIcon name={s.icon} size={20} />
      <span className="font-regional">{label.regional}</span>
      <span className="hidden font-medium tablet:inline" lang="en">
        {label.english}
      </span>
    </span>
  );
}
