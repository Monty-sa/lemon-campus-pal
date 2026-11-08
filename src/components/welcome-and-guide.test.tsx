import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { offerings } from "@/data/offerings";
import { getDepartmentLabel } from "@/lib/explorer-filters";
import { CATEGORY_STORAGE_KEY } from "@/lib/storage";
import { LANGUAGE_STORAGE_KEY } from "@/lib/i18n";
import { Planner } from "./planner";

describe("LEMON-024: First-Visit Welcome Setup Onboarding Modal", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("dir");
    document.documentElement.removeAttribute("lang");
  });

  it("shows onboarding modal on first visit when preferences are missing", async () => {
    render(<Planner data={offerings} />);

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /Hey, pal! Let's get you set up/i })).toBeInTheDocument();
    });

    // Language options visible
    expect(screen.getByRole("button", { name: /Select language: English/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Select language: العربية/i })).toBeInTheDocument();

    // Student category options visible
    expect(screen.getByRole("button", { name: /Select category: Male students/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Select category: Female students/i })).toBeInTheDocument();

    // Gender is NOT preselected; Get Started button is disabled
    const finishBtn = screen.getByRole("button", { name: "Get Started →" });
    expect(finishBtn).toBeDisabled();
    expect(screen.getByText(/Please choose your category to continue/i)).toBeInTheDocument();
  });

  it("switches language and RTL dynamically within onboarding, then confirms preferences", async () => {
    render(<Planner data={offerings} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Hey, pal! Let's get you set up/i })).toBeInTheDocument();
    });

    // Switch to Arabic inside onboarding
    const arabicChoiceBtn = screen.getByRole("button", { name: /Select language: العربية/i });
    fireEvent.click(arabicChoiceBtn);

    await waitFor(() => {
      expect(document.documentElement.getAttribute("dir")).toBe("rtl");
      expect(document.documentElement.getAttribute("lang")).toBe("ar");
      expect(screen.getByRole("heading", { name: /هلا والله! خلنا نضبط ليمون على جوّك/i })).toBeInTheDocument();
    });

    // Select Female students
    const femaleChoiceBtn = screen.getByRole("button", { name: /اختر فئة الطلاب: طالبات/i });
    fireEvent.click(femaleChoiceBtn);

    // Get Started button (Arabic) is now enabled
    const finishBtnAr = screen.getByRole("button", { name: "يلا نبدأ ←" });
    expect(finishBtnAr).toBeEnabled();

    fireEvent.click(finishBtnAr);

    // Modal closes and preferences are persisted
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /هلا والله! خلنا نضبط ليمون على جوّك/i })).not.toBeInTheDocument();
      expect(window.localStorage.getItem(CATEGORY_STORAGE_KEY)).toBe("12");
      expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("ar");
      expect(window.localStorage.getItem("lemon.onboarding-completed.v1")).toBe("true");
    });
  });

  it("does not show onboarding modal for returning users with saved preferences", async () => {
    window.localStorage.setItem(CATEGORY_STORAGE_KEY, "11");
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");

    render(<Planner data={offerings} />);

    await waitFor(() => {
      expect(screen.getByText("Browse sections")).toBeInTheDocument();
    });

    expect(screen.queryByRole("heading", { name: /Hey, pal! Let's get you set up/i })).not.toBeInTheDocument();
  });

  it("reopens welcome setup anytime via topbar button and footer link", async () => {
    window.localStorage.setItem("lemon.onboarding-completed.v1", "true");
    window.localStorage.setItem(CATEGORY_STORAGE_KEY, "11");

    render(<Planner data={offerings} />);

    await waitFor(() => {
      expect(screen.getByText("Browse sections")).toBeInTheDocument();
    });

    const [topbarSetupBtn, footerSetupBtn] = screen.getAllByRole("button", { name: /Open welcome setup preferences/i });
    expect(topbarSetupBtn).toBeInTheDocument();
    expect(footerSetupBtn).toBeInTheDocument();

    // Reopen via topbar button
    fireEvent.click(topbarSetupBtn);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Hey, pal! Let's get you set up/i })).toBeInTheDocument();
    });

    // Close via close button
    const closeBtn = screen.getByRole("button", { name: "Close welcome setup" });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /Hey, pal! Let's get you set up/i })).not.toBeInTheDocument();
    });

    // Reopen via footer link
    fireEvent.click(footerSetupBtn);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Hey, pal! Let's get you set up/i })).toBeInTheDocument();
    });
  });
});

