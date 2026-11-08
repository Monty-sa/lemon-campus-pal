import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import GpaPage, { GPA_DRAFT_STORAGE_KEY } from "./page";
import { GPA_SCENARIOS_STORAGE_KEY } from "@/lib/gpa/calculator";
import { saveGuestPlans } from "@/lib/storage";
import { maleOfferings } from "@/data/offerings";

describe("KFU GPA Calculator Standalone Page (LEMON-017 & Part 8 UX)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders with clean, empty initial state without hardcoded defaults or NaN (Part 8 UX)", async () => {
    render(<GpaPage />);

    // Renamed heading
    expect(screen.getByRole("heading", { name: /Calculate My GPA/i })).toBeInTheDocument();
    expect(screen.getByText(/KFU Official 5.0 Grading Scale/)).toBeInTheDocument();

    // Metric cards show clean pending state (—) rather than misleading zero or warning GPA
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(3);

    // Inputs are clean and empty with placeholder guidance
    const priorGpaInput = screen.getByLabelText(/Prior Cumulative GPA/i) as HTMLInputElement;
    const priorHoursInput = screen.getByLabelText(/Prior Completed Credit Hours/i) as HTMLInputElement;
    const targetGpaInput = screen.getByLabelText(/Target Cumulative GPA/i) as HTMLInputElement;

    expect(priorGpaInput.value).toBe("");
    expect(priorHoursInput.value).toBe("");
    expect(targetGpaInput.value).toBe("");

    // Empty courses placeholder is rendered
    expect(screen.getAllByText(/No courses added yet/i).length).toBeGreaterThanOrEqual(1);
  });

  it("calculates Semester GPA dynamically when courses are added and modified", async () => {
    render(<GpaPage />);

    // Add first course: 3 credits, A+ (5.0)
    const addBtn = screen.getAllByRole("button", { name: "+ Add Course" })[0];
    fireEvent.click(addBtn);

    const creditsSelects = screen.getAllByLabelText("Course credits");
    const gradeSelects = screen.getAllByLabelText("Course grade");

    expect(creditsSelects.length).toBe(1);
    expect(gradeSelects.length).toBe(1);

    // Initial 1 course with 3 cr @ A+ gives 5.00
    await waitFor(() => {
      expect(screen.getAllByText("5.00").length).toBeGreaterThanOrEqual(1);
    });

    // Change grade to D (2.0)
    fireEvent.change(gradeSelects[0], { target: { value: "D" } });

    await waitFor(() => {
      expect(screen.getAllByText("2.00").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("calculates target GPA feasibility dynamically when history and targets are entered", async () => {
    render(<GpaPage />);

    // Add 1 course of 6 credits
    const addBtn = screen.getAllByRole("button", { name: "+ Add Course" })[0];
    fireEvent.click(addBtn);
    const creditsSelect = screen.getByLabelText("Course credits");
    fireEvent.change(creditsSelect, { target: { value: "6" } });

    // Prior history: 30 hours @ 4.00
    const priorGpaInput = screen.getByLabelText(/Prior Cumulative GPA/i);
    const priorHoursInput = screen.getByLabelText(/Prior Completed Credit Hours/i);
    fireEvent.change(priorGpaInput, { target: { value: "4.00" } });
    fireEvent.change(priorHoursInput, { target: { value: "30" } });

    const targetInput = screen.getByLabelText(/Target Cumulative GPA/i);

    // Impossible target
    fireEvent.change(targetInput, { target: { value: "4.95" } });
    await waitFor(() => {
      expect(screen.getAllByText(/Mathematically impossible/i).length).toBeGreaterThan(0);
      expect(screen.getByText("Impossible")).toBeInTheDocument();
    });

    // Achievable target (4.05 with 30h @ 4.00 and 6 cr requires 4.30)
    fireEvent.change(targetInput, { target: { value: "4.05" } });
    await waitFor(() => {
      expect(screen.getAllByText(/Achievable:/i).length).toBeGreaterThan(0);
    });
  });

  it("persists draft work to localStorage and reloads it cleanly on visit", async () => {
    // Pre-populate draft
    const draft = {
      prevHours: 45,
      prevGpa: 3.85,
      targetGpa: 4.10,
      courses: [
        { id: "c-draft-1", code: "ACCT-101", credits: 3, grade: "A" },
      ],
    };
    window.localStorage.setItem(GPA_DRAFT_STORAGE_KEY, JSON.stringify(draft));

    render(<GpaPage />);

    const priorGpaInput = screen.getByLabelText(/Prior Cumulative GPA/i) as HTMLInputElement;
    const priorHoursInput = screen.getByLabelText(/Prior Completed Credit Hours/i) as HTMLInputElement;
    const targetGpaInput = screen.getByLabelText(/Target Cumulative GPA/i) as HTMLInputElement;

    expect(priorGpaInput.value).toBe("3.85");
    expect(priorHoursInput.value).toBe("45");
    expect(targetGpaInput.value).toBe("4.1");
    expect(screen.getByDisplayValue("ACCT-101")).toBeInTheDocument();
  });

  it("requires confirmation to reset calculator when data exists, and cancels cleanly", async () => {
    render(<GpaPage />);

    // Add data
    const addBtn = screen.getAllByRole("button", { name: "+ Add Course" })[0];
    fireEvent.click(addBtn);

    const resetBtn = screen.getByRole("button", { name: /Reset Calculator/i });
    expect(resetBtn).toBeInTheDocument();

    // Click reset -> opens confirmation modal
    fireEvent.click(resetBtn);

    expect(screen.getByRole("heading", { name: "Reset GPA Calculator?" })).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to clear your current calculations/i)).toBeInTheDocument();

    // Cancel reset
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Reset GPA Calculator?" })).not.toBeInTheDocument();
    });

    // Data should remain intact
    expect(screen.getAllByLabelText("Course credits").length).toBe(1);
  });

  it("resets all calculations, clears draft storage, and preserves saved scenarios", async () => {
    // Save an independent scenario
    const existingScenarios = [
      {
        id: "scen-preserve-1",
        name: "My Cherished Scenario",
        previousGpa: 4.2,
        previousHours: 60,
        courses: [{ id: "c-1", code: "FIN-201", credits: 3, grade: "A+" }],
        updatedAt: new Date().toISOString(),
      },
    ];
    window.localStorage.setItem(GPA_SCENARIOS_STORAGE_KEY, JSON.stringify(existingScenarios));

    render(<GpaPage />);

    // Enter draft data
    const priorGpaInput = screen.getByLabelText(/Prior Cumulative GPA/i);
    fireEvent.change(priorGpaInput, { target: { value: "3.50" } });

    const addBtn = screen.getAllByRole("button", { name: "+ Add Course" })[0];
    fireEvent.click(addBtn);

    // Verify scenario is rendered in list
    expect(screen.getByText("My Cherished Scenario")).toBeInTheDocument();

    // Trigger reset
    const resetBtn = screen.getByRole("button", { name: /Reset Calculator/i });
    fireEvent.click(resetBtn);

    // Confirm reset
    const confirmBtn = screen.getByRole("button", { name: "Yes, Reset" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/Calculator reset to clean state/i)).toBeInTheDocument();
    });

    // Inputs and courses should now be empty
    expect((priorGpaInput as HTMLInputElement).value).toBe("");
    expect(screen.getAllByText(/No courses added yet/i).length).toBeGreaterThanOrEqual(1);

    // Draft storage should be cleared
    expect(window.localStorage.getItem(GPA_DRAFT_STORAGE_KEY)).toBeNull();

    // Saved scenario MUST BE PRESERVED
    expect(screen.getByText("My Cherished Scenario")).toBeInTheDocument();
    const storedScenarios = JSON.parse(window.localStorage.getItem(GPA_SCENARIOS_STORAGE_KEY) || "[]");
    expect(storedScenarios.length).toBe(1);
    expect(storedScenarios[0].name).toBe("My Cherished Scenario");
  });

  it("skips confirmation when reset is clicked on an already-empty calculator", async () => {
    render(<GpaPage />);

    const resetBtn = screen.getByRole("button", { name: /Reset Calculator/i });
    fireEvent.click(resetBtn);

    // Modal should NOT open
    expect(screen.queryByRole("heading", { name: "Reset GPA Calculator?" })).not.toBeInTheDocument();
  });

  it("imports unique courses from saved schedule and deduplicates multiple sections (LEMON-033 P1-4)", async () => {
    // Plan with 2 sections of 0602-499 and 1 section of 0602-202
    const samplePlan = {
      id: "plan-1",
      name: "Fall Schedule",
      termId: "144820",
      sectionIds: [
        "144820:53318", // 0602-499
        "144820:53930", // 0602-499 (same course)
        maleOfferings.sections[0].id, // 0602-202 (different course)
      ],
      createdAt: "2026-11-07T00:00:00.000Z",
      updatedAt: "2026-11-07T00:00:00.000Z",
    };

    saveGuestPlans(window.localStorage, [samplePlan]);

    render(<GpaPage />);

    // Click Import from My Schedule
    const importBtn = screen.getAllByRole("button", { name: /Import from My Schedule/i })[0];
    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(screen.getByText(/Imported 2 courses from your schedule/i)).toBeInTheDocument();
    });

    // Verify 2 courses were imported (deduplicated from 3 sections)
    const courseInputs = screen.getAllByLabelText("Course name") as HTMLInputElement[];
    expect(courseInputs.length).toBe(2);

    // Course codes should include the course codes
    expect(courseInputs.some((input) => input.value.includes("0602-499"))).toBe(true);
    expect(courseInputs.some((input) => input.value.includes("0602-202"))).toBe(true);

    // Projected grades should remain blank for student entry
    const gradeSelects = screen.getAllByLabelText("Course grade") as HTMLSelectElement[];
    expect(gradeSelects[0].value).toBe("");
    expect(gradeSelects[1].value).toBe("");
  });

  it("prompts with options to Replace or Merge when importing into a populated draft", async () => {
    // Populate draft with 1 course
    const existingCourse = { id: "c-exist", code: "OLD-100", credits: 3, grade: "A+" as const };
    window.localStorage.setItem(
      GPA_DRAFT_STORAGE_KEY,
      JSON.stringify({ courses: [existingCourse] }),
    );

    const samplePlan = {
      id: "plan-2",
      name: "Spring Dream",
      termId: "144820",
      sectionIds: [maleOfferings.sections[0].id],
      createdAt: "2026-11-07T00:00:00.000Z",
      updatedAt: "2026-11-07T00:00:00.000Z",
    };
    saveGuestPlans(window.localStorage, [samplePlan]);

    render(<GpaPage />);

    // Existing course should be rendered
    expect((screen.getByLabelText("Course name") as HTMLInputElement).value).toBe("OLD-100");

    // Click Import
    const importBtn = screen.getByRole("button", { name: /Import from My Schedule/i });
    fireEvent.click(importBtn);

    // Import confirmation dialog should appear with Replace and Merge options
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Import Courses from Active Schedule/i })).toBeInTheDocument();
    });

    // Select Merge radio option
    const mergeRadio = screen.getByLabelText(/Add new courses to current draft/i);
    fireEvent.click(mergeRadio);

    // Confirm import
    const confirmBtn = screen.getByRole("button", { name: /Import 1 Courses/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/Imported 1 courses from your schedule/i)).toBeInTheDocument();
    });

    // Both old course and imported course should now be present
    const courseInputs = screen.getAllByLabelText("Course name") as HTMLInputElement[];
    expect(courseInputs.length).toBe(2);
    expect(courseInputs[0].value).toBe("OLD-100");
    expect(courseInputs[1].value).toContain("0602-202");
  });
});
