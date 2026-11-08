import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Planner } from "./planner";
import { maleOfferings } from "@/data/offerings";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { saveGuestPlans, GUEST_STORAGE_KEY } from "@/lib/storage";

function createMockSupabase(currentUser: User | null = null): SupabaseClient {
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
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  } as unknown as SupabaseClient;
}

describe("LEMON-033: Privacy, Auth & Data Freshness UI", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Default onboarding completed so tests directly inspect planner UI
    window.localStorage.setItem("lemon.onboarding-completed.v1", "true");
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders guest data controls with backup download and clear confirmation modal", async () => {
    render(<Planner data={maleOfferings} supabaseClient={null} />);

    // Per LEMON-042B: Large guest notice banner is removed from Browse Sections
    expect(document.querySelector(".guest-notice-banner")).toBeNull();

    // Data & Privacy settings dialog is opened via the guest badge button
    const privacyBtn = screen.getAllByRole("button", { name: /data & privacy|البيانات والخصوصية/i })[0];
    expect(privacyBtn).toBeDefined();
    fireEvent.click(privacyBtn);

    // Modal opens with Data & Privacy heading
    const modalTitle = screen.getByRole("heading", { name: /data & privacy|البيانات والخصوصية/i });
    expect(modalTitle).toBeDefined();

    // Download Backup button exists (no JSON mentioned in primary UI)
    const backupBtn = screen.getByRole("button", { name: /download backup|حفظ نسخة احتياطية/i });
    expect(backupBtn).toBeDefined();

    // Restore Backup button exists
    const restoreBtn = screen.getByRole("button", { name: /restore backup|استعادة نسخة/i });
    expect(restoreBtn).toBeDefined();

    // Delete My Data danger toggle exists
    const deleteToggle = screen.getByText(/delete my data|حذف بياناتي/i);
    expect(deleteToggle).toBeDefined();

    // Clicking delete opens explicit confirmation
    fireEvent.click(deleteToggle);
    const confirmDeleteBtn = screen.getByRole("button", { name: /yes, delete everything|نعم، احذف كل بياناتي/i });
    expect(confirmDeleteBtn).toBeDefined();
    fireEvent.click(confirmDeleteBtn);

    // Toast indicates guest data cleared
    await waitFor(() => {
      expect(document.querySelector(".toast")).toHaveTextContent(/guest data cleared|تم مسح بيانات/i);
    });
  });

  it("displays stale snapshot banner with honest data freshness disclaimer when snapshot is older than threshold", () => {
    render(<Planner data={maleOfferings} supabaseClient={null} />);

    // Since bundled snapshot importedAt is Nov 7, 2026, it is stale relative to current test run (>12h)
    const staleBanner = document.querySelector(".stale-snapshot-banner");
    expect(staleBanner).not.toBeNull();
    expect(staleBanner?.textContent).toMatch(/snapshot|last updated|تحديث|سجل معتمد/i);
  });

  it("simplifies authentication UI highlighting Google OAuth as primary with guidance for legacy accounts", async () => {
    const mockSupabase = createMockSupabase(null);

    render(<Planner data={maleOfferings} supabaseClient={mockSupabase} />);

    // Click Sign In
    const signInBtn = screen.getByRole("button", { name: /sign in|تسجيل الدخول/i });
    fireEvent.click(signInBtn);

    // Check primary Google Sign In button is prominently displayed
    const googleBtn = screen.getByRole("button", { name: /continue with google|المتابعة باستخدام google/i });
    expect(googleBtn).toBeDefined();

    // Check guidance note for Google OAuth vs Legacy email accounts
    const authDialog = screen.getByRole("dialog");
    expect(authDialog.textContent).toMatch(/google/i);
    expect(authDialog.textContent).toMatch(/email|البريد الإلكتروني/i);
  });

  it("prompts user with explicit consent before importing guest plans into authenticated account", async () => {
    // Setup pre-existing guest plan in localStorage
    saveGuestPlans(window.localStorage, [
      {
        id: "guest-plan-alpha",
        name: "Guest Draft Plan",
        termId: maleOfferings.term.id,
        sectionIds: [maleOfferings.sections[0].id],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const mockUser: User = {
      id: "auth-user-999",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };

    const mockSupabase = createMockSupabase(mockUser);

    render(<Planner data={maleOfferings} supabaseClient={mockSupabase} />);

    // Consent banner should appear prompting whether to import guest plans
    await waitFor(() => {
      const importBanner = document.querySelector(".guest-import-banner");
      expect(importBanner).not.toBeNull();
    });

    // Verify guest plans were not silently wiped or merged without consent
    expect(window.localStorage.getItem(GUEST_STORAGE_KEY)).not.toBeNull();
  });
});
