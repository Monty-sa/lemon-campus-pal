"use client";

import type { Language, Translations } from "@/lib/i18n";

export interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  selectedCategory: "11" | "12" | null;
  onCategoryChange: (cat: "11" | "12") => void;
  onComplete: () => void;
  t: Translations;
  maleSectionCount: number;
  femaleSectionCount: number;
}

export function OnboardingModal({
  isOpen,
  onClose,
  lang,
  onLanguageChange,
  selectedCategory,
  onCategoryChange,
  onComplete,
  t,
  maleSectionCount,
  femaleSectionCount,
}: OnboardingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="auth-modal onboarding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-setup-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="auth-modal-header">
          <div>
            <h2 id="welcome-setup-title">{t.onboarding.modalTitle}</h2>
            <p>{t.onboarding.modalSubtitle}</p>
          </div>
          <button
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label={lang === "ar" ? "إغلاق نافذة الإعدادات" : "Close welcome setup"}
          >
            ✕
          </button>
        </header>

        <div className="onboarding-body">
          {/* Step 1: Language Preference */}
          <div className="onboarding-step">
            <div className="onboarding-step-header">
              <span className="onboarding-step-num">1</span>
              <span className="onboarding-step-title">{t.onboarding.stepLanguageTitle}</span>
            </div>
            <div className="onboarding-pills-row" role="group" aria-label={t.onboarding.stepLanguageTitle}>
              <button
                type="button"
                className={`onboarding-lang-btn ${lang === "en" ? "active" : ""}`}
                onClick={() => onLanguageChange("en")}
                aria-pressed={lang === "en"}
                aria-label={`${t.onboarding.selectLanguagePrompt}: English`}
              >
                <span className="lang-flag">🇺🇸</span>
                <span className="lang-name">{t.onboarding.englishLabel}</span>
              </button>
              <button
                type="button"
                className={`onboarding-lang-btn ${lang === "ar" ? "active" : ""}`}
                onClick={() => onLanguageChange("ar")}
                aria-pressed={lang === "ar"}
                aria-label={`${t.onboarding.selectLanguagePrompt}: العربية`}
              >
                <span className="lang-flag">🇸🇦</span>
                <span className="lang-name">{t.onboarding.arabicLabel}</span>
              </button>
            </div>
          </div>

          {/* Step 2: Student Category */}
          <div className="onboarding-step">
            <div className="onboarding-step-header">
              <span className="onboarding-step-num">2</span>
              <span className="onboarding-step-title">{t.onboarding.stepCategoryTitle}</span>
              <span className="onboarding-required-badge">
                {lang === "ar" ? "مطلوب" : "Required"}
              </span>
            </div>
            <div className="onboarding-cards-grid" role="group" aria-label={t.onboarding.stepCategoryTitle}>
              <button
                type="button"
                className={`onboarding-cat-card ${selectedCategory === "11" ? "active" : ""}`}
                onClick={() => onCategoryChange("11")}
                aria-pressed={selectedCategory === "11"}
                aria-label={`${t.onboarding.selectCategoryPrompt}: ${t.onboarding.maleLabel}`}
              >
                <div className="cat-card-top">
                  <span className="cat-card-icon">👨</span>
                  <span className="cat-card-title">{t.onboarding.maleLabel}</span>
                </div>
                <div className="cat-card-sub">{t.onboarding.maleSub(maleSectionCount)}</div>
              </button>

              <button
                type="button"
                className={`onboarding-cat-card ${selectedCategory === "12" ? "active" : ""}`}
                onClick={() => onCategoryChange("12")}
                aria-pressed={selectedCategory === "12"}
                aria-label={`${t.onboarding.selectCategoryPrompt}: ${t.onboarding.femaleLabel}`}
              >
                <div className="cat-card-top">
                  <span className="cat-card-icon">👩</span>
                  <span className="cat-card-title">{t.onboarding.femaleLabel}</span>
                </div>
                <div className="cat-card-sub">{t.onboarding.femaleSub(femaleSectionCount)}</div>
              </button>
            </div>

            {!selectedCategory && (
              <p className="onboarding-required-hint" role="status">
                ⚠️ {t.onboarding.categoryRequiredHint}
              </p>
            )}
          </div>
        </div>

        <footer className="auth-modal-footer onboarding-footer">
          <button
            type="button"
            className="auth-submit-btn onboarding-finish-btn"
            disabled={!selectedCategory}
            onClick={onComplete}
            aria-label={t.onboarding.getStarted}
          >
            {lang === "ar" ? "ابدأ باختيار المقررات" : "Start choosing courses"}
          </button>
        </footer>
      </div>
    </div>
  );
}
