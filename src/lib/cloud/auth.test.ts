import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSafeOAuthRedirect,
  getVerifiedUser,
  resetPasswordForEmail,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  signUpWithEmail,
} from "./auth";

function mockSupabase(overrides: Record<string, unknown> = {}) {
  return {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      getUser: vi.fn(),
      ...overrides,
    },
  } as unknown as SupabaseClient;
}

describe("Supabase auth operations", () => {
  it("signs up a user and detects when email confirmation is needed", async () => {
    const supabase = mockSupabase({
      signUp: vi.fn().mockResolvedValue({
        data: { user: { id: "u-1", email: "you@example.com" }, session: null },
        error: null,
      }),
    });

    const result = await signUpWithEmail(supabase, "you@example.com", "Password123!");
    expect(result.success).toBe(true);
    expect(result.needsEmailConfirmation).toBe(true);
    expect(result.message).toMatch(/check your email/i);
    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: "you@example.com",
      password: "Password123!",
      options: undefined,
    });
  });

  it("rejects weak passwords and missing email before calling Supabase", async () => {
    const supabase = mockSupabase();
    await expect(signUpWithEmail(supabase, "", "Pass1234!")).rejects.toThrow(/email is required/i);
    await expect(signUpWithEmail(supabase, "user@example.com", "short")).rejects.toThrow(/at least 8 characters/i);
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("signs in an existing user with verified credentials", async () => {
    const user = { id: "u-1", email: "you@example.com" };
    const supabase = mockSupabase({
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user, session: { access_token: "tok" } },
        error: null,
      }),
    });

    const result = await signInWithEmail(supabase, " you@example.com ", "Password123!");
    expect(result.success).toBe(true);
    expect(result.user).toEqual(user);
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "you@example.com",
      password: "Password123!",
    });
  });

  it("signs out the active user locally", async () => {
    const supabase = mockSupabase({
      signOut: vi.fn().mockResolvedValue({ error: null }),
    });

    await signOutUser(supabase);
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("requests password reset instructions", async () => {
    const supabase = mockSupabase({
      resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
    });

    const result = await resetPasswordForEmail(supabase, "you@example.com", "https://lemon.app/auth/callback");
    expect(result.success).toBe(true);
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith("you@example.com", {
      redirectTo: "https://lemon.app/auth/callback",
    });
  });

  it("gets verified user from getUser()", async () => {
    const user = { id: "u-1", email: "you@example.com" };
    const supabase = mockSupabase({
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    });

    const verified = await getVerifiedUser(supabase);
    expect(verified).toEqual(user);
  });

  describe("Google OAuth", () => {
    it("initiates signInWithOAuth with google provider and current origin callback", async () => {
      const supabase = mockSupabase({
        signInWithOAuth: vi.fn().mockResolvedValue({
          data: { provider: "google", url: "https://accounts.google.com/o/oauth2/v2/auth" },
          error: null,
        }),
      });

      const result = await signInWithGoogle(supabase, "https://lemon.kfu.edu.sa/auth/callback");
      expect(result.url).toBe("https://accounts.google.com/o/oauth2/v2/auth");
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: "https://lemon.kfu.edu.sa/auth/callback",
        },
      });
    });

    it("rejects non-http redirect URLs", async () => {
      const supabase = mockSupabase();
      await expect(signInWithGoogle(supabase, "javascript:alert(1)")).rejects.toThrow(
        /invalid oauth redirect/i,
      );
      expect(supabase.auth.signInWithOAuth).not.toHaveBeenCalled();
    });

    it("computes safe OAuth redirect matching origin", () => {
      expect(getSafeOAuthRedirect("https://lemon.kfu.edu.sa/some/path")).toBe(
        "https://lemon.kfu.edu.sa/auth/callback",
      );
    });

    it("throws error when Supabase signInWithOAuth fails", async () => {
      const supabase = mockSupabase({
        signInWithOAuth: vi.fn().mockResolvedValue({
          data: null,
          error: new Error("OAuth provider not enabled"),
        }),
      });

      await expect(signInWithGoogle(supabase, "https://lemon.kfu.edu.sa/auth/callback")).rejects.toThrow(
        /oauth provider not enabled/i,
      );
    });
  });
});
