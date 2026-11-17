import { z } from "zod";

/** Indian mobile numbers: 10 digits starting 6-9. The +91 prefix is fixed in the UI. */
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "invalid_phone"));

export const otpSchema = z.string().regex(/^\d{6}$/, "invalid_code");

/** Join key alphabet (docs/PRD.md M1): no 0, O, 1, I or L. */
export const KEY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const KEY_RE = /^(BI|CH|PH)(0[6-9]|1[0-2])-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;

/** "bi09k4x2" -> "BI09-K4X2"; partial input gets the dash once it has 5+ characters. */
export function formatJoinKey(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

export const joinKeySchema = z
  .string()
  .transform(formatJoinKey)
  .pipe(z.string().regex(KEY_RE, "invalid_key"));

export const nameSchema = z
  .string()
  .transform((v) => v.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1, "name_required").max(60, "name_too_long"));

export const toE164 = (tenDigits: string) => `+91${tenDigits}`;

/** Pulls a join key out of a scanned QR payload or pasted link (".../join/BI09-K4X2"). */
export function extractJoinKey(text: string): string | null {
  const m = text.toUpperCase().match(/(BI|CH|PH)\d{2}-?[A-Z0-9]{4}/);
  if (!m) return null;
  const parsed = joinKeySchema.safeParse(m[0]);
  return parsed.success ? parsed.data : null;
}
