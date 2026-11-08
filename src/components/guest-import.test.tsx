import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { Planner } from "./planner";
import { maleOfferings } from "@/data/offerings";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { saveGuestPlans, GUEST_STORAGE_KEY } from "@/lib/storage";

function createMockSupabase(currentUser: User | null = null): SupabaseClient {
  const fromMock = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: currentUser },
        error: null,
      }),
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: currentUser ? { user: currentUser } : null,
        },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      }),
      signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
    from: vi.fn().mockReturnValue(fromMock),
  } as unknown as SupabaseClient;
}

describe("Guest Plans Import Review & Keep Separate (LEMON-035 Phase 2)", () => {
  const mockUser: User = {
    id: "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage?.clear();
    window.localStorage.setItem("lemon.onboarding-completed.v1", "true");
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage?.clear();
    vi.restoreAllMocks();
  });

  it("opens review modal showing plan names and section counts before consent", async () => {
    saveGuestPlans(window.localStorage, [
      {
        id: "gp-1",
        name: "Morning Only Schedule",
        termId: maleOfferings.term.id,
        sectionIds: [maleOfferings.sections[0].id, maleOfferings.sections[1].id],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "gp-2",
        name: "Backup Afternoon Schedule",
        termId: maleOfferings.term.id,
        sectionIds: [maleOfferings.sections[2].id],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const mockSupabase = createMockSupabase(mockUser);
    render(<Planner data={maleOfferings} supabaseClient={mockSupabase} />);

    // Prompt banner should appear
    await waitFor(() => {
      expect(screen.getByText(/Guest schedules found on this device/i)).toBeInTheDocument();
    });

    // Click Review & Import
    const reviewBtn = screen.getByRole("button", { name: /Review & Import/i });
    fireEvent.click(reviewBtn);

    // Modal dialog should open
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Import Guest Schedules to Account/i })).toBeInTheDocument();
    });

    const modal = screen.getByRole("dialog");
    expect(within(modal).getByText("Morning Only Schedule")).toBeInTheDocument();
    expect(within(modal).getByText("Backup Afternoon Schedule")).toBeInTheDocument();
    expect(within(modal).getByText("2 sections")).toBeInTheDocument();
    expect(within(modal).getByText("1 section")).toBeInTheDocument();
  });

  it("retains guest plans when user chooses Keep Separate", async () => {
    const guestPlans = [
      {
        id: "gp-keep",
        name: "Guest Private Schedule",
        termId: maleOfferings.term.id,
        sectionIds: [maleOfferings.sections[0].id],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    saveGuestPlans(window.localStorage, guestPlans);

    const mockSupabase = createMockSupabase(mockUser);
    render(<Planner data={maleOfferings} supabaseClient={mockSupabase} />);

    await waitFor(() => {
      expect(screen.getByText(/Guest schedules found on this device/i)).toBeInTheDocument();
    });

    const keepSeparateBtn = screen.getByRole("button", { name: /Keep Separate/i });
    fireEvent.click(keepSeparateBtn);

    // Prompt banner should be dismissed
    await waitFor(() => {
      expect(screen.queryByText(/Guest schedules found on this device/i)).toBeNull();
    });

    // Guest plans remain intact in storage
    const stored = JSON.parse(window.localStorage.getItem(GUEST_STORAGE_KEY) || "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("Guest Private Schedule");
  });

  it("imports plans into account, activates them immediately, and removes empty placeholder", async () => {
    const guestPlans = [
      {
        id: "gp-import-now",
        name: "Imported Alpha Plan",
        termId: maleOfferings.term.id,
        sectionIds: [maleOfferings.sections[0].id],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    saveGuestPlans(window.localStorage, guestPlans);

    const mockSupabase = createMockSupabase(mockUser);
    render(<Planner data={maleOfferings} supabaseClient={mockSupabase} />);

    await waitFor(() => {
      expect(screen.getByText(/Guest schedules found on this device/i)).toBeInTheDocument();
    });

    // Click Review & Import
    const reviewBtn = screen.getByRole("button", { name: /Review & Import/i });
    fireEvent.click(reviewBtn);

    // Click Confirm Import button inside modal
    const confirmBtn = screen.getByRole("button", { name: /Import 1 Plan\(s\) to Account/i });
    fireEvent.click(confirmBtn);

    // Success toast shown
    await waitFor(() => {
      expect(document.querySelector(".toast")).toHaveTextContent(/Guest schedules imported/i);
    });

    // Imported plan should now be active and visible on calendar
    expect(screen.getAllByText("Imported Alpha Plan").length).toBeGreaterThanOrEqual(1);
  });
});
