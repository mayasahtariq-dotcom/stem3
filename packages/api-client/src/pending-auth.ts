/**
 * Auth endpoints documented in the Mooshala Web PRD (section 8: "POST /auth/otp,
 * POST /auth/verify, POST /auth/class-key") that the FastAPI backend does not
 * implement yet, so they are absent from openapi/backend.json.
 *
 * - Phone OTP is served today by Supabase Auth (the backend verifies Supabase
 *   JWTs; see backend/app/auth.py), so the web app uses Supabase for OTP, just
 *   like the Android app. /auth/otp and /auth/verify are therefore not called.
 * - Class key + name login (shared school computers) has no implementation
 *   anywhere yet. The PRD names the path but not the payloads. The shapes below
 *   are the web app's ASSUMPTION, logged in docs/decisions.md, and must be
 *   replaced by the generated types once the backend publishes the endpoint.
 */

export interface ClassKeyLoginRequest {
  class_key: string; // XXXX-XXXX, see the join key format in docs/PRD.md (M1)
  name: string;
}

export interface ClassKeyLoginResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number; // seconds
}

export const CLASS_KEY_LOGIN_PATH = "/auth/class-key" as const;
