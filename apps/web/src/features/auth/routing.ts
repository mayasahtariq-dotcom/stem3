import type { Profile, Role } from "./types";

export const HOME_BY_ROLE: Record<Role, string> = {
  student: "/farm",
  teacher: "/teacher",
  parent: "/parent",
};

export const ROUTES = {
  language: "/language",
  role: "/role",
  login: "/login",
  schoolLogin: "/login/school",
  name: "/welcome",
  join: "/join",
} as const;

/** Which role to open: the last one used on this device if the user still holds it. */
export function pickRole(profile: Pick<Profile, "roles">, preferred: Role | null): Role | null {
  if (preferred && profile.roles.includes(preferred)) return preferred;
  return profile.roles[0] ?? null;
}

/** Where a signed-in user goes next. Pure, so it is unit-tested. */
export function nextRouteFor(profile: Profile, preferred: Role | null): string {
  if (!profile.registered || !profile.name) return ROUTES.name;
  const role = pickRole(profile, preferred);
  return role ? HOME_BY_ROLE[role] : ROUTES.role;
}

/** Route groups and the role each requires. */
export function requiredRoleFor(pathname: string): Role | null {
  if (pathname === "/farm" || pathname.startsWith("/farm/")) return "student";
  if (pathname === "/teacher" || pathname.startsWith("/teacher/")) return "teacher";
  if (pathname === "/parent" || pathname.startsWith("/parent/")) return "parent";
  return null;
}
