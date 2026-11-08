"use client";

import { useState } from "react";
import type { Language, Translations } from "@/lib/i18n";
import { VERIFIED_ACADEMIC_EVENTS_1448, KFU_OFFICIAL_CALENDAR_URL } from "@/data/academic-calendar";
import { getEventStatus, formatGregorianRange } from "@/lib/academic-calendar";

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
  const [cohortFilter, setCohortFilter] = useState<"all" | "2021" | "2020">("all");

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

          {/* Section 4: Cohort & Track Registration Codes */}
          <details className="reg-guide-details" open>
            <summary className="reg-guide-summary">
              <span className="reg-guide-summary-title">🎓 {t.regGuide.cohortCodesTitle}</span>
            </summary>
            <div className="reg-guide-details-content">
              <p className="reg-guide-subtext">{t.regGuide.cohortCodesDesc}</p>

              <div className="cohort-filter-pills" role="radiogroup" aria-label={t.regGuide.cohortCodesTitle}>
                <button
                  type="button"
                  className={`cohort-pill ${cohortFilter === "all" ? "active" : ""}`}
                  onClick={() => setCohortFilter("all")}
                >
                  {t.regGuide.cohortFilterAll}
                </button>
                <button
                  type="button"
                  className={`cohort-pill ${cohortFilter === "2021" ? "active" : ""}`}
                  onClick={() => setCohortFilter("2021")}
                >
                  {t.regGuide.cohortFilter2021Later}
                </button>
                <button
                  type="button"
                  className={`cohort-pill ${cohortFilter === "2020" ? "active" : ""}`}
                  onClick={() => setCohortFilter("2020")}
                >
                  {t.regGuide.cohortFilter2020Earlier}
                </button>
              </div>

              <div className="cohort-codes-grid">
                {(cohortFilter === "all" || cohortFilter === "2021") && (
                  <>
                    <div className="cohort-card">
                      <div className="cohort-card-header">
                        <span className="cohort-tag en">EN</span>
                        <b>{t.regGuide.cohort2021EnglishTrack}</b>
                      </div>
                      <div className="cohort-card-badge">{t.regGuide.cohort2021EnglishCodes}</div>
                    </div>

                    <div className="cohort-card">
                      <div className="cohort-card-header">
                        <span className="cohort-tag ar">AR</span>
                        <b>{t.regGuide.cohort2021ArabicTrack}</b>
                      </div>
                      <div className="cohort-card-badge">{t.regGuide.cohort2021ArabicCodes}</div>
                    </div>
                  </>
                )}

                {(cohortFilter === "all" || cohortFilter === "2020") && (
                  <>
                    <div className="cohort-card">
                      <div className="cohort-card-header">
                        <span className="cohort-tag ar">AR</span>
                        <b>{t.regGuide.cohort2020ArabicTrack}</b>
                      </div>
                      <div className="cohort-card-badge">{t.regGuide.cohort2020ArabicCodes}</div>
                    </div>

                    <div className="cohort-card">
                      <div className="cohort-card-header">
                        <span className="cohort-tag en">EN</span>
                        <b>{t.regGuide.cohort2020EnglishTrack}</b>
                      </div>
                      <div className="cohort-card-badge muted">{t.regGuide.cohort2020EnglishCodes}</div>
                    </div>
                  </>
                )}
              </div>

              <div className="guide-advisory-note">
                <span className="guide-advisory-icon" aria-hidden="true">💡</span>
                <p>{t.regGuide.cohortCodesAdvisoryNote}</p>
              </div>
            </div>
          </details>

          {/* Section 5: College Electives */}
          <details className="reg-guide-details" open>
            <summary className="reg-guide-summary">
              <span className="reg-guide-summary-title">📖 {t.regGuide.electivesTitle}</span>
            </summary>
            <div className="reg-guide-details-content">
              <p className="reg-guide-subtext">{t.regGuide.electivesDesc}</p>
              <div className="electives-list">
                <div className="elective-rule-card">
                  <div className="cohort-card-header">
                    <span className="cohort-tag en">EN</span>
                    <b>{t.regGuide.elective2022EnglishTrack}</b>
                  </div>
                  <p className="elective-rule-text">{t.regGuide.elective2022EnglishRule}</p>
                </div>

                <div className="elective-rule-card">
                  <div className="cohort-card-header">
                    <span className="cohort-tag ar">AR</span>
                    <b>{t.regGuide.elective2021ArabicTrack}</b>
                  </div>
                  <p className="elective-rule-text">{t.regGuide.elective2021ArabicRule}</p>
                </div>
              </div>
              <span className="guide-scope-note">{t.regGuide.electivesScopeNote}</span>
            </div>
          </details>

          {/* Section 6: Final Exam Schedule Warning */}
          <div className="reg-guide-section final-exam-alert-section">
            <h3 className="reg-guide-heading">{t.regGuide.finalExamTitle}</h3>
            <div className="final-exam-alert-card">
              <span className="final-exam-icon" aria-hidden="true">🗓️</span>
              <p className="final-exam-text">{t.regGuide.finalExamWarning}</p>
            </div>
          </div>

          {/* Section: Official Academic Dates (1448 AH) */}
          <details className="reg-guide-details academic-dates-details" open>
            <summary className="reg-guide-summary">
              <span className="reg-guide-summary-title">📅 {t.regGuide.academicDatesTitle}</span>
            </summary>
            <div className="reg-guide-details-content">
              <p className="reg-guide-subtext">{t.regGuide.academicDatesDesc}</p>
              <div className="academic-events-list">
                {VERIFIED_ACADEMIC_EVENTS_1448.map((event) => {
                  const status = getEventStatus(event);
                  const statusLabel =
                    status === "active"
                      ? t.regGuide.eventStatusActive
                      : status === "upcoming"
                      ? t.regGuide.eventStatusUpcoming
                      : t.regGuide.eventStatusFinished;

                  return (
                    <div key={event.id} className={`academic-event-card status-${status}`}>
                      <div className="academic-event-header">
                        <span className="academic-event-title">
                          {lang === "ar" ? event.titleAr : event.titleEn}
                        </span>
                        <span className={`academic-status-pill status-${status}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <div className="academic-event-meta">
                        <span className="academic-date-gregorian">
                          📅 {formatGregorianRange(event.startDate, event.endDate, lang)}
                        </span>
                        {event.startHijri && event.endHijri && (
                          <span className="academic-date-hijri">
                            🌙 {event.startHijri} – {event.endHijri}هـ
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="academic-dates-footer">
                <a
                  href={KFU_OFFICIAL_CALENDAR_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="academic-official-link"
                >
                  🔗 {t.regGuide.academicDatesSourceLink}
                </a>
              </div>
            </div>
          </details>

          {/* Section 7: Verified Official University Links */}
          <details className="reg-guide-details" open>
            <summary className="reg-guide-summary">
              <span className="reg-guide-summary-title">🔗 {t.regGuide.officialLinksTitle}</span>
            </summary>
            <div className="reg-guide-details-content">
              <div className="official-links-list">
                <a
                  href="https://www.kfu.edu.sa/ar/Deans/E-Learning/Pages/University-Requirements-Schedule.aspx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="official-link-card"
                >
                  <div className="official-link-header">
                    <span className="official-link-title">{t.regGuide.univRequirementsLink}</span>
                  </div>
                  <p className="official-link-desc">{t.regGuide.univRequirementsDesc}</p>
                </a>

                <a
                  href="https://www.kfu.edu.sa/ar/Colleges/business-administration/Pages/Study-Plans.aspx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="official-link-card"
                >
                  <div className="official-link-header">
                    <span className="official-link-title">{t.regGuide.studyPlansLink}</span>
                  </div>
                  <p className="official-link-desc">{t.regGuide.studyPlansDesc}</p>
                </a>
              </div>
            </div>
          </details>
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
