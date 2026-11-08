import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { offerings } from "@/data/offerings";
import { Planner } from "./planner";

describe("Part 7: Interactive Calendar Course Details & Part 9: Semester Selector", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("lemon.onboarding-completed.v1", "true");
    window.localStorage.setItem("lemon.selected-category.v1", "11");
    window.localStorage.setItem("lemon.language.v1", "en");
    document.documentElement.setAttribute("lang", "en");
    document.documentElement.setAttribute("dir", "ltr");
  });

  it("opens Course Details Modal when scheduled calendar block is clicked", async () => {
    // Save a plan with section 63953 (MGMT-201)
    const now = "2026-11-08T00:00:00.000Z";
    window.localStorage.setItem(
      "lemon.schedule-plans.v1",
      JSON.stringify([
        {
          id: "plan-details-test",
          name: "Details Test Plan",
          termId: "144820",
          sectionIds: ["144820:63953"],
          createdAt: now,
          updatedAt: now,
        },
      ]),
    );

    render(<Planner data={offerings} />);
    await waitFor(() => expect(screen.getByText("Browse sections")).toBeInTheDocument());

    // Find scheduled class block in calendar
    const classBlocks = document.querySelectorAll(".class-block");
    expect(classBlocks.length).toBeGreaterThan(0);

    const firstBlock = classBlocks[0] as HTMLButtonElement;
    expect(firstBlock).toHaveAttribute("aria-haspopup", "dialog");

    // Click class block
    fireEvent.click(firstBlock);

    // Modal opens
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/Course & Section Details/i)).toBeInTheDocument();

    // Displays verified course metadata
    expect(within(dialog).getAllByText("202").length).toBeGreaterThanOrEqual(1);
    expect(within(dialog).getByText("63953")).toBeInTheDocument();
    expect(within(dialog).getAllByText("T1").length).toBeGreaterThanOrEqual(1);
    expect(within(dialog).getByText("3 credit hours")).toBeInTheDocument();
    expect(within(dialog).getByText(/Meeting Schedule/i)).toBeInTheDocument();

    // Close on close button
    const closeBtn = within(dialog).getAllByRole("button", { name: "Close" })[0];
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("copies CRN from modal with clipboard interaction", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    const now = "2026-11-08T00:00:00.000Z";
    window.localStorage.setItem(
      "lemon.schedule-plans.v1",
      JSON.stringify([
        {
          id: "plan-crn-copy",
          name: "Copy Test",
          termId: "144820",
          sectionIds: ["144820:63953"],
          createdAt: now,
          updatedAt: now,
        },
      ]),
    );

    render(<Planner data={offerings} />);
    await waitFor(() => expect(screen.getByText("Browse sections")).toBeInTheDocument());

    const firstBlock = document.querySelector(".class-block") as HTMLButtonElement;
    fireEvent.click(firstBlock);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();

    const copyBtn = within(dialog).getByRole("button", { name: /Copy CRN/i });
    fireEvent.click(copyBtn);

    expect(writeText).toHaveBeenCalledWith("63953");
    await waitFor(() => {
      expect(screen.getByText("CRN copied to clipboard! 📋")).toBeInTheDocument();
    });
  });

  it("confirms destructive removal from plan, and cancels cleanly", async () => {
    const now = "2026-11-08T00:00:00.000Z";
    window.localStorage.setItem(
      "lemon.schedule-plans.v1",
      JSON.stringify([
        {
          id: "plan-remove-test",
          name: "Remove Test Plan",
          termId: "144820",
          sectionIds: ["144820:63953"],
          createdAt: now,
          updatedAt: now,
        },
      ]),
    );

    render(<Planner data={offerings} />);
    await waitFor(() => expect(screen.getByText("Browse sections")).toBeInTheDocument());

    const firstBlock = document.querySelector(".class-block") as HTMLButtonElement;
    fireEvent.click(firstBlock);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // Click "Remove from Plan" inside modal
    const removeBtn = within(dialog).getByRole("button", { name: /Remove from Plan/i });
    fireEvent.click(removeBtn);

    // Confirmation box appears
    expect(within(dialog).getByText("Remove this section?")).toBeInTheDocument();
    expect(within(dialog).getByText(/Are you sure you want to remove section T1/i)).toBeInTheDocument();

    // Click Cancel
    const cancelBtn = within(dialog).getByRole("button", { name: "Keep in Plan" });
    fireEvent.click(cancelBtn);

    // Modal remains open, confirmation closed
    expect(within(dialog).queryByText("Remove this section?")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Trigger removal again and confirm
    const removeBtnAgain = within(dialog).getByRole("button", { name: /Remove from Plan/i });
    fireEvent.click(removeBtnAgain);

    const yesRemoveBtn = within(dialog).getByRole("button", { name: "Yes, Remove" });
    fireEvent.click(yesRemoveBtn);

    // Modal closes and section is removed from schedule
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(document.querySelectorAll(".class-block").length).toBe(0);
    });
  });

  it("closes modal on Escape key press", async () => {
    const now = "2026-11-08T00:00:00.000Z";
    window.localStorage.setItem(
      "lemon.schedule-plans.v1",
      JSON.stringify([
        {
          id: "plan-escape-test",
          name: "Escape Test",
          termId: "144820",
          sectionIds: ["144820:63953"],
          createdAt: now,
          updatedAt: now,
        },
      ]),
    );

    render(<Planner data={offerings} />);
    await waitFor(() => expect(screen.getByText("Browse sections")).toBeInTheDocument());

    const firstBlock = document.querySelector(".class-block") as HTMLButtonElement;
    fireEvent.click(firstBlock);

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    // Press Escape
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("renders full localized semester name as clean read-only selector (Part 9)", async () => {
    render(<Planner data={offerings} />);
    await waitFor(() => expect(screen.getByText("Browse sections")).toBeInTheDocument());

    const termSelect = screen.getByRole("combobox", { name: "Semester" });
    expect(termSelect).toBeInTheDocument();
    expect(termSelect).toBeDisabled();
    expect(termSelect).toHaveClass("readonly-term");

    // Full name preserved without codes like 1448B
    expect(termSelect).toHaveTextContent("Second Semester · Academic Year 1448");
    expect(termSelect).not.toHaveTextContent("1448B");
  });
});
