"use client";

import type { Language, Translations } from "@/lib/i18n";

export interface RegistrationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: Language;
  t: Translations;
}

export function RegistrationGuideModal({
  isOpen,
  onClose,
  lang = "en",
  t,
}: RegistrationGuideModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="auth-modal reg-guide-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reg-guide-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="auth-modal-header">
          <div>
            <h2 id="reg-guide-modal-title">{t.regGuide.modalTitle}</h2>
            <p>{t.regGuide.modalSubtitle}</p>
          </div>
          <button
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label={lang === "ar" ? "إغلاق دليل التسجيل" : "Close registration guide"}
          >
            ✕
          </button>
        </header>

        <div className="reg-guide-body">
          {/* Section 1: Availability Status Signals */}
          <div className="reg-guide-section">
            <h3 className="reg-guide-heading">{t.regGuide.statusSectionTitle}</h3>
            <div className="reg-guide-cards">
              <div className="guide-status-card available">
                <div className="guide-status-header">
                  <span className="guide-dot open" />
                  <b className="guide-status-title">{t.regGuide.statusAvailableTitle}</b>
                </div>
                <p className="guide-status-desc">{t.regGuide.statusAvailableDesc}</p>
              </div>

              <div className="guide-status-card unavailable">
                <div className="guide-status-header">
                  <span className="guide-dot closed" />
                  <b className="guide-status-title">{t.regGuide.statusUnavailableTitle}</b>
                </div>
                <p className="guide-status-desc">{t.regGuide.statusUnavailableDesc}</p>
              </div>
            </div>
          </div>

          {/* Section 2: Section Letter Conventions */}
          <div className="reg-guide-section">
            <h3 className="reg-guide-heading">{t.regGuide.sectionLettersTitle}</h3>
            <p className="reg-guide-subtext">{t.regGuide.sectionLettersDesc}</p>
            <div className="guide-letters-list">
              <div className="guide-letter-item">
                <span className="guide-letter-badge">K</span>
                <span className="guide-letter-desc">{t.regGuide.letterKMale}</span>
              </div>
              <div className="guide-letter-item">
                <span className="guide-letter-badge">H / Y</span>
                <span className="guide-letter-desc">{t.regGuide.letterHFemale}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Official KFU Day Abbreviations */}
          <div className="reg-guide-section">
            <h3 className="reg-guide-heading">{t.regGuide.daysTitle}</h3>
            <p className="reg-guide-subtext">{t.regGuide.daysDesc}</p>
            <div className="guide-days-grid">
              {t.regGuide.daysMap.map((day) => (
                <div key={day.code} className="guide-day-card">
                  <span className="guide-day-code">{day.code}</span>
                  <span className="guide-day-name">{day.name}</span>
                  <span className="guide-day-en">{day.en}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className="auth-modal-footer">
          <button
            type="button"
            className="admin-btn secondary"
            onClick={onClose}
            aria-label={lang === "ar" ? "إغلاق دليل التسجيل" : "Close registration guide"}
          >
            {t.common.close}
          </button>
        </footer>
      </div>
    </div>
  );
}
