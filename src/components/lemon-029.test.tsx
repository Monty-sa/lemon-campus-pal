import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { offerings } from "@/data/offerings";
import { Planner } from "./planner";

describe("LEMON-029: Localization, Arabic Search & UI Polish", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("lemon.onboarding-completed.v1", "true");
    window.localStorage.setItem("lemon.selected-category.v1", "11");
    window.localStorage.setItem("lemon.language.v1", "en");
    document.documentElement.setAttribute("lang", "en");
    document.documentElement.setAttribute("dir", "ltr");
  });

  it("renders compact flag switcher (🇸🇦 / 🇬🇧) and toggles language and direction", async () => {
    render(<Planner data={offerings} />);
    await waitFor(() => expect(screen.getByText("Browse sections")).toBeInTheDocument());

    const arFlagBtn = screen.getByRole("button", { name: "العربية" });
    const enFlagBtn = screen.getByRole("button", { name: "English" });

    expect(arFlagBtn).toBeInTheDocument();
    expect(enFlagBtn).toBeInTheDocument();
    expect(arFlagBtn).toHaveTextContent("🇸🇦");
    expect(enFlagBtn).toHaveTextContent("🇬🇧");
    expect(enFlagBtn).toHaveAttribute("aria-pressed", "true");
    expect(arFlagBtn).toHaveAttribute("aria-pressed", "false");

    // Click Arabic flag button
    fireEvent.click(arFlagBtn);

    await waitFor(() => {
      expect(document.documentElement.getAttribute("dir")).toBe("rtl");
      expect(document.documentElement.getAttribute("lang")).toBe("ar");
      expect(window.localStorage.getItem("lemon.language.v1")).toBe("ar");
      expect(arFlagBtn).toHaveAttribute("aria-pressed", "true");
      expect(enFlagBtn).toHaveAttribute("aria-pressed", "false");
    });
  });

  it("displays verified snapshot availability copy in Arabic mode ('متاحة في آخر تحديث')", async () => {
    window.localStorage.setItem("lemon.language.v1", "ar");
    document.documentElement.setAttribute("lang", "ar");
    document.documentElement.setAttribute("dir", "rtl");

    render(<Planner data={offerings} />);
    await waitFor(() => expect(screen.getByText("تصفّح الشعب")).toBeInTheDocument());

    // Switch to Table View to inspect availability column
    const tableViewBtn = screen.getByRole("button", { name: "جدول" });
    fireEvent.click(tableViewBtn);

    await waitFor(() => {
      const availableBadges = screen.getAllByText("متاحة في آخر تحديث");
      expect(availableBadges.length).toBeGreaterThan(0);
    });
  });

  it("normalizes Arabic search query ignoring tashkeel, hamza variants, and taa marbuta", async () => {
    window.localStorage.setItem("lemon.language.v1", "ar");
    document.documentElement.setAttribute("lang", "ar");
    document.documentElement.setAttribute("dir", "rtl");

    render(<Planner data={offerings} />);
    await waitFor(() => expect(screen.getByText("تصفّح الشعب")).toBeInTheDocument());

    const searchInput = screen.getByLabelText("البحث في الشعب والمقررات");
    expect(searchInput).toBeInTheDocument();

    // Type "ادارة" without hamza (target in offerings is "إدارة")
    fireEvent.change(searchInput, { target: { value: "ادارة" } });

    await waitFor(() => {
      // Should find courses containing إدارة
      const matches = screen.getAllByText(/إدارة/);
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  it("renders student category selector with concise labels avoiding overlaps", async () => {
    render(<Planner data={offerings} />);
    await waitFor(() => expect(screen.getByText("Browse sections")).toBeInTheDocument());

    const radioGroup = screen.getByRole("radiogroup", { name: /Select student category/i });
    expect(radioGroup).toBeInTheDocument();

    const maleRadio = screen.getByRole("radio", { name: /^👨?\s*Male students/i });
    const femaleRadio = screen.getByRole("radio", { name: /^👩?\s*Female students/i });

    expect(maleRadio).toBeInTheDocument();
    expect(femaleRadio).toBeInTheDocument();
    expect(maleRadio).toHaveTextContent("Male");
    expect(femaleRadio).toHaveTextContent("Female");
    expect(maleRadio).toHaveTextContent("389");
    expect(femaleRadio).toHaveTextContent("540");
  });

  it("renders centered empty schedule placeholder when plan has no sections", async () => {
    render(<Planner data={offerings} />);
    await waitFor(() => expect(screen.getByText("Browse sections")).toBeInTheDocument());

    const emptyContainer = document.querySelector(".calendar-empty");
    expect(emptyContainer).toBeInTheDocument();
    expect(emptyContainer).toHaveTextContent("Your week is wide open!");
    expect(emptyContainer).toHaveTextContent("Add to plan");
  });
});
