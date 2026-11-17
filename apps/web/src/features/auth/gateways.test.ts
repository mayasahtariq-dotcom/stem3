import { http, HttpResponse } from "msw";
import { FAKE_API_BASE_URL } from "@/lib/env";
import { server } from "@/mocks/node";
import { postClassKeyLogin } from "./class-key";
import { FAKE_RATE_LIMITED_PHONE, FakeAuthGateway } from "./fake-gateway";
import { memoryStorage } from "./storage";
import { mapSupabaseError } from "./supabase-gateway";

describe("FakeAuthGateway", () => {
  const make = () => {
    const local = memoryStorage();
    const session = memoryStorage();
    return { gw: new FakeAuthGateway(local, 0, session), local, session };
  };

  it("signs in with 123456 and restores the session", async () => {
    const { gw, local } = make();
    await gw.requestOtp("+919876543210");
    const s = await gw.verifyOtp("+919876543210", "123456");
    expect(s.method).toBe("phone");
    const again = new FakeAuthGateway(local, 0, memoryStorage());
    expect((await again.restore())?.accessToken).toBe(s.accessToken);
  });

  it("rejects wrong and expired codes with distinct errors", async () => {
    const { gw } = make();
    await expect(gw.verifyOtp("+919876543210", "111111")).rejects.toMatchObject({ code: "invalid_code" });
    await expect(gw.verifyOtp("+919876543210", "000000")).rejects.toMatchObject({ code: "code_expired" });
    await expect(gw.requestOtp(FAKE_RATE_LIMITED_PHONE)).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("keeps class-key sessions in session storage and signs out of both", async () => {
    const { gw, local, session } = make();
    const s = await gw.loginWithClassKey("BI09-K4X2", "Ravi");
    expect(s.method).toBe("class-key");
    expect(session.get("mooshala.fake-session")).toBeTruthy();
    expect(local.get("mooshala.fake-session")).toBeNull();
    await gw.signOut();
    expect(await gw.restore()).toBeNull();
  });

  it("drops expired stored sessions", async () => {
    const { gw, local } = make();
    local.set("mooshala.fake-session", JSON.stringify({ accessToken: "x", method: "phone", expiresAt: Date.now() - 1 }));
    expect(await gw.restore()).toBeNull();
  });
});

describe("class-key login (POST /auth/class-key)", () => {
  it("maps unknown keys", async () => {
    await expect(postClassKeyLogin("CH09-ZZZZ", "Asha", FAKE_API_BASE_URL)).rejects.toMatchObject({ code: "class_key_not_found" });
  });
  it("reports 'unavailable' when the backend lacks the route, never a fake success", async () => {
    server.use(http.post(`${FAKE_API_BASE_URL}/auth/class-key`, () => HttpResponse.json({ detail: "Not Found" }, { status: 404 })));
    await expect(postClassKeyLogin("BI09-K4X2", "Asha", FAKE_API_BASE_URL)).rejects.toMatchObject({ code: "unavailable" });
  });
  it("maps network failures", async () => {
    server.use(http.post(`${FAKE_API_BASE_URL}/auth/class-key`, () => HttpResponse.error()));
    await expect(postClassKeyLogin("BI09-K4X2", "Asha", FAKE_API_BASE_URL)).rejects.toMatchObject({ code: "network" });
  });
});

describe("Supabase error mapping", () => {
  it.each([
    [{ code: "otp_expired", status: 403 }, "code_expired"],
    [{ code: "invalid_credentials", status: 400 }, "invalid_code"],
    [{ code: "over_sms_send_rate_limit", status: 429 }, "rate_limited"],
    [{ status: 429 }, "rate_limited"],
    [{ message: "Failed to fetch" }, "network"],
    [{ code: "something_new", status: 500 }, "unknown"],
  ])("%o -> %s", (err, code) => {
    expect(mapSupabaseError(err).code).toBe(code);
  });
});
