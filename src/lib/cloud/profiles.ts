import { z } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export const PROFILE_LIMITS = Object.freeze({
  minUsernameLength: 3,
  maxUsernameLength: 30,
  minDisplayNameLength: 1,
  maxDisplayNameLength: 60,
  usernameRegex: /^[a-zA-Z0-9_]{3,30}$/,
});

export const ProfileUsernameSchema = z
  .string()
  .min(PROFILE_LIMITS.minUsernameLength, `Username must be at least ${PROFILE_LIMITS.minUsernameLength} characters`)
  .max(PROFILE_LIMITS.maxUsernameLength, `Username must be at most ${PROFILE_LIMITS.maxUsernameLength} characters`)
  .regex(PROFILE_LIMITS.usernameRegex, "Username can only contain letters, numbers, and underscores");

export const ProfileDisplayNameSchema = z
  .string()
  .min(PROFILE_LIMITS.minDisplayNameLength, "Display name must not be blank")
  .max(PROFILE_LIMITS.maxDisplayNameLength, `Display name must be at most ${PROFILE_LIMITS.maxDisplayNameLength} characters`)
  .refine((v) => v.trim().length > 0, "Display name must not be blank");

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  username: ProfileUsernameSchema,
  displayName: ProfileDisplayNameSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Profile = z.infer<typeof ProfileSchema>;

export const ProfileRowSchema = z.object({
  id: z.string().uuid(),
  username: ProfileUsernameSchema,
  display_name: ProfileDisplayNameSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export type ProfileRow = z.infer<typeof ProfileRowSchema>;

export const ProfileUpdateSchema = z.object({
  username: ProfileUsernameSchema,
  displayName: ProfileDisplayNameSchema,
});

export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;

export function profileRowToDomain(row: ProfileRow): Profile {
  const parsed = ProfileRowSchema.parse(row);
  return ProfileSchema.parse({
    id: parsed.id,
    username: parsed.username,
    displayName: parsed.display_name,
    createdAt: new Date(parsed.created_at).toISOString(),
    updatedAt: new Date(parsed.updated_at).toISOString(),
  });
}

export async function getProfile(supabase: SupabaseClient): Promise<Profile | null> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load profile: ${error.message}`);
  }

  if (!data) return null;
  return profileRowToDomain(data as ProfileRow);
}

export async function ensureProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<Profile> {
  const existing = await getProfile(supabase);
  if (existing) return existing;

  const meta = user.user_metadata || {};
  const fullName = (meta.full_name || meta.name || user.email?.split("@")[0] || "Student").trim();
  const displayName = fullName.slice(0, PROFILE_LIMITS.maxDisplayNameLength) || "Student";

  const cleanPrefix = (user.email?.split("@")[0] || "user").replace(/[^a-zA-Z0-9_]/g, "");
  const baseUser = (cleanPrefix.length >= 3 ? cleanPrefix : "user").slice(0, 20);
  const defaultUsername = `${baseUser}_${user.id.replace(/-/g, "").slice(0, 6)}`.slice(0, PROFILE_LIMITS.maxUsernameLength);

  const insertPayload = {
    id: user.id,
    username: defaultUsername,
    display_name: displayName,
  };

  const { data, error } = await supabase
    .from("profiles")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    const refetched = await getProfile(supabase);
    if (refetched) return refetched;
    throw new Error(`Failed to initialize profile: ${error.message}`);
  }

  return profileRowToDomain(data as ProfileRow);
}

export async function updateProfile(
  supabase: SupabaseClient,
  updates: ProfileUpdate,
): Promise<Profile> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("User must be authenticated to update profile.");
  }

  const validated = ProfileUpdateSchema.parse(updates);

  const { data, error } = await supabase
    .from("profiles")
    .update({
      username: validated.username,
      display_name: validated.displayName.trim(),
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    if (
      error.code === "23505" ||
      error.message.includes("profiles_username_lower_idx") ||
      error.message.includes("unique")
    ) {
      throw new Error("This username is already taken. Please choose another one.");
    }
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  return profileRowToDomain(data as ProfileRow);
}
