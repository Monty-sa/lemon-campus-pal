import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { offerings } from "@/data/offerings";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { LANGUAGE_STORAGE_KEY } from "@/lib/i18n/storage";
import { femaleOfferings } from "@/data/female-offerings";
import { GUEST_ACTIVE_PLAN_KEY, STORAGE_KEY } from "@/lib/storage";
import { Planner } from "./planner";

const lightweightAuthTestData = { ...offerings, courses: [], sections: [] };

function mockMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: prefersDark && query === "(prefers-color-scheme: dark)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

describe("English interface", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the planning workspace in left-to-right mode", async () => {
    const { container } = render(<Planner data={offerings} />);
    await waitFor(() => expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument());
    expect(container.querySelector("main")).toHaveAttribute("dir", "ltr");
    expect(screen.getByRole("combobox", { name: "Semester" })).toBeDisabled();
    expect(screen.getAllByText(/Second Semester · Academic Year 1448/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Section status reflects the source snapshot only/)).toBeInTheDocument();
    expect(screen.getAllByText(/Time TBA/i)).toHaveLength(6);
  });

  it("shows both canonical meeting days in the CRN 63030 card summary", async () => {
    const section = offerings.sections.find((item) => item.crn === "63030")!;
    const data = { ...offerings, sections: [section], courses: offerings.courses.filter((course) => course.id === section.courseId) };
    const { container } = render(<Planner data={data} />);
    await waitFor(() => expect(container.querySelector(".section-summary-meeting")).toBeInTheDocument());
    const summary = container.querySelector(".section-summary")!;
    expect(summary).toHaveTextContent("Sun");
    expect(summary).toHaveTextContent("Tue");
  });

  it.each([
    ["en", "ltr"],
    ["ar", "rtl"],
  ] as const)("renders every reported overlapping CRN 66843 meeting as readable, clickable cards in %s", async (lang, direction) => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    const financeSection = offerings.sections.find((section) => section.crn === "66843")!;
    const internationalEconomics = femaleOfferings.sections.find((section) => section.crn === "75464")!;
    // Reproduce the owner-reported Mon/Wed overlap while retaining CRN 75464's course identity.
    const reportedOverlapSection = {
      ...internationalEconomics,
      meetings: [
        { ...internationalEconomics.meetings[0], id: "75464-reported-mon", days: ["mon" as const], startMinutes: 630, endMinutes: 705 },
        { ...internationalEconomics.meetings[0], id: "75464-reported-wed", days: ["wed" as const], startMinutes: 630, endMinutes: 705 },
      ],
    };
    const internationalCourse = femaleOfferings.courses.find((course) => course.id === internationalEconomics.courseId)!;
    const testData = {
      ...offerings,
      courses: [...offerings.courses.filter((course) => course.id !== internationalCourse.id), internationalCourse],
      sections: [...offerings.sections.filter((section) => section.id !== financeSection.id), financeSection, reportedOverlapSection],
    };
    const now = "2026-11-09T00:00:00.000Z";
    window.localStorage.setItem("lemon.schedule-plans.v1", JSON.stringify([{
      id: "reported-overlap-plan",
      name: "Overlap regression",
      termId: offerings.term.id,
      sectionIds: [financeSection.id, reportedOverlapSection.id],
      createdAt: now,
      updatedAt: now,
    }]));

    const { container } = render(<Planner data={testData} />);
    await waitFor(() => expect(container.querySelectorAll(".class-block")).toHaveLength(5));

    expect(container.querySelector("main")).toHaveAttribute("dir", direction);
    const financeCards = [...container.querySelectorAll<HTMLButtonElement>(".class-block")]
      .filter((card) => card.textContent?.includes("0675-102"));
    const economicsCards = [...container.querySelectorAll<HTMLButtonElement>(".class-block")]
      .filter((card) => card.textContent?.includes("0678-206"));
    expect(financeCards).toHaveLength(3);
    expect(economicsCards).toHaveLength(2);
    const dayColumns = container.querySelectorAll(".day-column");
    for (const dayIndex of [1, 3]) { // Monday and Wednesday in the timetable's Sun–Thu order.
      const cards = [...dayColumns[dayIndex].querySelectorAll<HTMLButtonElement>(".class-block")];
      expect(cards).toHaveLength(2);
      expect(cards.map((card) => card.textContent)).toEqual(expect.arrayContaining([
        expect.stringContaining("0675-102"),
        expect.stringContaining("0678-206"),
      ]));
      expect(cards.map((card) => card.style.insetInlineStart).sort()).toEqual(["calc(0% + 4px)", "calc(50% + 4px)"].sort());
      for (const card of cards) {
        expect(card.style.width).toBe("calc(50% - 8px)");
        expect(card).toHaveAttribute("aria-haspopup", "dialog");
        expect(card).toHaveClass("has-conflict");
      }
    }
    expect(container.querySelector(".calendar-grid")?.getAttribute("style")).toContain("--calendar-day-min-width: 192px");
    for (const card of dayColumns[1].querySelectorAll<HTMLButtonElement>(".class-block")) {
      fireEvent.click(card);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      fireEvent.keyDown(window, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    }
  });

  it.each([
    ["en", "ltr", "Clear Schedule", "Clear this plan's schedule?", "Confirm", "Cancel", "Undo"],
    ["ar", "rtl", "إفراغ الجدول", "إفراغ الخطة الحالية؟", "تأكيد", "إلغاء", "تراجع"],
  ] as const)("clears and undoes only the active guest plan in %s on a narrow viewport", async (lang, direction, clearLabel, dialogTitle, confirmLabel, cancelLabel, undoLabel) => {
    window.innerWidth = 390;
    window.dispatchEvent(new Event("resize"));
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    const section = offerings.sections.find((item) => item.crn === "66843")!;
    const data = {
      ...offerings,
      sections: [section],
      courses: offerings.courses.filter((course) => course.id === section.courseId),
    };
    const timestamp = "2026-11-09T00:00:00.000Z";
    const activePlan = { id: "active-plan", name: "My named plan", termId: offerings.term.id, sectionIds: [section.id], createdAt: timestamp, updatedAt: timestamp };
    const otherPlan = { id: "other-plan", name: "Keep this plan", termId: offerings.term.id, sectionIds: [section.id], createdAt: timestamp, updatedAt: timestamp };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([activePlan, otherPlan]));
    window.localStorage.setItem(GUEST_ACTIVE_PLAN_KEY, activePlan.id);
    const preferences = JSON.stringify({ preferredEarliestMinutes: 600, fewerDays: true });
    window.localStorage.setItem("lemon.guest.auto-schedule-preferences.v1", preferences);

    const { container } = render(<Planner data={data} supabaseClient={null} />);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Plan name" })).toHaveValue(activePlan.name));
    expect(container.querySelectorAll(".class-block")).toHaveLength(3);
    expect(container.querySelector("main")).toHaveAttribute("dir", direction);

    fireEvent.click(screen.getByRole("button", { name: clearLabel }));
    expect(screen.getByRole("dialog", { name: dialogTitle })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: cancelLabel }));
    expect(container.querySelectorAll(".class-block")).toHaveLength(3);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: clearLabel }));
    fireEvent.click(screen.getByRole("button", { name: confirmLabel }));
    await waitFor(() => expect(container.querySelectorAll(".class-block")).toHaveLength(0));
    const savedPlansAfterClear = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(savedPlansAfterClear.find((plan: { id: string }) => plan.id === activePlan.id)).toMatchObject({
      id: activePlan.id,
      name: activePlan.name,
      sectionIds: [],
    });
    expect(savedPlansAfterClear.find((plan: { id: string }) => plan.id === otherPlan.id)).toEqual(otherPlan);
    expect(window.localStorage.getItem("lemon.guest.auto-schedule-preferences.v1")).toBe(preferences);
    expect(screen.getByRole("button", { name: clearLabel })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: undoLabel }));
    await waitFor(() => expect(container.querySelectorAll(".class-block")).toHaveLength(3));
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).find((plan: { id: string }) => plan.id === activePlan.id).sectionIds).toEqual([section.id]);
  });

  it("copies selected CRNs and displays direct schedule download dropdown (LEMON-018)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const now = "2026-11-07T00:00:00.000Z";
    window.localStorage.setItem("lemon.schedule-plans.v1", JSON.stringify([{ id: "saved", name: "Verification Plan", termId: "144820", sectionIds: ["144820:63953"], createdAt: now, updatedAt: now }]));
    render(<Planner data={offerings} />);
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Plan name" })).toHaveValue("Verification Plan"),
    );
    const copyButton = screen.getByRole("button", { name: "Copy CRNs" });
    expect(copyButton).toBeEnabled();
    fireEvent.click(copyButton);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("63953"));

    // Download dropdown
    const downloadBtn = screen.getByRole("button", { name: "Download schedule" });
    expect(downloadBtn).toBeInTheDocument();
    fireEvent.click(downloadBtn);

    expect(screen.getByRole("menuitem", { name: "Download as PDF" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Download as PNG (High-Res)" })).toBeInTheDocument();
  });

  it("allows inline schedule plan renaming with validation and persistence (LEMON Plan Renaming)", async () => {
    render(<Planner data={offerings} />);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Plan name" })).toBeInTheDocument());

    const planInput = screen.getByRole("textbox", { name: "Plan name" });
    expect(planInput).toHaveValue("My Plan 1");

    // Rename plan
    fireEvent.change(planInput, { target: { value: "No Thursday Classes 😎" } });
    fireEvent.blur(planInput);

    await waitFor(() => {
      expect(planInput).toHaveValue("No Thursday Classes 😎");
      const savedPlans = JSON.parse(window.localStorage.getItem("lemon.schedule-plans.v1") || "[]");
      expect(savedPlans[0]?.name).toBe("No Thursday Classes 😎");
    });

    // Empty input rolls back safely to previous name without creating blank/undefined plans
    fireEvent.change(planInput, { target: { value: "   " } });
    fireEvent.blur(planInput);
    expect(planInput).toHaveValue("No Thursday Classes 😎");
  });

  it("restores the selected guest plan after a reload", async () => {
    const now = "2026-11-08T00:00:00.000Z";
    window.localStorage.setItem("lemon.guest-plans.v1", JSON.stringify([
      { id: "plan-a", name: "First Plan", termId: "144820", sectionIds: [], createdAt: now, updatedAt: now },
      { id: "plan-b", name: "Generated Plan", termId: "144820", sectionIds: ["144820:63953"], createdAt: now, updatedAt: now },
    ]));
    window.localStorage.setItem("lemon.guest.active-plan.v1", "plan-b");

    render(<Planner data={offerings} />);

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Choose plan" })).toHaveValue("plan-b"),
    );
    expect(screen.getByRole("textbox", { name: "Plan name" })).toHaveValue("Generated Plan");
  });

  it("renders navigation link to KFU GPA Calculator (LEMON-017)", async () => {
    render(<Planner data={offerings} />);
    await waitFor(() => expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument());

    const gpaLink = screen.getByRole("link", { name: /Calculate My GPA/i });
    expect(gpaLink).toBeInTheDocument();
    expect(gpaLink).toHaveAttribute("href", "/gpa");
  });
});

