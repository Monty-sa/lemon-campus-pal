import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Planner } from "./planner";
import { CourseDetailsModal } from "./course-details-modal";
import { maleOfferings } from "@/data/offerings";
import { getTranslations } from "@/lib/i18n";

describe("LEMON-044: Student Professor Experiences", () => {
  const TELEGRAM_URL = "https://t.me/+br6ivC0jUog2MTQ0";

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("1. Dictionary contains exact Arabic and English copy for student professor community", () => {
    const ar = getTranslations("ar");
    expect(ar.community.heading).toBe("تبي تعرف الدكتور أكثر؟ 👀");
    expect(ar.community.description).toBe("شوف تجارب طلاب الكلية وآراءهم عن الدكاترة قبل تختار شعبتك.");
    expect(ar.community.button).toBe("شوف تجارب الطلاب");
    expect(ar.community.disclaimer).toContain("مجتمع طلابي مستقل");

    const en = getTranslations("en");
    expect(en.community.heading).toBe("Want to know more about your professor?");
    expect(en.community.description).toBe(
      "Explore experiences shared by fellow Business students before choosing a section."
    );
    expect(en.community.button).toBe("Explore Student Experiences");
    expect(en.community.disclaimer).toContain("Independent student community");
  });

  it("2. Planner renders community card with external link security attributes", () => {
    render(<Planner data={maleOfferings} supabaseClient={null} />);

    // The community card exists
    const headings = screen.getAllByRole("heading", { name: /Want to know more about your professor\?|تبي تعرف الدكتور أكثر؟/i });
    expect(headings.length).toBeGreaterThan(0);

    // Link has safe attributes
    const communityLinks = screen.getAllByRole("link", { name: /Explore Student Experiences|شوف تجارب الطلاب/i });
    expect(communityLinks.length).toBeGreaterThan(0);
    const mainBtn = communityLinks[0];
    expect(mainBtn).toHaveAttribute("href", TELEGRAM_URL);
    expect(mainBtn).toHaveAttribute("target", "_blank");
    expect(mainBtn).toHaveAttribute("rel", "noopener noreferrer");

    // Independent disclaimer is visible
    expect(screen.getByText(/Independent student community|مجتمع طلابي مستقل/i)).toBeInTheDocument();
  });

  it("3. Instructor subtle link is rendered in section details", () => {
    render(<Planner data={maleOfferings} supabaseClient={null} />);

    const instructorLinks = screen.getAllByTitle(/View student experiences on Telegram|اطّلع على تجارب الطلاب في تيليجرام/i);
    expect(instructorLinks.length).toBeGreaterThan(0);

    for (const link of instructorLinks) {
      expect(link).toHaveAttribute("href", TELEGRAM_URL);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("4. CourseDetailsModal renders subtle link when instructor is present", () => {
    const t = getTranslations("en");
    const testCourse = maleOfferings.courses[0];
    const testSection = maleOfferings.sections[0];

    const { rerender } = render(
      <CourseDetailsModal
        isOpen={true}
        onClose={() => {}}
        course={testCourse}
        section={testSection}
        lang="en"
        t={t}
        onRemoveSection={() => {}}
        onCopyCrn={() => {}}
      />
    );

    if (testSection.instructor?.name) {
      const modalLink = screen.getByTitle("View student experiences on Telegram (independent student community)");
      expect(modalLink).toBeInTheDocument();
      expect(modalLink).toHaveAttribute("href", TELEGRAM_URL);
      expect(modalLink).toHaveAttribute("target", "_blank");
      expect(modalLink).toHaveAttribute("rel", "noopener noreferrer");
    }

    // When instructor is undefined, no link should be rendered
    const sectionWithoutInstructor = { ...testSection, instructor: undefined };
    rerender(
      <CourseDetailsModal
        isOpen={true}
        onClose={() => {}}
        course={testCourse}
        section={sectionWithoutInstructor}
        lang="en"
        t={t}
        onRemoveSection={() => {}}
        onCopyCrn={() => {}}
      />
    );
    expect(screen.queryByTitle("View student experiences on Telegram (independent student community)")).toBeNull();
  });
});
