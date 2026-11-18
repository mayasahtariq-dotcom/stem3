"use client";
import { DEMO_CODE, DEMO_PHONES } from "@/features/auth/demo";
import { env } from "@/lib/env";
import { PhoneCallScreen } from "./PhoneCallScreen";
import { usePhoneCall } from "./use-phone-call";

/** Live demo student on the hosted backend (docs/DEMO_LOGINS.md); the built-in fake student otherwise. */
const LIVE_DEMO_STUDENT = "6000000101";

export function PhoneCallRoute() {
  const demo = { id: env.useFakes ? DEMO_PHONES.student : LIVE_DEMO_STUDENT, pin: DEMO_CODE };
  const model = usePhoneCall({ demo });
  return <PhoneCallScreen model={model} demoId={demo.id} />;
}
