import type { Role } from "./types";

/**
 * Sample accounts in the built-in fake backend, one per mode. With fakes on,
 * picking a mode on "Who are you?" signs straight into that mode's sample
 * account (no phone step). Real mode always uses phone OTP.
 */
export const DEMO_PHONES: Record<Role, string> = { student: "9876543210", teacher: "9876500001", parent: "9876500002" };
/** The fake gateway accepts any 6-digit code. */
export const DEMO_CODE = "123456";
