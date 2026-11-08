import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Planner } from "./planner";
import { maleOfferings, femaleOfferings } from "@/data/offerings";
import {
  createLemonBackup,
  getBackupFileName,
  validateBackupFileContent,
  executeRestoreBackup,
  saveGuestPlans,
  type LemonBackupV2,
  type GuestDataBackup,
} from "@/lib/storage";
import { getTranslations } from "@/lib/i18n";

describe("LEMON-042B: Guest Data Backup & Restore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("creates a well-formed v2 backup object with getBackupFileName", () => {
    saveGuestPlans(window.localStorage, [
      {
        id: "plan-test-1",
        name: "Graduation Semester",
        termId: "144820",
        sectionIds: ["0603-101-01"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const backup = createLemonBackup(window.localStorage);
    expect(backup.version).toBe(2);
    expect(backup.appName).toBe("LEMON");
    expect(backup.schemaVersion).toBe("2.0");
    expect(backup.plans.length).toBe(1);
    expect(backup.plans[0].name).toBe("Graduation Semester");

    const fileName = getBackupFileName(new Date("2026-11-08T12:00:00Z"));
    expect(fileName).toBe("lemon-backup-2026-11-08.json");
  });

  it("validates backup JSON and rejects files >5MB or malformed content", () => {
    // Empty
    expect(validateBackupFileContent("").isValid).toBe(false);

    // Malformed JSON
    expect(validateBackupFileContent("{not_valid_json").isValid).toBe(false);

    // Over 5MB
    const bigString = "x".repeat(5 * 1024 * 1024 + 10);
    expect(validateBackupFileContent(bigString).isValid).toBe(false);

    // Invalid schema / missing plans
    expect(validateBackupFileContent(JSON.stringify({ version: 2 })).isValid).toBe(false);

    // Valid v2 backup
    const validV2: LemonBackupV2 = {
      version: 2,
      appName: "LEMON",
      schemaVersion: "2.0",
      exportedAt: new Date().toISOString(),
      plans: [
        {
          id: "p1",
          name: "Plan A",
          termId: "144820",
          sectionIds: ["s1"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };
    const resV2 = validateBackupFileContent(JSON.stringify(validV2));
    expect(resV2.isValid).toBe(true);
    expect(resV2.backup?.plans[0].name).toBe("Plan A");
  });

  it("upgrades legacy v1 backups gracefully without data loss", () => {
    const legacyV1: GuestDataBackup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      plans: [
        {
          id: "legacy-p1",
          name: "My Old Schedule",
          termId: "144820",
          sectionIds: ["crn-111"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      category: "11",
    };

    const validated = validateBackupFileContent(JSON.stringify(legacyV1));
    expect(validated.isValid).toBe(true);
    expect(validated.backup?.version).toBe(2);
    expect(validated.backup?.plans[0].name).toBe("My Old Schedule");
    expect(validated.backup?.preferences?.category).toBe("11");
  });

  it("executes non-destructive merge with conflict resolution for duplicate IDs and duplicate names", () => {
    const currentPlans = [
      {
        id: "plan-duplicate",
        name: "Spring Priority",
        termId: "144820",
        sectionIds: ["sec-1"],
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];

    const backupToImport: LemonBackupV2 = {
      version: 2,
      appName: "LEMON",
      schemaVersion: "2.0",
      exportedAt: "2026-11-08T00:00:00Z",
      plans: [
        {
          id: "plan-duplicate", // Same ID as existing
          name: "Spring Priority", // Same Name as existing
          termId: "144820",
          sectionIds: ["sec-2"],
          createdAt: "2026-02-01T00:00:00Z",
          updatedAt: "2026-02-01T00:00:00Z",
        },
      ],
    };

    const result = executeRestoreBackup(window.localStorage, backupToImport, "merge", currentPlans);
    expect(result.restoredPlans.length).toBe(2);
    expect(result.restoredPlans[0].id).toBe("plan-duplicate");
    expect(result.restoredPlans[0].name).toBe("Spring Priority");

    // The imported plan got a unique ID and (Restored) name suffix
    expect(result.restoredPlans[1].id).not.toBe("plan-duplicate");
    expect(result.restoredPlans[1].name).toBe("Spring Priority (Restored)");
  });

  it("replaces existing plans completely when restore mode is 'replace'", () => {
    const currentPlans = [
      {
        id: "old-plan",
        name: "Old Plan To Discard",
        termId: "144820",
        sectionIds: ["sec-1"],
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];

    const backupToImport: LemonBackupV2 = {
      version: 2,
      appName: "LEMON",
      schemaVersion: "2.0",
      exportedAt: "2026-11-08T00:00:00Z",
      plans: [
        {
          id: "new-plan",
          name: "Fresh Backup Plan",
          termId: "144820",
          sectionIds: ["sec-2"],
          createdAt: "2026-02-01T00:00:00Z",
          updatedAt: "2026-02-01T00:00:00Z",
        },
      ],
    };

    const result = executeRestoreBackup(window.localStorage, backupToImport, "replace", currentPlans);
    expect(result.restoredPlans.length).toBe(1);
    expect(result.restoredPlans[0].id).toBe("new-plan");
    expect(result.restoredPlans[0].name).toBe("Fresh Backup Plan");
  });

  it("Data & Privacy modal does not expose the word 'JSON' in primary user actions", () => {
    render(<Planner data={maleOfferings} supabaseClient={null} />);

    // Open Data & Privacy dialog
    const privacyBtn = screen.getAllByRole("button", { name: /data & privacy|البيانات والخصوصية/i })[0];
    fireEvent.click(privacyBtn);

    // Primary buttons are student-friendly and do not show "JSON"
    const downloadBtn = screen.getByRole("button", { name: /download backup|حفظ نسخة احتياطية/i });
    expect(downloadBtn).toBeDefined();
    expect(downloadBtn.textContent).not.toMatch(/json/i);

    const restoreBtn = screen.getByRole("button", { name: /restore backup|استعادة نسخة/i });
    expect(restoreBtn).toBeDefined();
    expect(restoreBtn.textContent).not.toMatch(/json/i);
  });
});

describe("LEMON-042C: Student Category & Incomplete Schedule UX", () => {
  it("renders subtle singular/plural info note for incomplete schedule details without alarmist yellow banner", async () => {
    // English Male dataset (3 warnings)
    const en = getTranslations("en");
    expect(en.categorySelector.warningOmitted(3)).toBe("3 sections have incomplete schedule details.");
    expect(en.categorySelector.warningOmitted(1)).toBe("1 section has incomplete schedule details.");

    // Arabic Male dataset (3 warnings)
    const ar = getTranslations("ar");
    expect(ar.categorySelector.warningOmitted(3)).toBe("٣ شعب معلومات جدولها غير مكتملة.");
    expect(ar.categorySelector.warningOmitted(1)).toBe("شعبة واحدة معلومات جدولها غير مكتملة.");

    render(<Planner data={maleOfferings} supabaseClient={null} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument();
    });

    // Check subtle inline indicator is rendered
    const warningHint = document.querySelector(".dataset-warning-hint");
    expect(warningHint).toBeInTheDocument();
    expect(warningHint?.textContent).toContain("3 sections have incomplete schedule details.");

    // Old yellow banner does NOT exist
    expect(document.querySelector(".guest-notice-banner")).toBeNull();
  });

  it("preserves TBA sections in catalog counts with Time TBA badges", async () => {
    // Total section counts match source snapshot accurately (including TBA sections)
    expect(maleOfferings.sections.length).toBe(389);
    expect(femaleOfferings.sections.length).toBe(540);

    const { container } = render(<Planner data={maleOfferings} supabaseClient={null} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Business Course Catalog|Browse sections/)[0]).toBeInTheDocument();
    });

    // Verify Time TBA badge is rendered for sections with incomplete times
    const tbaBadges = container.querySelectorAll(".tba-badge");
    expect(tbaBadges.length).toBeGreaterThan(0);
    expect(tbaBadges[0].textContent).toMatch(/Time TBA|الوقت غير محدد/i);
  });
});
