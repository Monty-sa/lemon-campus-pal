"use client";

import { useEffect, useRef, useState } from "react";
import type { Course, Day, Section } from "@/lib/schema";
import { formatTime } from "@/lib/schedule";
import type { Language, Translations } from "@/lib/i18n";
import { getLocalizedCourseTitle } from "@/lib/i18n";

export interface CourseDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: Section | null;
  course: Course | null;
  lang: Language;
  t: Translations;
  onRemoveSection: (section: Section) => void;
  onCopyCrn: (crn: string) => void;
}

export function CourseDetailsModal({
  isOpen,
  onClose,
  section,
  course,
  lang,
  t,
  onRemoveSection,
  onCopyCrn,
}: CourseDetailsModalProps) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, section?.id]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !section || !course) return null;

  const loc = getLocalizedCourseTitle(course, lang);
  const cleanCode = course.code.includes("-")
    ? course.code.split("-").slice(1).join("-")
    : course.code;

  function handleConfirmRemove() {
    if (section) {
      onRemoveSection(section);
      onClose();
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="auth-modal course-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-details-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="auth-modal-header">
          <div>
            <span className="course-details-eyebrow">{t.courseDetails.modalTitle}</span>
            <h2 id="course-details-title">
              <bdi dir={loc.isRtl ? "rtl" : "ltr"} lang={loc.isRtl ? "ar" : "en"}>
                {loc.title}
              </bdi>
            </h2>
            <p className="course-details-subtitle">
              <bdi dir="ltr">{cleanCode}</bdi> · {t.courseDetails.section} <bdi dir="ltr">{section.sectionCode}</bdi>
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label={t.courseDetails.close}
          >
            ✕
          </button>
        </header>

        <div className="course-details-body">
          {/* Metadata Grid */}
          <div className="course-details-grid">
            <div className="detail-item">
              <span className="detail-label">{t.courseDetails.courseCode}</span>
              <strong className="detail-value"><bdi dir="ltr">{cleanCode}</bdi></strong>
            </div>

            <div className="detail-item">
              <span className="detail-label">{t.courseDetails.crn}</span>
              <strong className="detail-value crn-accent"><bdi dir="ltr">{section.crn}</bdi></strong>
            </div>

            <div className="detail-item">
              <span className="detail-label">{t.courseDetails.section}</span>
              <strong className="detail-value"><bdi dir="ltr">{section.sectionCode}</bdi></strong>
            </div>

            <div className="detail-item">
              <span className="detail-label">{t.courseDetails.credits}</span>
              <strong className="detail-value">{t.courseDetails.creditsUnit(course.credits)}</strong>
            </div>

            <div className="detail-item">
              <span className="detail-label">{t.courseDetails.instructor}</span>
              <strong className="detail-value">
                {section.instructor?.name ? (
                  <span className="instructor-with-link">
                    <bdi dir="auto">{section.instructor.name}</bdi>
                    <a
                      href="https://t.me/+br6ivC0jUog2MTQ0"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="instructor-community-link subtle"
                      title={t.community.subtleLinkTitle}
                    >
                      💬 {t.community.subtleLink}
                    </a>
                  </span>
                ) : (
                  <span className="text-muted">{t.courseDetails.notAvailable}</span>
                )}
              </strong>
            </div>

            <div className="detail-item">
              <span className="detail-label">{t.courseDetails.activity}</span>
              <strong className="detail-value">
                {section.instructionalFormat || section.meetings[0]?.activity || (
                  <span className="text-muted">{t.courseDetails.notAvailable}</span>
                )}
              </strong>
            </div>

            <div className="detail-item">
              <span className="detail-label">{t.courseDetails.location}</span>
              <strong className="detail-value">
                {section.meetings.find((m) => m.location)?.location || (
                  <span className="text-muted">{t.courseDetails.notAvailable}</span>
                )}
              </strong>
            </div>

            <div className="detail-item">
              <span className="detail-label">{t.courseDetails.snapshotAvailability}</span>
              <div className="detail-value">
                <span
                  className={`status-pill ${section.status}`}
                  title={
                    lang === "ar"
                      ? "حالة الشعبة حسب آخر جدول منشور من الجامعة؛ ولا تعكس المقاعد اللحظية"
                      : "Section status as of latest university timetable snapshot; does not reflect live seat capacity"
                  }
                >
                  <span className={`status-dot ${section.status}`} />
                  {section.status === "open"
                    ? t.courseDetails.availableBadge
                    : section.status === "closed"
                    ? t.courseDetails.unavailableBadge
                    : t.courseDetails.unknownBadge}
                </span>
              </div>
            </div>
          </div>

          <p className="detail-disclaimer">
            {t.courseDetails.snapshotDisclaimer}
          </p>

          {/* Meeting Schedule */}
          <div className="course-details-schedule">
            <h3 className="schedule-section-heading">{t.courseDetails.scheduleMeetings}</h3>
            <div className="schedule-meetings-list">
              {section.meetings.map((meeting, index) => {
                const dayLabels = meeting.days.map((day: Day) => t.planner.days[day]).join(" · ");
                return (
                  <div className="meeting-row-card" key={meeting.id || index}>
                    <div className="meeting-days">
                      <span className="meeting-calendar-icon">📅</span>
                      <strong>{dayLabels}</strong>
                    </div>
                    <div className="meeting-time">
                      <bdi dir="ltr">
                        {formatTime(meeting.startMinutes)} – {formatTime(meeting.endMinutes)}
                      </bdi>
                    </div>
                    {meeting.location && (
                      <div className="meeting-loc">
                        <span>📍 {meeting.location}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Remove Confirmation Card if triggered */}
          {confirmingRemove && (
            <div className="remove-confirm-box" role="alert">
              <strong>{t.courseDetails.confirmRemoveTitle}</strong>
              <p>{t.courseDetails.confirmRemovePrompt(section.sectionCode, cleanCode)}</p>
              <div className="remove-confirm-actions">
                <button
                  type="button"
                  className="admin-btn danger small"
                  onClick={handleConfirmRemove}
                >
                  {t.courseDetails.confirmRemoveYes}
                </button>
                <button
                  type="button"
                  className="admin-btn secondary small"
                  onClick={() => setConfirmingRemove(false)}
                >
                  {t.courseDetails.confirmRemoveCancel}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <footer className="auth-modal-footer course-details-footer">
          <div className="course-details-actions">
            <button
              type="button"
              className="admin-btn secondary"
              onClick={() => onCopyCrn(section.crn)}
              title={t.courseDetails.copyCrn}
            >
              📋 {t.courseDetails.copyCrn}
            </button>
            {!confirmingRemove && (
              <button
                type="button"
                className="admin-btn danger-outline"
                onClick={() => setConfirmingRemove(true)}
              >
                🗑️ {t.courseDetails.removeFromPlan}
              </button>
            )}
          </div>
          <button
            type="button"
            className="admin-btn secondary"
            onClick={onClose}
          >
            {t.courseDetails.close}
          </button>
        </footer>
      </div>
    </div>
  );
}