describe("Theme preference", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("follows the operating system when System is selected", async () => {
    mockMatchMedia(true);
    render(<Planner data={offerings} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "System theme" })).toHaveAttribute("aria-pressed", "true"));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("restores a saved preference and persists a new one", async () => {
    mockMatchMedia(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(<Planner data={offerings} />);
    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "dark"));
    expect(screen.getByRole("button", { name: "Dark theme" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Light theme" }));
    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "light"));
    expect(screen.getByRole("button", { name: "Light theme" })).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });
});

describe("Authentication & Cloud Sync UI", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function createMockSupabase(
    user: { id: string; email: string } | null = null,
    profile: { username: string; display_name: string } | null = user
      ? { username: "cool_student", display_name: "Cool Student" }
      : null,
    isAdmin = false,
  ) {
    const listeners: ((event: string, session: unknown) => void)[] = [];
    const profileRow =
      profile && user
        ? {
            id: user.id,
            username: profile.username,
            display_name: profile.display_name,
            created_at: "2026-11-07T00:00:00+00:00",
            updated_at: "2026-11-07T00:00:00+00:00",
          }
        : null;

    const fromMock = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: null }),
      single: vi.fn().mockImplementation(async () => ({ data: profileRow, error: null })),
      maybeSingle: vi.fn().mockImplementation(async () => {
        return { data: profileRow, error: null };
      }),
    };

    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
        onAuthStateChange: vi.fn().mockImplementation((cb: (event: string, session: unknown) => void) => {
          listeners.push(cb);
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
        signInWithOAuth: vi.fn().mockResolvedValue({
          data: { provider: "google", url: "https://accounts.google.com" },
          error: null,
        }),
        signOut: vi.fn().mockImplementation(async () => {
          listeners.forEach((cb) => cb("SIGNED_OUT", null));
          return { error: null };
        }),
        resetPasswordForEmail: vi.fn(),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "app_admins") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: isAdmin && user ? { user_id: user.id } : null,
                  error: null,
                }),
              }),
            }),
          };
        }
        return fromMock;
      }),
      _fromMock: fromMock,
      _listeners: listeners,
    } as unknown as SupabaseClient & {
      _fromMock: typeof fromMock;
      _listeners: typeof listeners;
    };
  }

  it("displays guest mode badge when Supabase is not configured", async () => {
    render(<Planner data={offerings} supabaseClient={null} />);
    await waitFor(() => expect(screen.getByText(/Guest mode/i)).toBeInTheDocument());
  });

  it("renders Sign in button and opens auth modal when Supabase is configured", async () => {
    const mockClient = createMockSupabase(null);
    render(<Planner data={offerings} supabaseClient={mockClient} />);
    const signInBtn = await screen.findByRole("button", { name: "Sign in" });
    expect(signInBtn).toBeInTheDocument();

    fireEvent.click(signInBtn);
    expect(screen.getByRole("heading", { name: "Sign in to LEMON" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(screen.queryByRole("heading", { name: "Sign in to LEMON" })).not.toBeInTheDocument();
  });

  it("shows authenticated user and sync status when user session exists", async () => {
    const mockClient = createMockSupabase(
      {
        id: "11111111-1111-4111-8111-111111111111",
        email: "you@example.com",
      },
      null,
    );
    render(<Planner data={offerings} supabaseClient={mockClient} />);
    await waitFor(() => expect(screen.getByText("you@example.com")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Synced")).toBeInTheDocument());

    const logoutBtn = screen.getByRole("button", { name: "Sign out" });
    fireEvent.click(logoutBtn);
    await waitFor(() => expect(mockClient.auth.signOut).toHaveBeenCalled());
  });

  it("restores the selected guest plan after signing out of an account", async () => {
    const now = "2026-11-08T00:00:00.000Z";
    window.localStorage.setItem("lemon.guest-plans.v1", JSON.stringify([
      { id: "guest-plan-a", name: "Guest Plan A", termId: offerings.term.id, sectionIds: [], createdAt: now, updatedAt: now },
      { id: "guest-plan-b", name: "Guest Plan B", termId: offerings.term.id, sectionIds: ["144820:85169"], createdAt: now, updatedAt: now },
    ]));
    window.localStorage.setItem("lemon.guest.active-plan.v1", "guest-plan-b");

    const mockClient = createMockSupabase({
      id: "11111111-1111-4111-8111-111111111111",
      email: "you@example.com",
    });
    render(<Planner data={offerings} supabaseClient={mockClient} />);
    await screen.findByRole("button", { name: "Sign out" });

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Plan name" })).toHaveValue("Guest Plan B"),
    );
    expect(screen.getByRole("combobox", { name: "Choose plan" })).toHaveValue("guest-plan-b");
    expect(window.localStorage.getItem("lemon.guest.active-plan.v1")).toBe("guest-plan-b");
  });

  it("ignores a stale account A sync after account B becomes current", async () => {
    const mockClient = createMockSupabase(null) as SupabaseClient & {
      _fromMock: { order: ReturnType<typeof vi.fn> };
      _listeners: Array<(event: string, session: unknown) => void>;
    };
    let resolveA!: (value: unknown) => void;
    let resolveB!: (value: unknown) => void;
    const accountAResult = new Promise((resolve) => { resolveA = resolve; });
    const accountBResult = new Promise((resolve) => { resolveB = resolve; });
    mockClient._fromMock.order
      .mockImplementationOnce(() => accountAResult)
      .mockImplementationOnce(() => accountBResult);

    render(<Planner data={lightweightAuthTestData} supabaseClient={mockClient} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument());

    // Drain the mount-time getUser lookup before replacing its result for the
    // simulated account-switch events below. Otherwise worker load can let the
    // initial lookup observe account A and consume the deferred A response.
    const initialUserLookup = (mockClient.auth.getUser as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    await act(async () => {
      await initialUserLookup;
    });

    const userA = { id: "11111111-1111-4111-8111-111111111111", email: "a@example.com" };
    const userB = { id: "22222222-2222-4222-8222-222222222222", email: "b@example.com" };
    (mockClient.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { user: userA }, error: null });
    mockClient._listeners.forEach((listener) => listener("SIGNED_IN", { user: userA }));
    await waitFor(() => expect(mockClient._fromMock.order).toHaveBeenCalledTimes(1));
    (mockClient.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { user: userB }, error: null });
    mockClient._listeners.forEach((listener) => listener("SIGNED_IN", { user: userB }));
    await waitFor(() => expect(mockClient._fromMock.order).toHaveBeenCalledTimes(2));

    const rowB = {
      user_id: userB.id,
      id: "plan-b",
      name: "Account B Plan",
      term_id: offerings.term.id,
      section_ids: [],
      created_at: "2026-11-07T00:00:00+00:00",
      updated_at: "2026-11-07T00:00:00+00:00",
    };
    resolveB({ data: [rowB], error: null });
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Plan name" })).toHaveValue("Account B Plan"));

    const rowA = { ...rowB, user_id: userA.id, id: "plan-a", name: "Account A Plan" };
    resolveA({ data: [rowA], error: null });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole("textbox", { name: "Plan name" })).toHaveValue("Account B Plan");
    expect(screen.queryByDisplayValue("Account A Plan")).not.toBeInTheDocument();
  });

  it("renders Continue with Google button and triggers OAuth redirect", async () => {
    const mockClient = createMockSupabase(null);
    render(<Planner data={offerings} supabaseClient={mockClient} />);

    const signInBtn = await screen.findByRole("button", { name: "Sign in" });
    fireEvent.click(signInBtn);

    const googleBtn = screen.getByRole("button", { name: "Continue with Google" });
    expect(googleBtn).toBeInTheDocument();

    fireEvent.click(googleBtn);
    await waitFor(() => {
      expect(mockClient.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: expect.stringMatching(/\/auth\/callback$/),
        },
      });
    });
  });

  it("displays OAuth error message if signInWithOAuth fails", async () => {
    const mockClient = createMockSupabase(null);
    (mockClient.auth.signInWithOAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: null,
      error: new Error("Google OAuth configuration error"),
    });

    render(<Planner data={lightweightAuthTestData} supabaseClient={mockClient} />);
    const signInBtn = await screen.findByRole("button", { name: "Sign in" });
    fireEvent.click(signInBtn);

    const googleBtn = screen.getByRole("button", { name: "Continue with Google" });
    fireEvent.click(googleBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Google OAuth configuration error");
    });
  });

  it("displays profile display name and handle in topbar when logged in", async () => {
    const mockClient = createMockSupabase({
      id: "11111111-1111-4111-8111-111111111111",
      email: "you@example.com",
    });
    render(<Planner data={offerings} supabaseClient={mockClient} />);

    await waitFor(() => expect(screen.getByText("Cool Student")).toBeInTheDocument());
    expect(screen.getByText("@cool_student")).toBeInTheDocument();
  });

  it("opens Account Settings modal and allows updating display name and username", async () => {
    const mockClient = createMockSupabase({
      id: "11111111-1111-4111-8111-111111111111",
      email: "you@example.com",
    });
    render(<Planner data={offerings} supabaseClient={mockClient} />);

    const settingsBtn = await screen.findByRole("button", { name: "Settings" });
    fireEvent.click(settingsBtn);

    expect(screen.getByRole("heading", { name: "Account Settings" })).toBeInTheDocument();
    expect(screen.getByText("you@example.com")).toBeInTheDocument();

    const nameInput = screen.getByLabelText("Display name");
    const userInput = screen.getByLabelText("Username");
    expect(nameInput).toHaveValue("Cool Student");
    expect(userInput).toHaveValue("cool_student");

    fireEvent.change(nameInput, { target: { value: "Super Student" } });
    fireEvent.change(userInput, { target: { value: "super_student" } });

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mockClient._fromMock.update).toHaveBeenCalledWith({
        username: "super_student",
        display_name: "Super Student",
      });
    });
  }, 15000);

  it("does not render Admin button in student navigation (owner bookmarks /admin directly)", async () => {
    const mockClient = createMockSupabase(
      { id: "admin-uuid-1", email: "admin@lemon.internal" },
      { username: "admin", display_name: "Admin User" },
      true, // isAdmin
    );
    render(<Planner data={offerings} supabaseClient={mockClient} />);

    await waitFor(() => {
      expect(screen.getByText("admin@lemon.internal")).toBeInTheDocument();
    });
    expect(screen.queryByRole("link", { name: "Admin Dashboard" })).not.toBeInTheDocument();
    expect(document.querySelector("a[href='/admin']")).toBeNull();
  });

  it("provides guest mode privacy and data backup controls without large disruptive banner", async () => {
    render(<Planner data={offerings} supabaseClient={null} />);
    await waitFor(() => expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument());
    // Large guest notice banner is removed per LEMON-042B
    expect(document.querySelector(".guest-notice-banner")).toBeNull();
    // Data & Privacy controls are easily accessible via guest badge
    expect(screen.getAllByRole("button", { name: /data & privacy/i })[0]).toBeInTheDocument();
  });

  it("toggles advanced filters panel and filters by exact CRN", async () => {
    render(<Planner data={offerings} supabaseClient={null} />);
    await waitFor(() => expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument());

    const advancedToggle = screen.getByRole("button", { name: /Advanced Filters/ });
    expect(advancedToggle).toBeInTheDocument();
    fireEvent.click(advancedToggle);

    // Look for exact CRN input
    const crnInput = screen.getByLabelText("Exact CRN");
    expect(crnInput).toBeInTheDocument();

    // Filter by CRN 63953
    fireEvent.change(crnInput, { target: { value: "63953" } });

    await waitFor(() => {
      expect(screen.getByText("1 courses · 1 sections")).toBeInTheDocument();
      expect(screen.getByText("CRN 63953")).toBeInTheDocument();
    });

    // Clear All button should appear and reset
    const clearAllBtn = screen.getByRole("button", { name: "Clear All" });
    fireEvent.click(clearAllBtn);

    await waitFor(() => {
      expect(screen.queryByText("1 courses · 1 sections")).not.toBeInTheDocument();
    });
  });

  it("renders inline Auto Schedule button alongside Advanced Filters and toggles panel (LEMON-030E)", async () => {
    render(<Planner supabaseClient={null} />);
    await waitFor(() => expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument());

    // Both controls appear side by side in the controls row
    const advancedFiltersBtn = screen.getByRole("button", { name: /Advanced Filters/ });
    const autoScheduleToggleBtn = screen.getByRole("button", { name: /Auto Schedule/ });
    expect(advancedFiltersBtn).toBeInTheDocument();
    expect(autoScheduleToggleBtn).toBeInTheDocument();

    // Default state is collapsed: auto-schedule-panel wrapper is hidden
    const wrapper = document.getElementById("auto-schedule-collapse-panel");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute("hidden");
    expect(wrapper).toHaveStyle({ display: "none" });

    // Click toggle button: expands panel accessibly
    fireEvent.click(autoScheduleToggleBtn);
    expect(autoScheduleToggleBtn).toHaveAttribute("aria-expanded", "true");
    expect(wrapper).not.toHaveAttribute("hidden");
    expect(wrapper).toHaveStyle({ display: "block" });

    // Clicking again collapses panel
    fireEvent.click(autoScheduleToggleBtn);
    expect(autoScheduleToggleBtn).toHaveAttribute("aria-expanded", "false");
    expect(wrapper).toHaveAttribute("hidden");
  });

  it("switches student category to female and updates section catalog (LEMON-011B)", async () => {
    render(<Planner supabaseClient={null} />);
    await waitFor(() => expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument());

    const categorySelect = screen.getByLabelText("Student Category");
    expect(categorySelect).toBeInTheDocument();
    expect(categorySelect).toHaveValue("11");

    fireEvent.change(categorySelect, { target: { value: "12" } });

    await waitFor(() => {
      expect(categorySelect).toHaveValue("12");
      // Female dataset has 168 courses and 540 sections
      expect(screen.getAllByText("168 courses · 540 sections").length).toBeGreaterThan(0);
      expect(window.localStorage.getItem("lemon.selected-category.v1")).toBe("12");
    });
  });

  it("opens service status dialog displaying reliability and snapshot signals (LEMON-013)", async () => {
    render(<Planner supabaseClient={null} />);
    await waitFor(() => expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument());

    const statusBtn = screen.getByRole("button", { name: /System status/ });
    expect(statusBtn).toBeInTheDocument();
    fireEvent.click(statusBtn);

    expect(screen.getByRole("heading", { name: /System & Service Status/ })).toBeInTheDocument();
    expect(screen.getByText("Planning Engine ⚡")).toBeInTheDocument();
    expect(screen.getByText("Cloud Sync & Accounts ☁️")).toBeInTheDocument();
    expect(screen.getAllByText(/Business Course Catalog|KFU Timetable Catalog/).length).toBeGreaterThan(0);
    // Simplified status modal excludes verbose offline resilience card per LEMON-042
    expect(screen.queryByText(/Offline & Registration Rush Resilience/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("heading", { name: /System & Service Status/ })).not.toBeInTheDocument();
  }, 15000);

  it("displays friendly playful microcopy and emojis across UI states (LEMON-014)", async () => {
    render(<Planner supabaseClient={null} />);
    await waitFor(() => expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument());

    // Hero title with lemon
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Plan your semester\.\s*Your way\.\s*🍋/);

    // Empty week state with calendar emoji
    expect(screen.getByText(/Your week is wide open! 📅/)).toBeInTheDocument();

    // No conflicts badge with celebration emoji
    expect(screen.getByText("No conflicts 🎉")).toBeInTheDocument();
  });

  it("toggles between Cards and Table view, rendering all columns and persisting preference (LEMON-011C)", async () => {
    render(<Planner supabaseClient={null} />);
    await waitFor(() => expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument());

    const tableToggleBtn = screen.getByRole("button", { name: "Table" });
    const cardsToggleBtn = screen.getByRole("button", { name: "Cards" });

    expect(cardsToggleBtn).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    // Switch to Table view
    fireEvent.click(tableToggleBtn);

    await waitFor(() => {
      expect(tableToggleBtn).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("table")).toBeInTheDocument();
      expect(window.localStorage.getItem("lemon.explorer-view.v1")).toBe("table");
    });

    // Check table headers
    expect(screen.getByRole("columnheader", { name: /Section/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Type/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /CRN/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Course/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Instructor/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Days/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Time/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Location/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Availability/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Action/ })).toBeInTheDocument();

    // Sort by CRN
    const crnSortBtn = screen.getByRole("button", { name: "CRN" });
    fireEvent.click(crnSortBtn);
    expect(screen.getByRole("columnheader", { name: /CRN/ })).toHaveAttribute("aria-sort", "ascending");

    // Switch back to Cards view
    fireEvent.click(cardsToggleBtn);
    await waitFor(() => {
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(window.localStorage.getItem("lemon.explorer-view.v1")).toBe("cards");
    });
  });

  it("opens notification center and manages in-app section alerts (LEMON-016)", async () => {
    // Seed test notification in local storage
    window.localStorage.setItem(
      "lemon.in-app-notifications.v1",
      JSON.stringify([
        {
          id: "notif-test-1",
          deviceId: "dev-123",
          crn: "63953",
          title: "Availability Updated 🔄",
          body: "CRN 63953 is now open in the catalog.",
          changeType: "availability_changed",
          readAt: null,
          createdAt: "2026-11-07T12:00:00Z",
        },
      ]),
    );

    render(<Planner supabaseClient={null} />);
    await waitFor(() => expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument());

    const alertsBtn = screen.getByRole("button", { name: /Notifications/ });
    expect(alertsBtn).toBeInTheDocument();
    expect(alertsBtn).toHaveTextContent("1"); // Unread badge

    fireEvent.click(alertsBtn);

    expect(screen.getByRole("heading", { name: /Section Alerts & Notifications/ })).toBeInTheDocument();
    expect(screen.getByText("Availability Updated 🔄")).toBeInTheDocument();
    expect(screen.getByText("CRN 63953 is now open in the catalog.")).toBeInTheDocument();
    expect(screen.getByText("Web Push Notifications 📲")).toBeInTheDocument();

    // Mark all read
    const markReadBtn = screen.getByRole("button", { name: "Mark all read" });
    fireEvent.click(markReadBtn);

    // Close modal
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("heading", { name: /Section Alerts & Notifications/ })).not.toBeInTheDocument();
  });

  it("renders full-width vertical layout with schedule on top, pagination, and back-to-schedule shortcuts (LEMON-020)", async () => {
    const { container } = render(<Planner supabaseClient={null} />);
    await waitFor(() => expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument());

    // Schedule section appears before catalog in vertical layout
    const scheduleSection = container.querySelector("#schedule-section");
    const catalogSection = container.querySelector("#browse-courses-section");
    expect(scheduleSection).toBeInTheDocument();
    expect(catalogSection).toBeInTheDocument();

    // Verify DOM order: scheduleSection comes before catalogSection
    expect(scheduleSection!.compareDocumentPosition(catalogSection!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    // Switch to table view and verify pagination controls
    const tableToggleBtn = screen.getByRole("button", { name: "Table" });
    fireEvent.click(tableToggleBtn);

    await waitFor(() => {
      expect(screen.getByRole("table")).toBeInTheDocument();
      expect(screen.getByLabelText("Sections per page")).toBeInTheDocument();
      expect(screen.getByText(/Showing/)).toBeInTheDocument();
    });

    // Add a section to plan
    const addButtons = screen.getAllByRole("button", { name: /Add section/ });
    fireEvent.click(addButtons[0]);

    // Back to Schedule shortcut appears
    await waitFor(() => {
      expect(screen.getAllByText(/Back to Schedule/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/View in schedule/).length).toBeGreaterThan(0);
    });
  });

  describe("Arabic/English Localization & Segmented Selector (LEMON-021)", () => {
    it("uses the Arabic default name for a new guest plan", async () => {
      window.localStorage.setItem("lemon.language.v1", "ar");

      render(<Planner supabaseClient={null} />);

      await waitFor(() => {
        expect(document.documentElement.getAttribute("dir")).toBe("rtl");
        expect(document.querySelector<HTMLInputElement>("#plan-name-input")?.value).toBe("خطتي 1");
      });
    });

    it("formats stale snapshot ages in the selected locale without duplicated English ago", async () => {
      const { container } = render(<Planner supabaseClient={null} />);

      await waitFor(() => expect(document.body).not.toHaveTextContent(/ago ago/i));
      const arabicButton = container.querySelector<HTMLButtonElement>(".language-switcher button");
      expect(arabicButton).not.toBeNull();
      fireEvent.click(arabicButton!);

      await waitFor(() => {
        expect(document.documentElement.getAttribute("dir")).toBe("rtl");
        expect(document.body).not.toHaveTextContent(/\d+[mhd] ago/i);
      });
    });

    it("restores a saved Arabic locale after hydration without changing the initial render locale", async () => {
      window.localStorage.setItem("lemon.language.v1", "ar");

      render(<Planner supabaseClient={null} />);

      await waitFor(() => {
        expect(document.documentElement.getAttribute("lang")).toBe("ar");
        expect(document.documentElement.getAttribute("dir")).toBe("rtl");
      });
      expect(window.localStorage.getItem("lemon.language.v1")).toBe("ar");
      expect(screen.getByRole("button", { name: "English" })).toBeInTheDocument();
    });

    it("switches language between English and Arabic, updating layout direction, translations and storage", async () => {
      render(<Planner supabaseClient={null} />);
      await waitFor(() => expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument());

      // Initial state is English and LTR
      expect(document.documentElement.getAttribute("dir")).toBe("ltr");
      expect(document.documentElement.getAttribute("lang")).toBe("en");
      expect(screen.getAllByText("Your Campus Pal.").length).toBeGreaterThan(0);
      expect(screen.getByText("Sunday")).toBeInTheDocument();

      // Click Arabic language switcher button
      const arabicBtn = screen.getByRole("button", { name: "العربية" });
      fireEvent.click(arabicBtn);

      await waitFor(() => {
        expect(document.documentElement.getAttribute("dir")).toBe("rtl");
        expect(document.documentElement.getAttribute("lang")).toBe("ar");
        expect(window.localStorage.getItem("lemon.language.v1")).toBe("ar");
        expect(screen.getAllByText("خويّك الجامعي.").length).toBeGreaterThan(0);
        expect(screen.getByText("الأحد")).toBeInTheDocument();
        expect(screen.getByText("🎓 احسب معدلي")).toBeInTheDocument();
        expect(screen.getAllByText(/شعب كلية إدارة الأعمال|تصفّح الشعب/).length).toBeGreaterThan(0);
        expect(screen.getByText("رتّب جدولك")).toBeInTheDocument();
        expect(screen.getAllByText(/أضف لجدولي/).length).toBeGreaterThan(0);
        expect(screen.getByPlaceholderText("مثال: جدول بدون دوام خميس 😎")).toBeInTheDocument();
      });

      // Switch back to English
      const englishBtn = screen.getByRole("button", { name: "English" });
      fireEvent.click(englishBtn);

      await waitFor(() => {
        expect(document.documentElement.getAttribute("dir")).toBe("ltr");
        expect(document.documentElement.getAttribute("lang")).toBe("en");
        expect(window.localStorage.getItem("lemon.language.v1")).toBe("en");
        expect(screen.getAllByText("Your Campus Pal.").length).toBeGreaterThan(0);
      });
    });

    it("operates the redesigned segmented selector with radio buttons and keyboard navigation", async () => {
      render(<Planner supabaseClient={null} />);
      await waitFor(() => expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument());

      const radioGroup = screen.getByRole("radiogroup", { name: /Select student category/i });
      expect(radioGroup).toBeInTheDocument();

      const maleRadio = screen.getByRole("radio", { name: /^👨?\s*Male students/i });
      const femaleRadio = screen.getByRole("radio", { name: /^👩?\s*Female students/i });

      expect(maleRadio).toHaveAttribute("aria-checked", "true");
      expect(femaleRadio).toHaveAttribute("aria-checked", "false");

      // Verify dynamic counts rendered on badges
      expect(maleRadio).toHaveTextContent("389");
      expect(femaleRadio).toHaveTextContent("540");

      // Click female radio
      fireEvent.click(femaleRadio);

      await waitFor(() => {
        expect(maleRadio).toHaveAttribute("aria-checked", "false");
        expect(femaleRadio).toHaveAttribute("aria-checked", "true");
        expect(window.localStorage.getItem("lemon.selected-category.v1")).toBe("12");
      });

      // Keyboard navigation with ArrowLeft/ArrowRight
      fireEvent.keyDown(femaleRadio, { key: "ArrowLeft" });
      await waitFor(() => {
        expect(maleRadio).toHaveAttribute("aria-checked", "true");
        expect(window.localStorage.getItem("lemon.selected-category.v1")).toBe("11");
      });
    });
  });
});
