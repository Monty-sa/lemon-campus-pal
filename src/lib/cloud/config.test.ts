import { describe, expect, it } from "vitest";
import { assertPublicSupabaseKey, readSupabaseConfig } from "./config";

function jwt(payload: Record<string, unknown>): string {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

describe("Supabase public configuration", () => {
  it("stays disabled when neither value is configured", () => {
    expect(readSupabaseConfig({})).toBeNull();
    expect(readSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: "  ", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" })).toBeNull();
  });

  it("returns a trimmed configuration when both values are present", () => {
    expect(
      readSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: " https://example.supabase.co ",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: " public-anon-key ",
      }),
    ).toEqual({ url: "https://example.supabase.co", anonKey: "public-anon-key" });
  });

  it("supports NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as an alternative to ANON_KEY", () => {
    expect(
      readSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pub-key-123",
      }),
    ).toEqual({ url: "https://example.supabase.co", anonKey: "pub-key-123" });

    expect(
      readSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-123",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pub-key-override",
      }),
    ).toEqual({ url: "https://example.supabase.co", anonKey: "pub-key-override" });
  });

  it("rejects partial configuration instead of silently disabling cloud mode", () => {
    expect(() => readSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" })).toThrow(
      /partially configured/i,
    );
    expect(() => readSupabaseConfig({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key" })).toThrow(/partially configured/i);
    expect(() => readSupabaseConfig({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pub-key" })).toThrow(
      /partially configured/i,
    );
  });

  it("rejects private server keys in the public environment", () => {
    expect(() => assertPublicSupabaseKey("sb_secret_example")).toThrow(/must never be exposed/i);
    expect(() => assertPublicSupabaseKey(jwt({ role: "service_role" }))).toThrow(/must never be exposed/i);
    expect(() => assertPublicSupabaseKey(jwt({ role: "anon" }))).not.toThrow();
    expect(() => assertPublicSupabaseKey("not-a-jwt")).not.toThrow();
  });

  it("rejects malformed public configuration", () => {
    expect(() =>
      readSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: "not-a-url", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key" }),
    ).toThrow(/invalid/i);
  });

  it("forces safe guest-only mode when NEXT_PUBLIC_GUEST_ONLY_MODE is true", () => {
    expect(
      readSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        NEXT_PUBLIC_GUEST_ONLY_MODE: "true",
      }),
    ).toBeNull();
  });
});
