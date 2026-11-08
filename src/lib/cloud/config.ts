import { z } from "zod";

export type SupabasePublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_GUEST_ONLY_MODE?: string;
};

const SupabaseConfigSchema = z.object({
  url: z.string().url(),
  anonKey: z.string().min(1),
});

export type SupabaseConfig = z.infer<typeof SupabaseConfigSchema>;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  try {
    const payload: unknown = JSON.parse(atob(padded));
    return payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function assertPublicSupabaseKey(key: string): void {
  if (key.startsWith("sb_secret_")) {
    throw new Error("Supabase secret keys must never be exposed to the browser. Use the public anon or publishable key.");
  }
  if (decodeJwtPayload(key)?.role === "service_role") {
    throw new Error("Supabase service role keys must never be exposed to the browser. Use the public anon or publishable key.");
  }
}

export function readSupabaseConfig(env: SupabasePublicEnv): SupabaseConfig | null {
  if (env.NEXT_PUBLIC_GUEST_ONLY_MODE === "true") {
    return null;
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const rawKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const anonKey = rawKey?.trim();

  if (!url && !anonKey) return null;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is partially configured. Set NEXT_PUBLIC_SUPABASE_URL and either NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, or neither.",
    );
  }

  assertPublicSupabaseKey(anonKey);

  const result = SupabaseConfigSchema.safeParse({ url, anonKey });
  if (!result.success) {
    throw new Error(
      "Supabase configuration is invalid. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return result.data;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  return readSupabaseConfig({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_GUEST_ONLY_MODE: process.env.NEXT_PUBLIC_GUEST_ONLY_MODE,
  });
}
