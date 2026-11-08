"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SchedulePlan } from "@/lib/schema";
import type { Language, Translations } from "@/lib/i18n";
import {
  createLemonBackup,
  getBackupFileName,
  validateBackupFileContent,
  executeRestoreBackup,
  clearGuestStorage,
  type LemonBackupV2,
} from "@/lib/storage";

export interface DataPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  t: Translations;
  currentPlans: SchedulePlan[];
  onRestoreSuccess: (restoredPlans: SchedulePlan[], activePlanId: string) => void;
  onClearDataSuccess: () => void;
  showToast: (msg: string) => void;
}

export function DataPrivacyModal({
  isOpen,
  onClose,
  lang,
  t,
  currentPlans,
  onRestoreSuccess,
  onClearDataSuccess,
  showToast,
}: DataPrivacyModalProps) {
  const [pendingBackup, setPendingBackup] = useState<LemonBackupV2 | null>(null);
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleCloseModal = useCallback(() => {
    setPendingBackup(null);
    setRestoreMode("merge");
    setErrorMessage("");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (pendingBackup) {
          setPendingBackup(null);
        } else {
          handleCloseModal();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, pendingBackup, handleCloseModal]);

  if (!isOpen) return null;

  function handleDownloadBackup() {
    try {
      const backup = createLemonBackup(window.localStorage);
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = getBackupFileName();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(t.dataPrivacy.downloadSuccessToast);
    } catch {
      setErrorMessage(t.common.error);
    }
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    setErrorMessage("");
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage(t.dataPrivacy.restoreErrorFileTooLarge);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        if (typeof text !== "string") {
          setErrorMessage(t.dataPrivacy.restoreErrorInvalid);
          return;
        }
        const validation = validateBackupFileContent(text);
        if (!validation.isValid || !validation.backup) {
          setErrorMessage(validation.error || t.dataPrivacy.restoreErrorInvalid);
          return;
        }
        setPendingBackup(validation.backup);
      } catch {
        setErrorMessage(t.dataPrivacy.restoreErrorInvalid);
      }
    };
    reader.onerror = () => {
      setErrorMessage(t.dataPrivacy.restoreErrorInvalid);
    };
    reader.readAsText(file);
  }

  function handleConfirmRestore() {
    if (!pendingBackup) return;
    try {
      const { restoredPlans, activePlanId } = executeRestoreBackup(
        window.localStorage,
        pendingBackup,
        restoreMode,
        currentPlans,
      );
      showToast(t.dataPrivacy.restoreSuccessToast);
      onRestoreSuccess(restoredPlans, activePlanId);
      setPendingBackup(null);
      onClose();
    } catch {
      setErrorMessage(t.dataPrivacy.restoreErrorInvalid);
    }
  }

  function handleConfirmDelete() {
    try {
      clearGuestStorage(window.localStorage);
      showToast(t.planner.guestClearedToast);
      onClearDataSuccess();
      onClose();
    } catch {
      setErrorMessage(t.common.error);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={handleCloseModal}>
      <div
        className="auth-modal data-privacy-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-privacy-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="auth-modal-header">
          <div>
            <h2 id="data-privacy-title">{t.dataPrivacy.dialogTitle}</h2>
            <p>{t.dataPrivacy.guestDescription}</p>
          </div>
          <button
            type="button"
            ref={closeButtonRef}
            className="close-button"
            onClick={handleCloseModal}
            aria-label={t.common.close}
          >
            ✕
          </button>
        </header>

        <div className="auth-modal-body data-privacy-body">
          {errorMessage && (
            <div
              className="data-privacy-error"
              role="alert"
              style={{
                background: "rgba(220, 38, 38, 0.08)",
                color: "var(--danger, #dc2626)",
                border: "1px solid rgba(220, 38, 38, 0.2)",
                borderRadius: "8px",
                padding: "8px 12px",
                fontSize: "12.5px",
                textAlign: "start",
              }}
            >
              ⚠️ {errorMessage}
            </div>
          )}

          {pendingBackup ? (
            /* Restore Preview State */
            <div
              className="restore-preview-card"
              style={{
                background: "var(--surface-soft, rgba(0,0,0,0.03))",
                border: "1px solid var(--border, #e5e5dc)",
                borderRadius: "10px",
                padding: "12px 14px",
                textAlign: "start",
              }}
            >
              <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 6px 0" }}>
                📥 {t.dataPrivacy.restorePreviewTitle}
              </h3>
              <p style={{ fontSize: "12.5px", color: "var(--muted)", margin: "0 0 8px 0" }}>
                {t.dataPrivacy.plansFoundCount(pendingBackup.plans.length)}
              </p>

              <div style={{ marginBottom: "10px" }}>
                <span style={{ fontSize: "11.5px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  {t.dataPrivacy.planNamesLabel}
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                  {pendingBackup.plans.map((p, idx) => (
                    <span
                      key={p.id || idx}
                      style={{
                        fontSize: "11.5px",
                        background: "var(--surface)",
                        border: "1px solid var(--border, #ccc)",
                        borderRadius: "5px",
                        padding: "2px 7px",
                      }}
                    >
                      {p.name} ({p.sectionIds.length} {lang === "ar" ? "شعبة" : "sections"})
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "11.5px", fontWeight: 600, display: "block", marginBottom: "5px" }}>
                  {t.dataPrivacy.restoreModeLabel}
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "7px",
                      cursor: "pointer",
                      fontSize: "12.5px",
                    }}
                  >
                    <input
                      type="radio"
                      name="restoreMode"
                      value="merge"
                      checked={restoreMode === "merge"}
                      onChange={() => setRestoreMode("merge")}
                    />
                    <div>
                      <strong>{t.dataPrivacy.modeMerge}</strong>
                      <div style={{ fontSize: "11.5px", color: "var(--muted)" }}>
                        {t.dataPrivacy.modeMergeDesc}
                      </div>
                    </div>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "7px",
                      cursor: "pointer",
                      fontSize: "12.5px",
                    }}
                  >
                    <input
                      type="radio"
                      name="restoreMode"
                      value="replace"
                      checked={restoreMode === "replace"}
                      onChange={() => setRestoreMode("replace")}
                    />
                    <div>
                      <strong>{t.dataPrivacy.modeReplace}</strong>
                      <div style={{ fontSize: "11.5px", color: "var(--muted)" }}>
                        {t.dataPrivacy.modeReplaceDesc}
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="admin-btn primary small"
                  onClick={handleConfirmRestore}
                >
                  {t.dataPrivacy.confirmRestoreButton}
                </button>
                <button
                  type="button"
                  className="admin-btn secondary small"
                  onClick={() => setPendingBackup(null)}
                >
                  {t.dataPrivacy.cancelButton}
                </button>
              </div>
            </div>
          ) : (
            /* Compact Two-Action Layout */
            <>
              <div className="data-privacy-actions-grid">
                <button
                  type="button"
                  className="admin-btn primary data-privacy-action-btn"
                  onClick={handleDownloadBackup}
                >
                  💾 {t.dataPrivacy.downloadBackupButton}
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json,application/json"
                  style={{ display: "none" }}
                  onChange={handleFileSelected}
                />
                <button
                  type="button"
                  className="admin-btn secondary data-privacy-action-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  📂 {t.dataPrivacy.restoreBackupButton}
                </button>
              </div>

              <p className="data-privacy-hint-note">
                🔒 {t.dataPrivacy.unencryptedNotice}
              </p>

              {/* Collapsed Secondary Danger Section */}
              <details className="data-privacy-danger-details">
                <summary className="data-privacy-danger-summary">
                  <span>🗑️ {t.dataPrivacy.deleteMyDataButton}</span>
                </summary>
                <div className="data-privacy-danger-body">
                  <p>{t.dataPrivacy.deleteConfirmMessage}</p>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="admin-btn danger small"
                      onClick={handleConfirmDelete}
                    >
                      {t.dataPrivacy.confirmDeleteButton}
                    </button>
                  </div>
                </div>
              </details>
            </>
          )}
        </div>

        <footer className="data-privacy-modal-footer">
          <button
            type="button"
            className="admin-btn secondary small"
            onClick={handleCloseModal}
          >
            {t.common.close}
          </button>
        </footer>
      </div>
    </div>
  );
}
