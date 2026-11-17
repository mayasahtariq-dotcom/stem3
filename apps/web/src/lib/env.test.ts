import { readEnv } from "./env";

describe("readEnv", () => {
  it("defaults to fakes so the app runs with no keys", () => {
    expect(readEnv({}).useFakes).toBe(true);
  });
  it("requires the API and Supabase settings when fakes are off", () => {
    expect(() => readEnv({ NEXT_PUBLIC_USE_FAKES: "false" })).toThrow(/apiBaseUrl/);
  });
  it("accepts a full real configuration and trims the trailing slash", () => {
    const env = readEnv({
      NEXT_PUBLIC_USE_FAKES: "false",
      NEXT_PUBLIC_API_BASE_URL: "https://api.example.test/",
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    });
    expect(env.apiBaseUrl).toBe("https://api.example.test");
    expect(env.useFakes).toBe(false);
  });
});
