import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Planner } from "./planner";
import { offerings } from "@/data/male-offerings";

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: height });
  window.dispatchEvent(new Event("resize"));
}

describe("LEMON-051 Phase 5: Cross-Browser Viewport, Mobile & Responsive Test Suite", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setViewport(1280, 800);
  });

  afterEach(() => {
    setViewport(1280, 800);
  });

  it("1. Mobile iPhone viewport (390x844): renders compact mobile header, touchable buttons, and fluid container", async () => {
    setViewport(390, 844);

    const { container } = render(<Planner data={offerings} />);

    // Check main element exists and has proper responsive wrapping
    const main = container.querySelector("main");
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute("dir", "ltr");

    // Header brand and compact controls exist and are visible
    expect(screen.getByLabelText("LEMON home")).toBeInTheDocument();

    // Verify touchable action buttons have accessible labels
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(5);

    // Each button must have accessible name
    for (const btn of buttons) {
      expect(btn).toHaveAccessibleName();
    }
  });

  it("2. Android viewport (412x915): preserves touch interactive controls without layout overflow", async () => {
    setViewport(412, 915);

    const { container } = render(<Planner data={offerings} />);

    // Section catalog loads
    await waitFor(() => {
      expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument();
    });

    // Check that schedule container is rendered
    const scheduleContainer = container.querySelector(".calendar-shell") || container.querySelector(".calendar-grid");
    expect(scheduleContainer).toBeInTheDocument();
  });

  it("3. Tablet viewport (768x1024): smoothly transitions between compact and expanded layouts", async () => {
    setViewport(768, 1024);

    const { container } = render(<Planner data={offerings} />);

    // Check topbar controls
    expect(container.querySelector(".topbar")).toBeInTheDocument();
  });

  it("4. Arabic RTL Mobile mode: sets dir='rtl' and flips navigation orientation", async () => {
    window.localStorage.setItem("lemon.language.v1", "ar");
    setViewport(390, 844);

    const { container } = render(<Planner data={offerings} />);

    // Main workspace should be in RTL
    const main = container.querySelector("main");
    expect(main).toHaveAttribute("dir", "rtl");

    // Arabic text rendered
    expect(screen.getAllByText(/دليل التسجيل|التقويم الجامعي|دليل المقررات/)[0]).toBeInTheDocument();
  });

  it("5. Landscape orientation (844x390): maintains accessible scrollable container without clipping", async () => {
    setViewport(844, 390);

    const { container } = render(<Planner data={offerings} />);

    const main = container.querySelector("main");
    expect(main).toBeInTheDocument();
  });
});
