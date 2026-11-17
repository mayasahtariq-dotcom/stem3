import { extractJoinKey, formatJoinKey, joinKeySchema, nameSchema, otpSchema, phoneSchema, toE164 } from "./validation";

describe("phone validation", () => {
  it.each(["9876543210", "98765 43210", "98765-43210", "6000000000"])("accepts %s", (v) => {
    expect(phoneSchema.safeParse(v).success).toBe(true);
  });
  it.each(["", "12345", "5876543210", "98765432101", "98765abcde"])("rejects %s", (v) => {
    expect(phoneSchema.safeParse(v).success).toBe(false);
  });
  it("builds E.164 with +91", () => expect(toE164("9876543210")).toBe("+919876543210"));
});

describe("OTP validation", () => {
  it("needs exactly six digits", () => {
    expect(otpSchema.safeParse("123456").success).toBe(true);
    expect(otpSchema.safeParse("12345").success).toBe(false);
    expect(otpSchema.safeParse("12a456").success).toBe(false);
  });
});

describe("join keys", () => {
  it("formats as XXXX-XXXX while typing", () => {
    expect(formatJoinKey("bi09")).toBe("BI09");
    expect(formatJoinKey("bi09k")).toBe("BI09-K");
    expect(formatJoinKey("bi09-k4x2-extra")).toBe("BI09-K4X2");
  });
  it("accepts valid keys and rejects confusable characters", () => {
    expect(joinKeySchema.safeParse("bi09k4x2").success).toBe(true);
    expect(joinKeySchema.safeParse("BI09-K4O2").success).toBe(false); // O
    expect(joinKeySchema.safeParse("BI09-K412").success).toBe(false); // 1
    expect(joinKeySchema.safeParse("XX09-K4X2").success).toBe(false); // subject
    expect(joinKeySchema.safeParse("BI05-K4X2").success).toBe(false); // grade
  });
  it("extracts a key from a scanned link", () => {
    expect(extractJoinKey("https://mooshala.example/join/BI09-K4X2")).toBe("BI09-K4X2");
    expect(extractJoinKey("stemtutor://join/ch10knda")).toBe("CH10-KNDA");
    expect(extractJoinKey("hello")).toBeNull();
  });
});

describe("names", () => {
  it("trims and collapses spaces, and rejects blank or long names", () => {
    expect(nameSchema.parse("  Asha   Rao ")).toBe("Asha Rao");
    expect(nameSchema.safeParse("   ").success).toBe(false);
    expect(nameSchema.safeParse("x".repeat(61)).success).toBe(false);
  });
});
