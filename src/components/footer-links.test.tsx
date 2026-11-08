import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { maleOfferings } from "@/data/offerings";
import { Planner } from "./planner";

describe("LEMON-045 public footer links", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the verified public GitHub and developer Telegram links safely", () => {
    render(<Planner data={maleOfferings} supabaseClient={null} />);

    const github = screen.getByRole("link", { name: "GitHub" });
    expect(github).toHaveAttribute("href", "https://github.com/Monty-sa/lemon-campus-pal");
    expect(github).toHaveAttribute("target", "_blank");
    expect(github).toHaveAttribute("rel", "noopener noreferrer");

    const telegram = screen.getByRole("link", { name: "Contact Me" });
    expect(telegram).toHaveAttribute("href", "https://t.me/Muntadar26");
    expect(telegram).toHaveAttribute("target", "_blank");
    expect(telegram).toHaveAttribute("rel", "noopener noreferrer");

    expect(screen.getByText("Student effort, not official.")).toBeInTheDocument();
  });

  it("localizes the developer contact label in Arabic", async () => {
    render(<Planner data={maleOfferings} supabaseClient={null} />);

    fireEvent.click(screen.getByRole("button", { name: "العربية" }));

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "تواصل معي" })).toHaveAttribute(
        "href",
        "https://t.me/Muntadar26",
      ),
    );
    expect(screen.getByText("جهد طلابي، غير رسمي.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GitHub" })).toBeInTheDocument();
  });
});
