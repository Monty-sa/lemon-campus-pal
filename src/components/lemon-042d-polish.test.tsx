import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Planner } from "./planner";
import { maleOfferings } from "@/data/offerings";
import { getTranslations } from "@/lib/i18n";

describe("LEMON-042D: Compact Data & Privacy Modal UX", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("1. Displays concise one-sentence description and two equal primary action buttons", async () => {
    const en = getTranslations("en");
    expect(en.dataPrivacy.guestDescription).toBe(
      "Your schedules are saved on this device. Download a backup or restore it on another device."
    );

    const ar = getTranslations("ar");
    expect(ar.dataPrivacy.guestDescription).toBe(
      "جداولك محفوظة على هذا الجهاز. يمكنك حفظ نسخة احتياطية أو استعادتها على جهاز آخر."
    );

    render(<Planner data={maleOfferings} supabaseClient={null} />);

    // Open Data & Privacy dialog
    const privacyBtn = screen.getAllByRole("button", { name: /data & privacy|البيانات والخصوصية/i })[0];
    fireEvent.click(privacyBtn);

    // Modal subtitle matches the concise one-sentence explanation
    expect(
      screen.getByText("Your schedules are saved on this device. Download a backup or restore it on another device.")
    ).toBeInTheDocument();

    // Two primary buttons exist
    const downloadBtn = screen.getByRole("button", { name: /download backup|حفظ نسخة احتياطية/i });
    const restoreBtn = screen.getByRole("button", { name: /restore backup|استعادة نسخة/i });
    expect(downloadBtn).toBeInTheDocument();
    expect(restoreBtn).toBeInTheDocument();
    expect(downloadBtn.classList.contains("data-privacy-action-btn")).toBe(true);
    expect(restoreBtn.classList.contains("data-privacy-action-btn")).toBe(true);

    // Subtle privacy note
    expect(screen.getByText(/Backup files are unencrypted text\. Keep your backup private\./i)).toBeInTheDocument();
  });

  it("2. Keeps Delete My Data in a collapsed secondary section with explicit confirmation", async () => {
    render(<Planner data={maleOfferings} supabaseClient={null} />);

    // Open Data & Privacy dialog
    const privacyBtn = screen.getAllByRole("button", { name: /data & privacy|البيانات والخصوصية/i })[0];
    fireEvent.click(privacyBtn);

    // Collapsed danger summary is present
    const dangerSummary = screen.getByText(/delete my data|حذف بياناتي/i);
    expect(dangerSummary).toBeInTheDocument();

    // Confirmation button is inside details
    fireEvent.click(dangerSummary);
    const confirmDeleteBtn = screen.getByRole("button", { name: /yes, delete everything|نعم، احذف كل بياناتي/i });
    expect(confirmDeleteBtn).toBeInTheDocument();

    fireEvent.click(confirmDeleteBtn);

    // Toast feedback appears
    await waitFor(() => {
      expect(document.querySelector(".toast")).toHaveTextContent(/guest data cleared|تم مسح بيانات/i);
    });
  });
});

describe("LEMON Final Timetable Polish", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("1. Calendar typography: renders clean, larger course codes, titles, and time blocks", async () => {
    const { container } = render(<Planner data={maleOfferings} supabaseClient={null} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument();
    });

    // Add first available section with meetings
    const addButtons = screen.getAllByRole("button", { name: /Add .* to plan/i });
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      const classBlocks = container.querySelectorAll(".class-block");
      expect(classBlocks.length).toBeGreaterThan(0);

      const block = classBlocks[0];
      const codeEl = block.querySelector("b");
      const titleEl = block.querySelector("span");
      const timeEl = block.querySelector("small");

      expect(codeEl).toBeInTheDocument();
      expect(titleEl).toBeInTheDocument();
      expect(timeEl).toBeInTheDocument();

      // Course code is structured and not empty
      expect(codeEl?.textContent?.trim().length).toBeGreaterThan(0);
      // Time format is start - end
      expect(timeEl?.textContent).toMatch(/\d{2}:\d{2}\s*–\s*\d{2}:\d{2}/);
    });
  });

  it("2. Compact CRN section beneath timetable renders visible chips and compact container", async () => {
    const { container } = render(<Planner data={maleOfferings} supabaseClient={null} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument();
    });

    // Summary strip exists and has compact container class
    const summaryStrip = container.querySelector(".summary-strip");
    expect(summaryStrip).toBeInTheDocument();

    // Copy button exists inside summary strip
    const copyBtn = summaryStrip?.querySelector(".copy-button");
    expect(copyBtn).toBeInTheDocument();
  });

  it("3. Copy CRNs uses exactly the active plan's unique CRNs and provides copy feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    render(<Planner data={maleOfferings} supabaseClient={null} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument();
    });

    // Add sections
    const addButtons = screen.getAllByRole("button", { name: /Add .* to plan/i });
    fireEvent.click(addButtons[0]);
    fireEvent.click(addButtons[1]);

    const copyBtn = screen.getByRole("button", { name: /copy crns|نسخ أرقام/i });
    expect(copyBtn).toBeEnabled();

    fireEvent.click(copyBtn);

    // Verify clipboard.writeText was called
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
      const copiedString = writeText.mock.calls[0][0];
      // Format is registration-compatible space-separated CRNs
      expect(copiedString).toMatch(/^\d{5}(\s+\d{5})*$/);
      // Verify all copied CRNs are unique
      const crns = copiedString.split(" ");
      const uniqueCrns = Array.from(new Set(crns));
      expect(crns.length).toBe(uniqueCrns.length);
    });

    // Toast feedback appears
    await waitFor(() => {
      expect(document.querySelector(".toast")).toHaveTextContent(/copied|تم النسخ/i);
    });
  });
});
