import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { offerings } from "@/data/offerings";
import { AutoSchedulePanel } from "./auto-schedule-panel";

describe("AutoSchedulePanel", () => {
  it("renders course selection, hard constraints, and localized controls", () => {
    render(<AutoSchedulePanel data={offerings} lang="en" onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Generate schedules" }));
    expect(screen.getByText("Select at least two courses.")).toBeInTheDocument();
    expect(screen.getByLabelText("Courses")).toBeInTheDocument();
    expect(screen.getByText("Hard earliest start")).toBeInTheDocument();
    expect(screen.getByText("Preferred start (soft)")).toBeInTheDocument();
  });

  it("selects, chips, and removes courses interactively", () => {
    render(<AutoSchedulePanel data={offerings} lang="en" onSave={vi.fn()} />);

    // Click on the first course button in the picker
    const courseButtons = screen.getAllByRole("button", { name: /202|207|302/ });
    expect(courseButtons.length).toBeGreaterThan(0);
    fireEvent.click(courseButtons[0]);

    // Check that selected course tray displays count 1 and a remove button
    expect(screen.getAllByText("Selected Courses (1)").length).toBeGreaterThan(0);
    const removeBtn = screen.getByLabelText(/Remove/);
    expect(removeBtn).toBeInTheDocument();

    // Click remove button
    fireEvent.click(removeBtn);
    expect(screen.getAllByText("Selected Courses (0)").length).toBeGreaterThan(0);
  });

  it("filters courses with normalized search input", () => {
    render(<AutoSchedulePanel data={offerings} lang="en" onSave={vi.fn()} />);
    const searchInput = screen.getByLabelText("Courses");
    fireEvent.change(searchInput, { target: { value: "Supply Chain" } });
    expect(screen.getByText(/Supply Chain/)).toBeInTheDocument();
  });

  it("toggles day off chips and resets preferences", () => {
    render(<AutoSchedulePanel data={offerings} lang="en" onSave={vi.fn()} />);
    const sunChip = screen.getByRole("button", { name: /^Sunday/ });
    expect(sunChip).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(sunChip);
    expect(sunChip).toHaveAttribute("aria-pressed", "true");

    // Click reset preferences
    const resetBtn = screen.getByRole("button", { name: /Reset Preferences/i });
    fireEvent.click(resetBtn);
    expect(sunChip).toHaveAttribute("aria-pressed", "false");
  });

  it("generates schedules when 2 courses are picked and saves as new plan", async () => {
    const handleSave = vi.fn();
    render(<AutoSchedulePanel data={offerings} lang="en" onSave={handleSave} />);

    // Select 2 courses
    const courseButtons = screen.getAllByRole("button", { name: /202|207|302/ });
    fireEvent.click(courseButtons[0]);
    fireEvent.click(courseButtons[1]);

    expect(screen.getAllByText("Selected Courses (2)").length).toBeGreaterThan(0);

    // Uncheck "Exclude snapshot-closed sections" to allow all section combinations
    const openOnlyCheckbox = screen.getByLabelText(/Exclude snapshot-closed sections/);
    fireEvent.click(openOnlyCheckbox);

    // Click generate
    const generateBtn = screen.getByRole("button", { name: "Generate schedules" });
    fireEvent.click(generateBtn);

    // Wait for results
    await waitFor(() => {
      expect(screen.getByText(/Found \d+ conflict-free schedule options/)).toBeInTheDocument();
    });

    // Check mini-timetable preview exists
    expect(screen.getAllByText("Weekly Timetable Preview").length).toBeGreaterThan(0);

    // Save as new plan
    const saveBtn = screen.getAllByRole("button", { name: /Save as New Plan/i })[0];
    fireEvent.click(saveBtn);

    expect(handleSave).toHaveBeenCalledTimes(1);
    const savedPlan = handleSave.mock.calls[0][0];
    expect(savedPlan.id).toBeDefined();
    expect(savedPlan.sectionIds.length).toBeGreaterThan(0);
    expect(savedPlan.termId).toBe(offerings.term.id);
  });

  it("renders in Arabic RTL mode with Saudi-tailored translations", () => {
    render(<AutoSchedulePanel data={offerings} lang="ar" onSave={vi.fn()} />);

    const panel = screen.getByRole("region", { name: "✨ أنشئ جدولك تلقائيًا" });
    expect(panel).toHaveAttribute("dir", "rtl");
    expect(screen.getByText("اختر المقررات")).toBeInTheDocument();
    expect(screen.getByText("تخصيص الجدول والتفضيلات")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "أنشئ جدولًا" })).toBeInTheDocument();
  });

  it("displays all unique imported courses without slicing and filters by department", () => {
    render(<AutoSchedulePanel data={offerings} lang="en" onSave={vi.fn()} />);

    // Total course count text
    expect(screen.getByText(`Catalog: ${offerings.courses.length} of ${offerings.courses.length} courses`)).toBeInTheDocument();

    // Department filter
    const deptSelect = screen.getByLabelText("Department");
    expect(deptSelect).toBeInTheDocument();

    // Filter to Management (0602)
    fireEvent.change(deptSelect, { target: { value: "0602" } });
    const managementCoursesCount = offerings.courses.filter(c => (c.departmentId ?? c.code.split("-")[0]) === "0602").length;
    expect(screen.getByText(`Catalog: ${managementCoursesCount} of ${offerings.courses.length} courses`)).toBeInTheDocument();

    // Reset filters
    const resetFiltersBtn = screen.getByRole("button", { name: /Reset filters/i });
    fireEvent.click(resetFiltersBtn);
    expect(screen.getByText(`Catalog: ${offerings.courses.length} of ${offerings.courses.length} courses`)).toBeInTheDocument();
  });

  it("preserves selected course chips when filtering and distinguishes scheduling eligibility", () => {
    render(<AutoSchedulePanel data={offerings} lang="en" onSave={vi.fn()} />);

    // Pick 0602-202 (Operations Management)
    const courseBtn = screen.getByRole("button", { name: /0602-202/ });
    fireEvent.click(courseBtn);
    expect(screen.getAllByText("Selected Courses (1)").length).toBeGreaterThan(0);

    // Filter by department 0603 (Accounting), which hides 0602-202 from the picker list
    const deptSelect = screen.getByLabelText("Department");
    fireEvent.change(deptSelect, { target: { value: "0603" } });

    // The selected tray STILL preserves 0602-202!
    expect(screen.getAllByText("Selected Courses (1)").length).toBeGreaterThan(0);
    expect(screen.getByText(/Operations Management/)).toBeInTheDocument();

    // Check eligibility badges exist in the catalog (e.g. Snapshot full or sec eligible)
    const eligibilityBadges = screen.getAllByTitle(/Snapshot full|Eligible|All sections full/i);
    expect(eligibilityBadges.length).toBeGreaterThan(0);
  });
});