describe("LEMON-026: KFU Registration Guidance Modal", () => {
  beforeEach(() => {
    window.localStorage.setItem("lemon.onboarding-completed.v1", "true");
    window.localStorage.setItem(CATEGORY_STORAGE_KEY, "11");
  });

  it("opens registration guide and displays status signals, section letters, and official weekday codes", async () => {
    render(<Planner data={offerings} />);

    await waitFor(() => {
      expect(screen.getByText("Browse sections")).toBeInTheDocument();
    });

    const guideBtn = screen.getByRole("button", { name: "Open KFU Registration Guide" });
    fireEvent.click(guideBtn);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "KFU Registration Guide 📚" })).toBeInTheDocument();
    });

    // Availability explanations
    expect(screen.getByText("Green / Available")).toBeInTheDocument();
    expect(screen.getByText(/subject to final KFU Banner confirmation/i)).toBeInTheDocument();
    expect(screen.getByText("Red / Unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Do not rely on this section for your primary registration plan/i)).toBeInTheDocument();

    // Section letters
    expect(screen.getByText(/K sections: Designated for male students/i)).toBeInTheDocument();
    expect(screen.getByText(/H & Y sections: Designated for female students/i)).toBeInTheDocument();

    // Official KFU single-letter day codes
    expect(screen.getByText("ح")).toBeInTheDocument();
    expect(screen.getByText("ن")).toBeInTheDocument();
    expect(screen.getByText("ث")).toBeInTheDocument();
    expect(screen.getByText("ر")).toBeInTheDocument();
    expect(screen.getByText("خ")).toBeInTheDocument();

    // Close guide
    const closeBtn = screen.getAllByRole("button", { name: "Close registration guide" })[0];
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "KFU Registration Guide 📚" })).not.toBeInTheDocument();
    });
  });
});

describe("LEMON-022: Polished Footer Tagline & Disclaimer", () => {
  beforeEach(() => {
    window.localStorage.setItem("lemon.onboarding-completed.v1", "true");
    window.localStorage.setItem(CATEGORY_STORAGE_KEY, "11");
  });

  it("renders verified English footer tagline and independent student disclaimer", async () => {
    render(<Planner data={offerings} />);

    await waitFor(() => {
      expect(screen.getByText("Browse sections")).toBeInTheDocument();
    });

    expect(screen.getByText("Made by a KFU student, for KFU students. 🍋")).toBeInTheDocument();
    expect(screen.getByText("Student effort, not official.")).toBeInTheDocument();
  });
});

describe("LEMON-028: Final Department Mapping Verification", () => {
  it("maps all verified KFU college departments correctly in English and Arabic", () => {
    expect(getDepartmentLabel("0602", "en")).toBe("0602 · Management");
    expect(getDepartmentLabel("0602", "ar")).toBe("0602 · الإدارة");

    expect(getDepartmentLabel("0603", "en")).toBe("0603 · Accounting");
    expect(getDepartmentLabel("0603", "ar")).toBe("0603 · المحاسبة");

    expect(getDepartmentLabel("0604", "en")).toBe("0604 · Finance");
    expect(getDepartmentLabel("0604", "ar")).toBe("0604 · المالية");

    expect(getDepartmentLabel("0605", "en")).toBe("0605 · Economics");
    expect(getDepartmentLabel("0605", "ar")).toBe("0605 · الاقتصاد");

    expect(getDepartmentLabel("0606", "en")).toBe("0606 · Quantitative Methods");
    expect(getDepartmentLabel("0606", "ar")).toBe("0606 · الأساليب الكمية");

    expect(getDepartmentLabel("0607", "en")).toBe("0607 · Management Info Systems");
    expect(getDepartmentLabel("0607", "ar")).toBe("0607 · نظم المعلومات الإدارية");

    expect(getDepartmentLabel("0608", "en")).toBe("0608 · Law");
    expect(getDepartmentLabel("0608", "ar")).toBe("0608 · القانون");

    expect(getDepartmentLabel("0673", "en")).toBe("0673 · Management (Applied)");
    expect(getDepartmentLabel("0674", "en")).toBe("0674 · Accounting (Applied)");
    expect(getDepartmentLabel("0675", "en")).toBe("0675 · Finance (Applied)");
    expect(getDepartmentLabel("0676", "en")).toBe("0676 · Quantitative Methods (Applied)");
    expect(getDepartmentLabel("0677", "en")).toBe("0677 · Info Systems (Applied)");
    expect(getDepartmentLabel("0678", "en")).toBe("0678 · Economics (Applied)");

    // Graceful fallback for unknown department
    expect(getDepartmentLabel("9999", "en")).toBe("Dept 9999");
  });
});
