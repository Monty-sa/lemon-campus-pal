import type { SupabaseClient, User } from "@supabase/supabase-js";

export type AuthActionResult = {
  success: boolean;
  message?: string;
  user?: User | null;
  needsEmailConfirmation?: boolean;
};

export async function signUpWithEmail(
  supabase: SupabaseClient,
  email: string,
  password: string,
  redirectTo?: string,
): Promise<AuthActionResult> {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) throw new Error("Email is required.");
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }

  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
    options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
  });

  if (error) {
    throw new Error(error.message);
  }

  const needsEmailConfirmation = !data.session && !!data.user;
  return {
    success: true,
    user: data.user,
    needsEmailConfirmation,
    message: needsEmailConfirmation
      ? "Account created. Please check your email to confirm your account."
      : "Account created and logged in.",
  };
}

export async function signInWithEmail(
  supabase: SupabaseClient,
  email: string,
  password: string,
): Promise<AuthActionResult> {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) throw new Error("Email is required.");
  if (!password) throw new Error("Password is required.");

  const { data, error } = await supabase.auth.signInWithPassword({
    email: trimmedEmail,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("No user returned from login.");
  }

  return {
    success: true,
    user: data.user,
  };
}

export async function signOutUser(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) {
    throw new Error(error.message);
  }
}

export async function resetPasswordForEmail(
  supabase: SupabaseClient,
  email: string,
  redirectTo?: string,
): Promise<AuthActionResult> {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) throw new Error("Email is required.");

  const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
    redirectTo,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    success: true,
    message: "Password reset instructions sent. Please check your email.",
  };
}

export function getSafeOAuthRedirect(origin?: string): string {
  if (origin) {
    const url = new URL(origin);
    return `${url.origin}/auth/callback`;
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/auth/callback`;
  }
  return "http://localhost:3000/auth/callback";
}

export async function signInWithGoogle(
  supabase: SupabaseClient,
  redirectTo: string = getSafeOAuthRedirect(),
): Promise<{ url?: string }> {
  const parsed = new URL(redirectTo);
  if (!parsed.protocol.startsWith("http")) {
    throw new Error("Invalid OAuth redirect URL.");
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return { url: data?.url ?? undefined };
}

export async function getVerifiedUser(supabase: SupabaseClient): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
