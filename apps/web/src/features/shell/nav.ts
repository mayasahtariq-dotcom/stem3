import type { StickerIconName } from "@/components/ui";
import type { Role } from "@/features/auth/types";

/**
 * Role-aware navigation config. `phase` marks where a destination is built;
 * entries from later phases render as disabled "coming soon" items so the
 * shell's shape is final now without building their features early.
 */
export interface NavItem {
  key: string;
  /** messages key in the `nav` namespace */
  label: string;
  icon: StickerIconName;
  href: string;
  phase: number;
}

export const CURRENT_PHASE = 5;

export const NAV: Record<Role, NavItem[]> = {
  student: [
    { key: "farm", label: "farm", icon: "home", href: "/farm", phase: 1 },
    { key: "learn", label: "learn", icon: "book", href: "/farm/learn", phase: 2 },
    { key: "notes", label: "notes", icon: "doc", href: "/farm/notes", phase: 3 },
    { key: "quests", label: "quests", icon: "quests", href: "/farm/quests", phase: 4 },
    { key: "league", label: "league", icon: "trophy", href: "/farm/league", phase: 4 },
    { key: "profile", label: "profile", icon: "backpack", href: "/farm/profile", phase: 2 },
  ],
  teacher: [
    { key: "overview", label: "overview", icon: "chart", href: "/teacher", phase: 1 },
    { key: "classes", label: "classes", icon: "school", href: "/teacher/classes", phase: 3 },
    { key: "students", label: "students", icon: "people", href: "/teacher/students", phase: 3 },
    { key: "courses", label: "courses", icon: "books", href: "/teacher/courses", phase: 3 },
    { key: "notes", label: "notes", icon: "doc", href: "/teacher/notes", phase: 3 },
    { key: "calls", label: "calls", icon: "speaker", href: "/teacher/calls", phase: 5 },
  ],
  parent: [{ key: "summary", label: "profile", icon: "people", href: "/parent", phase: 1 }],
};

export const isAvailable = (item: NavItem) => item.phase <= CURRENT_PHASE;
