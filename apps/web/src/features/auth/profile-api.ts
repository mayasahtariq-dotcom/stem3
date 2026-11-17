import type { ApiClient, Schemas } from "@mooshala/api-client";
import { unwrap } from "@/lib/api/client";
import type { LanguageMode, Profile, Role } from "./types";

export const toProfile = (me: Schemas["MeResponse"]): Profile => ({
  id: me.id,
  registered: me.registered ?? false,
  name: me.name ?? null,
  phone: me.phone ?? null,
  roles: (me.roles ?? []) as Role[],
  languageMode: (me.language_mode ?? null) as LanguageMode | null,
});

export async function fetchProfile(api: ApiClient): Promise<Profile> {
  return toProfile(unwrap(await api.GET("/me")));
}

export async function saveProfile(
  api: ApiClient,
  body: { name: string; languageMode: LanguageMode; roles: Role[] },
): Promise<Profile> {
  return toProfile(
    unwrap(await api.PUT("/me", { body: { name: body.name, language_mode: body.languageMode, roles: body.roles } })),
  );
}
