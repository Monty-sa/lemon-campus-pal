import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  ensureProfile,
  getProfile,
  PROFILE_LIMITS,
  ProfileDisplayNameSchema,
  profileRowToDomain,
  ProfileUpdateSchema,
  ProfileUsernameSchema,
  updateProfile,
  type ProfileRow,
} from "./profiles";

const USER_ID = "22222222-2222-4222-8222-222222222222";

function row(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: USER_ID,
    username: "cool_lemon",
    display_name: "Cool Lemon",
    created_at: "2026-11-07T00:00:00+00:00",
    updated_at: "2026-11-07T00:00:00+00:00",
    ...overrides,
  };
}

function mockSupabase(userId: string | null = USER_ID, profileData: ProfileRow | null = row()) {
  const queryMock = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: profileData, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: profileData, error: null }),
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId, email: "you@example.com" } : null },
        error: userId ? null : new Error("No session"),
      }),
    },
    from: vi.fn().mockReturnValue(queryMock),
    _queryMock: queryMock,
  } as unknown as SupabaseClient & { _queryMock: typeof queryMock };
}

describe("Profile validation schemas", () => {
  it("validates username length and character format", () => {
    expect(ProfileUsernameSchema.parse("lemon_user")).toBe("lemon_user");
    expect(ProfileUsernameSchema.parse("abc")).toBe("abc");
    expect(ProfileUsernameSchema.parse("User_123")).toBe("User_123");

    expect(() => ProfileUsernameSchema.parse("ab")).toThrow(/at least 3/i);
    expect(() => ProfileUsernameSchema.parse("a".repeat(PROFILE_LIMITS.maxUsernameLength + 1))).toThrow(/at most 30/i);
    expect(() => ProfileUsernameSchema.parse("bad-user")).toThrow(/letters, numbers, and underscores/i);
    expect(() => ProfileUsernameSchema.parse("user name")).toThrow(/letters, numbers, and underscores/i);
    expect(() => ProfileUsernameSchema.parse("user@name")).toThrow(/letters, numbers, and underscores/i);
  });

  it("validates display name and rejects blank strings", () => {
    expect(ProfileDisplayNameSchema.parse("Lemon Student")).toBe("Lemon Student");
    expect(() => ProfileDisplayNameSchema.parse("   ")).toThrow(/not be blank/i);
    expect(() => ProfileDisplayNameSchema.parse("")).toThrow(/not be blank/i);
    expect(() => ProfileDisplayNameSchema.parse("x".repeat(PROFILE_LIMITS.maxDisplayNameLength + 1))).toThrow(/at most 60/i);
  });

  it("validates profile update payload", () => {
    expect(
      ProfileUpdateSchema.parse({
        username: "new_handle",
        displayName: "New Display Name",
      }),
    ).toEqual({ username: "new_handle", displayName: "New Display Name" });
  });

  it("maps Postgres row to domain model with ISO dates", () => {
    const domain = profileRowToDomain(row());
    expect(domain.id).toBe(USER_ID);
    expect(domain.username).toBe("cool_lemon");
    expect(domain.displayName).toBe("Cool Lemon");
    expect(domain.createdAt).toBe("2026-11-07T00:00:00.000Z");
  });
});

describe("Profile Supabase operations", () => {
  it("fetches profile for authenticated session", async () => {
    const client = mockSupabase(USER_ID, row());
    const profile = await getProfile(client);
    expect(profile?.username).toBe("cool_lemon");
    expect(client.from).toHaveBeenCalledWith("profiles");
    expect(client._queryMock.eq).toHaveBeenCalledWith("id", USER_ID);
  });

  it("returns null if session is unauthenticated", async () => {
    const client = mockSupabase(null);
    const profile = await getProfile(client);
    expect(profile).toBeNull();
  });

  it("creates a safe profile when missing using Google / metadata defaults", async () => {
    const client = mockSupabase(USER_ID, null);
    client._queryMock.single.mockResolvedValueOnce({
      data: row({ username: "testuser_222222", display_name: "Test User" }),
      error: null,
    });

    const mockUser: User = {
      id: USER_ID,
      app_metadata: {},
      user_metadata: { full_name: "Test User" },
      aud: "authenticated",
      created_at: new Date().toISOString(),
      email: "testuser@gmail.com",
    };

    const profile = await ensureProfile(client, mockUser);
    expect(profile.displayName).toBe("Test User");
    expect(client.from).toHaveBeenCalledWith("profiles");
    expect(client._queryMock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: USER_ID,
        display_name: "Test User",
      }),
    );
  });

  it("updates display name and username with verified session identity", async () => {
    const client = mockSupabase(USER_ID, row({ username: "renamed_user", display_name: "Renamed Name" }));
    const updated = await updateProfile(client, {
      username: "renamed_user",
      displayName: "Renamed Name",
    });

    expect(updated.username).toBe("renamed_user");
    expect(updated.displayName).toBe("Renamed Name");
    expect(client._queryMock.update).toHaveBeenCalledWith({
      username: "renamed_user",
      display_name: "Renamed Name",
    });
    expect(client._queryMock.eq).toHaveBeenCalledWith("id", USER_ID);
  });

  it("handles duplicate username conflict gracefully", async () => {
    const client = mockSupabase(USER_ID);
    client._queryMock.single.mockResolvedValueOnce({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });

    await expect(
      updateProfile(client, { username: "taken_user", displayName: "Name" }),
    ).rejects.toThrow(/already taken/i);
  });
});
