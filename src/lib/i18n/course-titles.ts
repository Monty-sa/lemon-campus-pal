import type { Language } from "./types";

/**
 * Verified English translations for King Faisal University College of Business Administration
 * and university-wide required courses.
 * Source: KFU College of Business Administration Academic Plans & Banner Course Catalog.
 */
export const VERIFIED_ENGLISH_COURSE_TITLES: Record<string, string> = {
  // Management, Marketing, Logistics & Tourism (0602 & 0673)
  "0602-202": "Operations Management",
  "0602-207": "Organizational Behavior",
  "0602-302": "Principles of Sourcing",
  "0602-303": "International Business Management",
  "0602-304": "Strategic Management",
  "0602-305": "Small Business Management",
  "0602-315": "Performance and Compensation Management",
  "0602-331": "Strategic Marketing",
  "0602-332": "Consumer Behavior",
  "0602-401": "Project Management",
  "0602-402": "Business Ethics",
  "0602-430": "Digital Marketing",
  "0602-431": "Contemporary Issues in Marketing",
  "0602-499": "Cooperative Training",

  "0673-101": "Principles of Management",
  "0673-102": "Marketing Management",
  "0673-106": "Human Resources in Tourism",
  "0673-107": "Tourism Marketing",
  "0673-201": "Human Resource Management",
  "0673-202": "Operations Management",
  "0673-203": "International Business Management",
  "0673-204": "Fundamentals of Scientific Research (Management)",
  "0673-205": "Organizational Behavior",
  "0673-206": "Knowledge Management",
  "0673-301": "Strategic Management",
  "0673-302": "Small Business Management",
  "0673-303": "Principles of Sourcing",
  "0673-305": "Business Ethics",
  "0673-313": "Consumer Behavior",
  "0673-314": "Digital Marketing",
  "0673-316": "Principles of Supply Chain",
  "0673-317": "Transportation Management",
  "0673-318": "Warehouse and Inventory Management",
  "0673-320": "Performance and Compensation Management",
  "0673-325": "Procurement Management",
  "0673-326": "Operations Quality Management",
  "0673-403": "Quality Management",
  "0673-404": "Project Management",
  "0673-407": "Strategic Marketing",
  "0673-408": "Contemporary Issues in Marketing",
  "0673-409": "Digital Logistics Management",
  "0673-410": "Customer Relationship Management",
  "0673-411": "Strategic Human Resource Management",
  "0673-412": "Digital Human Resource Management",
  "0673-415": "Import and Export Management",
  "0673-416": "Distribution Management in Operations",
  "0673-499": "Cooperative Training",

  // Accounting (0603 & 0674 & 0612)
  "0603-101": "Principles of Accounting I",
  "0603-102": "Principles of Accounting II",
  "0603-103": "Accounting and Business Management",
  "0603-201": "Fundamentals of Managerial Accounting",
  "0603-202": "Intermediate Accounting I",
  "0603-203": "Cost Accounting Systems",
  "0603-301": "Intermediate Accounting II",
  "0603-302": "Managerial Accounting",
  "0603-303": "Accounting Information Systems",
  "0603-304": "Auditing I",
  "0603-305": "Internal Control Systems",
  "0603-306": "Governmental and Non-Profit Accounting",
  "0603-307": "Financial Statement Analysis",
  "0603-308": "Specialized Entities Accounting",
  "0603-310": "Financial Institutions Accounting",
  "0603-401": "Auditing II",
  "0603-402": "Zakat and Tax Accounting",
  "0603-403": "Advanced Accounting",
  "0603-404": "Computer Applications in Accounting",
  "0603-407": "Cooperative Training",

  "0674-101": "Principles of Accounting & Financial Reporting",
  "0674-102": "Fundamentals of Accounting & Costing",
  "0674-103": "Principles of Accounting & Financial Reporting",
  "0674-201": "Intermediate Accounting I",
  "0674-202": "Intermediate Accounting II",
  "0674-203": "Cost Accounting Systems",
  "0674-204": "Fundamentals of Scientific Research (Accounting)",
  "0674-301": "Managerial Accounting",
  "0674-302": "Accounting Information Systems",
  "0674-303": "Governmental Accounting",
  "0674-304": "Internal Control and Auditing",
  "0674-305": "External Auditing and Assurance Services",
  "0674-306": "Computer Applications in Accounting",
  "0674-310": "Financial Statement Analysis",
  "0674-320": "Specialized Entities Accounting",
  "0674-401": "Governance and Professional Ethics",
  "0674-402": "Zakat and Tax Accounting",
  "0674-403": "Advanced Accounting",
  "0674-404": "Graduation Project",
  "0674-410": "Earnings Management & Fraud Detection",
  "0674-499": "Cooperative Training",

  "0612-120": "Principles of Accounting I",

  // Finance & Banking (0604 & 0675)
  "0604-201": "Financial Management I",
  "0604-202": "Financial Management II",
  "0604-203": "Financial Institutions & Markets",
  "0604-205": "Fundamentals of Scientific Research (Finance)",
  "0604-301": "Investment Analysis",
  "0604-302": "Financial Derivatives",
  "0604-303": "Fundamentals of Real Estate Investment",
  "0604-304": "International Finance",
  "0604-305": "Risk Management",
  "0604-307": "Research Seminar in Finance",
  "0604-401": "Islamic Finance",
  "0604-402": "Financial Policies",
  "0604-404": "Project Feasibility Study",
  "0604-405": "Cooperative Training",
  "0604-408": "Securities Analysis",

  "0675-102": "Financial Management I",
  "0675-201": "Financial Management II",
  "0675-202": "Bank Management",
  "0675-203": "Financial Institutions & Markets",
  "0675-204": "Fundamentals of Research (Finance)",
  "0675-205": "Investment Analysis",
  "0675-301": "Financial Econometrics",
  "0675-302": "Risk Management",
  "0675-303": "International Finance",
  "0675-304": "Financial Derivatives",
  "0675-305": "Financial Technology (FinTech)",
  "0675-306": "Project Feasibility Study",
  "0675-307": "Fundamentals of Real Estate Investment",
  "0675-401": "Islamic Finance",
  "0675-402": "Financial Policies",
  "0675-403": "Corporate Governance",
  "0675-404": "Research Project in Finance",
  "0675-405": "Securities Analysis",
  "0675-499": "Cooperative Training",

  // Quantitative Methods, Insurance & Actuarial Science (0606 & 0676 & 0601)
  "0606-201": "Quantitative Methods in Management",
  "0606-490": "Cooperative Training",

  "0676-101": "Fundamentals of Mathematics in Management",
  "0676-102": "Introduction to Statistics",
  "0676-201": "Business Statistics",
  "0676-202": "Quantitative Methods in Management",
  "0676-203": "Fundamentals of Risk and Insurance",
  "0676-204": "Fundamentals of Scientific Research (Risk)",
  "0676-205": "Statistical Computing",
  "0676-206": "Life Insurance",
  "0676-207": "General Insurance",
  "0676-208": "Financial Mathematics for Insurance",
  "0676-301": "Risk Analysis",
  "0676-302": "Social Insurance",
  "0676-303": "Probability and Simulation for Insurance",
  "0676-304": "Health Insurance",
  "0676-305": "Reinsurance",
  "0676-306": "Enterprise Risk Management",
  "0676-401": "Introduction to Actuarial Science",
  "0676-402": "Special Topics in Insurance",
  "0676-403": "Insurance Company Operations",
  "0676-404": "Regression and Time Series Analysis",
  "0676-499": "Cooperative Training",

  "0601-101": "Principles of Statistics for Business",
  "0601-102": "Business Mathematics",
  "0601-201": "Quantitative Analysis in Business",

  // Management Information Systems (0607 & 0677)
  "0607-498": "E-Commerce",

  "0677-101": "Computer Skills",
  "0677-201": "E-Commerce",
  "0677-202": "Management Information Systems",
  "0677-204": "Fundamentals of Scientific Research (MIS)",
  "0677-205": "Fundamentals of Business Programming",
  "0677-206": "Enterprise Data Management",
  "0677-207": "Enterprise Integrated Systems (ERP)",
  "0677-301": "Advanced Business Programming",
  "0677-302": "Information Systems Analysis & Design",
  "0677-303": "Project I",
  "0677-304": "Web Systems Development",
  "0677-307": "Introduction to Business Analytics",
  "0677-308": "Applications in Business Analytics",
  "0677-313": "Decision Support Systems",
  "0677-314": "Data Networks & Telecommunications",
  "0677-401": "Selected Topics in Computing",
  "0677-402": "Information Systems Ethics",
  "0677-403": "Information Systems Security",
  "0677-404": "Project II",
  "0677-499": "Cooperative Training",

  // Economics (0605 & 0678)
  "0605-302": "Introduction to Econometrics",
  "0605-303": "Energy Economics",

  "0678-101": "Principles of Microeconomics",
  "0678-102": "Principles of Macroeconomics",
  "0678-106": "Tourism Economics",
  "0678-201": "Money and Banking",
  "0678-204": "Fundamentals of Scientific Research (Economics)",
  "0678-206": "International Economics",
  "0678-301": "Applied Microeconomics",
  "0678-303": "Project Economic Feasibility",
  "0678-307": "Advanced Econometrics",
  "0678-401": "Industrial Economics",
  "0678-403": "Energy Economics",
  "0678-404": "Graduation Project",
  "0678-405": "Business Project Management",
  "0678-409": "Saudi Economy",
  "0678-499": "Cooperative Training",

  // Law & Legal Environment (0608 & 0607)
  "0608-101": "Principles of Law",
  "0608-201": "Commercial Law",
  "0607-101": "Commercial Law",
  "0607-201": "Legal Environment of Business",

  // Business Administration Fundamentals & Practical Training (0622 & 0642)
  "0622-111": "Principles of Business Administration",
  "0622-115": "Principles of Management",
  "0622-290": "Business Administration I",
  "0622-292": "Management Fundamentals & Skills",
  "0622-391": "Business Administration II",
  "0642-390": "Practical Training",

  // University-Wide Requirements
  "0101-101": "Islamic Culture I",
  "0101-102": "Islamic Culture II",
  "0101-103": "Islamic Culture III",
  "0101-104": "Islamic Culture IV",
  "0201-101": "Arabic Language Skills",
  "0201-102": "Arabic Writing",
  "0401-101": "English Language I",
  "0401-102": "English Language II",
};

export interface LocalizedCourseTitle {
  title: string;
  isRtl: boolean;
  isFallback: boolean;
}

/**
 * Returns localized course title. If the user selects English and a verified English
 * title is available, it returns that. Otherwise, falls back to original Arabic title
 * with correct bidi isolation metadata.
 */
export function getLocalizedCourseTitle(
  course: { code: string; titleAr: string; titleEn?: string },
  lang: Language,
): LocalizedCourseTitle {
  if (lang === "en") {
    if (course.titleEn && course.titleEn.trim().length > 0) {
      return { title: course.titleEn.trim(), isRtl: false, isFallback: false };
    }
    const rawCode = course.code.trim();
    const cleanCode = rawCode.includes(":") ? rawCode.split(":")[1].trim() : rawCode;
    const verified = VERIFIED_ENGLISH_COURSE_TITLES[cleanCode] || VERIFIED_ENGLISH_COURSE_TITLES[rawCode];
    if (verified) {
      return { title: verified, isRtl: false, isFallback: false };
    }
    // Fall back to original Arabic with bidi isolation flag
    return { title: course.titleAr, isRtl: true, isFallback: true };
  }

  // Arabic interface uses original Arabic title
  return { title: course.titleAr, isRtl: true, isFallback: false };
}
