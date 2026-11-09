import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { RegistrationGuideModal } from "./registration-guide-modal";
import { getTranslations } from "@/lib/i18n";

describe("LEMON-045: Registration Guide Email Integration", () => {
  it("shows the cohort schedule and Banner / informal guidance in both languages", () => {
    const { rerender } = render(<RegistrationGuideModal isOpen onClose={() => {}} lang="en" t={en} />);
    expect(screen.getByText("2023 and earlier")).toBeInTheDocument();
    expect(screen.getByText("Sun, Nov 8, 2026")).toBeInTheDocument();
    expect(screen.getByText("Nov 13–19, 2026")).toBeInTheDocument();
    expect(screen.getByText(/Official registration takes place through Banner/)).toBeInTheDocument();
    expect(screen.getByText(/not an official university rule or a guarantee/i)).toBeInTheDocument();
    rerender(<RegistrationGuideModal isOpen onClose={() => {}} lang="ar" t={ar} />);
    expect(screen.getByText("دفعة ٢٠٢٣ وما قبلها")).toBeInTheDocument();
    expect(screen.getByText("الأحد ٨ نوفمبر ٢٠٢٦")).toBeInTheDocument();
    expect(screen.queryByText("Sunday")).not.toBeInTheDocument();
  });

  it("shows cohort dates, Banner registration, and the informal advisory bilingually", () => {
    const { rerender } = render(<RegistrationGuideModal isOpen onClose={() => {}} lang="en" t={en} />);
    expect(screen.getByText("2023 and earlier")).toBeInTheDocument();
    expect(screen.getByText("Sun, Nov 8, 2026")).toBeInTheDocument();
    expect(screen.getByText("Nov 13–19, 2026")).toBeInTheDocument();
    expect(screen.getByText(/Official registration takes place through Banner/)).toBeInTheDocument();
    expect(screen.getByText(/not an official university rule or a guarantee/i)).toBeInTheDocument();
    rerender(<RegistrationGuideModal isOpen onClose={() => {}} lang="ar" t={ar} />);
    expect(screen.getByText("دفعة ٢٠٢٣ وما قبلها")).toBeInTheDocument();
    expect(screen.getByText("الأحد ٨ نوفمبر ٢٠٢٦")).toBeInTheDocument();
  });

  const en = getTranslations("en");
  const ar = getTranslations("ar");

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders cohort & track codes, electives, exam alert, and official verified links in English", () => {
    render(
      <RegistrationGuideModal
        isOpen={true}
        onClose={() => {}}
        lang="en"
        t={en}
      />
    );

    // 1. Cohort & Track section
    expect(screen.getByText(/Cohort & Track Registration Codes/i)).toBeInTheDocument();
    expect(screen.getByText("Section codes: K – R")).toBeInTheDocument();
    expect(screen.getByText("Section code: D")).toBeInTheDocument();
    expect(screen.getByText("Section codes: A – T")).toBeInTheDocument();
    expect(screen.getByText("None listed in official college guidelines")).toBeInTheDocument();
    expect(screen.getByText(/Advisory notice: These codes guide your academic registration/i)).toBeInTheDocument();

    // 2. Interactive cohort filter
    const btn2021 = screen.getByRole("button", { name: "2021 & Later" });
    fireEvent.click(btn2021);
    expect(screen.getByText("Section codes: K – R")).toBeInTheDocument();
    expect(screen.getByText("Section code: D")).toBeInTheDocument();
    expect(screen.queryByText("Section codes: A – T")).not.toBeInTheDocument();

    const btn2020 = screen.getByRole("button", { name: "2020 & Earlier" });
    fireEvent.click(btn2020);
    expect(screen.getByText("Section codes: A – T")).toBeInTheDocument();
    expect(screen.getByText("None listed in official college guidelines")).toBeInTheDocument();
    expect(screen.queryByText("Section code: D")).not.toBeInTheDocument();

    // 3. College Electives
    expect(screen.getByText(/College Free & Elective Courses/i)).toBeInTheDocument();
    expect(screen.getByText(/Eligible English-taught course outside your plan\/department/i)).toBeInTheDocument();
    expect(screen.getByText(/Eligible Arabic-taught course outside your plan\/department/i)).toBeInTheDocument();

    // 4. Final Exam Warning
    expect(screen.getByText(/Final Exam Schedule Reminder/i)).toBeInTheDocument();
    expect(screen.getByText(/Always verify your final exam dates in the official KFU student portal/i)).toBeInTheDocument();

    // 5. Official Links
    const reqLink = screen.getByRole("link", { name: /University Requirements Schedule/i });
    expect(reqLink).toHaveAttribute(
      "href",
      "https://www.kfu.edu.sa/ar/Deans/E-Learning/Pages/University-Requirements-Schedule.aspx"
    );
    expect(reqLink).toHaveAttribute("target", "_blank");
    expect(reqLink).toHaveAttribute("rel", "noopener noreferrer");

    const planLink = screen.getByRole("link", { name: /CBA Study Plans/i });
    expect(planLink).toHaveAttribute(
      "href",
      "https://www.kfu.edu.sa/ar/Colleges/business-administration/Pages/Study-Plans.aspx"
    );
    expect(planLink).toHaveAttribute("target", "_blank");
    expect(planLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders verified cohort codes, electives, and links in Arabic", () => {
    render(
      <RegistrationGuideModal
        isOpen={true}
        onClose={() => {}}
        lang="ar"
        t={ar}
      />
    );

    // Arabic headings & codes
    expect(screen.getByText(/رموز الشعب والتسجيل حسب الدفعة والمسار/)).toBeInTheDocument();
    expect(screen.getByText("رموز الشعب: K – R")).toBeInTheDocument();
    expect(screen.getByText("رمز الشعبة: D")).toBeInTheDocument();
    expect(screen.getByText("رموز الشعب: A – T")).toBeInTheDocument();
    expect(screen.getByText("لم ترد رموز مخصصة في تعليمات الكلية")).toBeInTheDocument();

    // Electives
    expect(screen.getByText(/المقررات الحرة والاختيارية للكلية/)).toBeInTheDocument();
    expect(screen.getByText(/مقرر متاح باللغة الإنجليزية من خارج خطة\/قسم الطالب/i)).toBeInTheDocument();
    expect(screen.getByText(/مقرر متاح باللغة العربية من خارج خطة\/قسم الطالب/i)).toBeInTheDocument();

    // Final Exam
    expect(screen.getByText(/تذكير جدول الاختبارات النهائية/i)).toBeInTheDocument();

    // Official Links
    const arReqLink = screen.getByRole("link", { name: /جدول المتطلبات الجامعية/i });
    expect(arReqLink).toHaveAttribute(
      "href",
      "https://www.kfu.edu.sa/ar/Deans/E-Learning/Pages/University-Requirements-Schedule.aspx"
    );
    expect(arReqLink).toHaveAttribute("target", "_blank");
    expect(arReqLink).toHaveAttribute("rel", "noopener noreferrer");

    const arPlanLink = screen.getByRole("link", { name: /الخطط الدراسية/i });
    expect(arPlanLink).toHaveAttribute(
      "href",
      "https://www.kfu.edu.sa/ar/Colleges/business-administration/Pages/Study-Plans.aspx"
    );
    expect(arPlanLink).toHaveAttribute("target", "_blank");
    expect(arPlanLink).toHaveAttribute("rel", "noopener noreferrer");
  });
});
