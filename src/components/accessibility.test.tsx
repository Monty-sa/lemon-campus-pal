import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { offerings } from "@/data/male-offerings";
import { Planner } from "./planner";

describe("LEMON-051 Phase 6: Accessibility, Keyboard Navigation & ARIA Compliance", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("1. Semantic landmarks: has accessible topbar, main landmark, and search controls", async () => {
    const { container } = render(<Planner data={offerings} />);
    await waitFor(() => {
      expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument();
    });

    const main = container.querySelector("main");
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute("dir", "ltr");
    expect(main).toHaveAttribute("lang", "en");

    // Landmark links
    const brand = screen.getByLabelText("LEMON home");
    expect(brand).toBeInTheDocument();
    expect(brand).toHaveAttribute("href", "#top");
  });

  it("2. Form controls: inputs have accessible names and labels", async () => {
    render(<Planner data={offerings} />);
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Search catalog" })).toBeInTheDocument();
    });

    const searchInput = screen.getByRole("textbox", { name: "Search catalog" });
    expect(searchInput).toBeInTheDocument();

    const planNameInput = screen.getByRole("textbox", { name: "Plan name" });
    expect(planNameInput).toBeInTheDocument();
  });

  it("3. Dropdown menus and dialogs have ARIA attributes", async () => {
    render(<Planner data={offerings} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Download schedule" })).toBeInTheDocument();
    });

    const downloadBtn = screen.getByRole("button", { name: "Download schedule" });
    expect(downloadBtn).toHaveAttribute("aria-haspopup", "menu");
    expect(downloadBtn).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(downloadBtn);
    expect(downloadBtn).toHaveAttribute("aria-expanded", "true");

    const menu = screen.getByRole("menu");
    expect(menu).toBeInTheDocument();

    const pdfOption = screen.getByRole("menuitem", { name: "Download as PDF" });
    expect(pdfOption).toBeInTheDocument();
  });

  it("4. Status announcements: calendar empty state has role='status'", async () => {
    const { container } = render(<Planner data={offerings} />);
    await waitFor(() => {
      expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument();
    });

    const emptyStatus = container.querySelector(".calendar-empty");
    expect(emptyStatus).toBeInTheDocument();
    expect(emptyStatus).toHaveAttribute("role", "status");
  });

  it("5. Arabic locale switches document lang, dir, and localized aria labels", async () => {
    window.localStorage.setItem("lemon.language.v1", "ar");
    const { container } = render(<Planner data={offerings} />);

    await waitFor(() => {
      expect(screen.getAllByText(/دليل التسجيل|التقويم الجامعي|دليل المقررات/)[0]).toBeInTheDocument();
    });

    const main = container.querySelector("main");
    expect(main).toHaveAttribute("dir", "rtl");
    expect(main).toHaveAttribute("lang", "ar");

    const brandAr = screen.getByLabelText("ليمون الرئيسية");
    expect(brandAr).toBeInTheDocument();
  });

  it("6. All actionable buttons have accessible names for screen readers", async () => {
    render(<Planner data={offerings} />);
    await waitFor(() => {
      expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      expect(btn).toHaveAccessibleName();
    }
  });
});
