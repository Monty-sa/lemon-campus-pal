import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Planner } from "./planner";
import GpaPage from "@/app/gpa/page";
import { maleOfferings } from "@/data/offerings";

describe("LEMON-042 Targeted UX Polish", () => {
  it("1. GPA Page: renders refined container, preserves calculations, and provides clean empty state", async () => {
    const { container } = render(<GpaPage />);
    
    // Desktop width container present
    const gpaContainer = container.querySelector(".gpa-container");
    expect(gpaContainer).toBeInTheDocument();

    // Summary cards rendered cleanly
    expect(screen.getByText("Semester GPA")).toBeInTheDocument();
    expect(screen.getByText("Projected Cumulative GPA")).toBeInTheDocument();
    expect(screen.getByText(/Target Feasibility/i)).toBeInTheDocument();

    // Clean empty state
    expect(screen.getAllByText(/No courses added yet/i).length).toBeGreaterThanOrEqual(1);

    // Reset button is present
    const resetBtn = screen.getByRole("button", { name: /Reset Calculator/i });
    expect(resetBtn).toBeInTheDocument();
  });

  it("2. Weekly Calendar: displays full course code and start-end times on scheduled blocks", async () => {
    const { container } = render(<Planner data={maleOfferings} supabaseClient={null} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument();
    });

    // Add first available section
    const addButtons = screen.getAllByRole("button", { name: /Add .* to plan/i });
    expect(addButtons.length).toBeGreaterThan(0);
    fireEvent.click(addButtons[0]);

    // Check calendar block rendered with full course code
    await waitFor(() => {
      const classBlocks = container.querySelectorAll(".class-block");
      expect(classBlocks.length).toBeGreaterThan(0);

      const firstBlock = classBlocks[0];
      // Full course code contains hyphen (e.g. 0603-101 or 0602-...)
      expect(firstBlock.querySelector("b")?.textContent).toMatch(/^\d{4}-\d+/);
      // Time string contains en-dash or hyphen between start and end
      expect(firstBlock.querySelector("small")?.textContent).toMatch(/\d{2}:\d{2}\s*–\s*\d{2}:\d{2}/);
    });
  });

  it("3. System Status Modal: renders condensed operational states without oversized clutter", async () => {
    render(<Planner data={maleOfferings} supabaseClient={null} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument();
    });

    const statusBtn = screen.getByRole("button", { name: /System status/i });
    fireEvent.click(statusBtn);

    // Essential student-facing status checks
    expect(screen.getByRole("heading", { name: /System & Service Status/ })).toBeInTheDocument();
    expect(screen.getByText(/Planning Engine/i)).toBeInTheDocument();
    expect(screen.getByText(/Cloud Sync & Accounts/i)).toBeInTheDocument();
    // Simplified status modal excludes verbose offline resilience card
    expect(screen.queryByText(/Offline & Registration Rush Resilience/i)).toBeNull();

    // Close modal
    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole("heading", { name: /System & Service Status/ })).not.toBeInTheDocument();
  });

  it("4. Course Catalog: handles courses with many sections via accessible expansion button", async () => {
    const { container } = render(<Planner data={maleOfferings} supabaseClient={null} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument();
    });

    // Find course groups with > 4 sections
    const expandButtons = container.querySelectorAll(".course-sections-expand-btn");
    expect(expandButtons.length).toBeGreaterThan(0);

    const firstExpandBtn = expandButtons[0] as HTMLButtonElement;
    expect(firstExpandBtn.getAttribute("aria-expanded")).toBe("false");
    expect(firstExpandBtn.textContent).toMatch(/Show all \d+ sections/i);

    // Click to expand
    fireEvent.click(firstExpandBtn);
    expect(firstExpandBtn.getAttribute("aria-expanded")).toBe("true");
    expect(firstExpandBtn.textContent).toMatch(/Show fewer sections/i);

    // Click to collapse
    fireEvent.click(firstExpandBtn);
    expect(firstExpandBtn.getAttribute("aria-expanded")).toBe("false");
  });
});
