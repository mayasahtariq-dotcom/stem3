import { http, HttpResponse } from "msw";
import { FAKE_API_BASE_URL } from "@/lib/env";
import { server } from "@/mocks/node";
import { buildApiClient, unwrap } from "./client";
import { ApiError, asApiError, toApiError } from "./errors";

const api = (token: string | null = "fake-token-919876543210") => buildApiClient(() => token, FAKE_API_BASE_URL);

describe("API client", () => {
  it("attaches the bearer token and returns typed data", async () => {
    const me = unwrap(await api().GET("/me"));
    expect(me).toMatchObject({ name: "Asha", roles: ["student"], registered: true });
  });

  it("turns the backend's error code into an ApiError", async () => {
    await expect(api().GET("/classrooms/preview/{key}", { params: { path: { key: "BI09-XPRD" } } })).rejects.toMatchObject({
      code: "KEY_EXPIRED",
      status: 410,
    });
  });

  it("maps a missing token to UNAUTHORIZED", async () => {
    await expect(api(null).GET("/me")).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
  });

  it("maps a network failure to NETWORK (retryable)", async () => {
    server.use(http.get(`${FAKE_API_BASE_URL}/me`, () => HttpResponse.error()));
    const err = await api().GET("/me").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("NETWORK");
    expect(err.retryable).toBe(true);
  });

  it("maps 5xx without a code to SERVER", async () => {
    server.use(http.get(`${FAKE_API_BASE_URL}/me`, () => new HttpResponse("boom", { status: 502 })));
    await expect(api().GET("/me")).rejects.toMatchObject({ code: "SERVER", status: 502 });
  });
});

describe("error mapping", () => {
  it("falls back by status for unknown codes", () => {
    expect(toApiError(429, null).code).toBe("TOO_MANY_ATTEMPTS");
    expect(toApiError(422, { detail: [{ msg: "x" }] }).code).toBe("VALIDATION");
    expect(toApiError(418, { detail: { code: "TEAPOT" } }).code).toBe("UNKNOWN");
  });
  it("never retries 4xx", () => {
    expect(new ApiError("KEY_NOT_FOUND", 404).retryable).toBe(false);
  });
  it("wraps arbitrary throwables", () => {
    expect(asApiError(new TypeError("Failed to fetch")).code).toBe("NETWORK");
    expect(asApiError("weird").code).toBe("UNKNOWN");
  });
});
