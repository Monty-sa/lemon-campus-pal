"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { AdminDashboardData } from "./types";
import { ADMIN_NAV_ITEMS, type AdminLang, I18N } from "./admin-i18n";

import { OverviewTab } from "./tabs/OverviewTab";
import { PlatformHealthTab } from "./tabs/PlatformHealthTab";
import { KfuDataTab } from "./tabs/KfuDataTab";
import { PerformanceTab } from "./tabs/PerformanceTab";
import { SecurityTab } from "./tabs/SecurityTab";
import { AuditTab } from "./tabs/AuditTab";
import { AudienceTab } from "./tabs/AudienceTab";
import { IntegrationsTab } from "./tabs/IntegrationsTab";
import { SettingsTab } from "./tabs/SettingsTab";

interface AdminCommandCenterProps {
  initialData: AdminDashboardData;
  initialTab?: string;
  initialLang?: AdminLang;
}

export const AdminCommandCenter: React.FC<AdminCommandCenterProps> = ({
  initialData,
  initialTab = "overview",
  initialLang = "en",
}) => {
  const [data, setData] = useState<AdminDashboardData>(initialData);
  const [currentTab, setCurrentTab] = useState<string>(initialTab);
  const [lang, setLang] = useState<AdminLang>(initialLang);
  const [theme, setTheme] = useState<"system" | "light" | "dark">(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("lemon.theme.v1");
        if (saved === "light" || saved === "dark") return saved;
      } catch {
        // Ignore storage errors
      }
    }
    return "system";
  });
  const [timezoneMode, setTimezoneMode] = useState<"riyadh" | "local">(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("lemon.admin.tz");
        if (saved === "local" || saved === "riyadh") return saved;
      } catch {
        // Ignore storage errors
      }
    }
    return "riyadh";
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const t = I18N[lang];
  const isAr = lang === "ar";

  const handleSetTheme = (newTheme: "system" | "light" | "dark") => {
    setTheme(newTheme);
    try {
      localStorage.setItem("lemon.theme.v1", newTheme);
      if (typeof document !== "undefined") {
        if (newTheme === "system") {
          const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          document.documentElement.dataset.theme = dark ? "dark" : "light";
        } else {
          document.documentElement.dataset.theme = newTheme;
        }
      }
    } catch {
      // Ignore storage errors
    }
  };

  const handleSetLang = (newLang: AdminLang) => {
    setLang(newLang);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", newLang);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const handleSetTimezoneMode = (mode: "riyadh" | "local") => {
    setTimezoneMode(mode);
    try {
      localStorage.setItem("lemon.admin.tz", mode);
    } catch {
      // Ignore storage errors
    }
  };

  const handleNavigateTab = (tabId: string) => {
    setCurrentTab(tabId);
    setSidebarOpen(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tabId);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const handleRefreshData = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/metrics", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setData((prev) => ({
          ...prev,
          overview: json.overview ?? prev.overview,
          errors: json.errors ?? prev.errors,
          kfuRefresh: json.kfuRefresh ?? prev.kfuRefresh,
          performance: json.performance ?? prev.performance,
        }));
      }
    } catch {
      // Ignore network errors on metrics refresh
    } finally {
      setRefreshing(false);
    }
  };

  // Close mobile sidebar on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen]);

  // Timestamp formatter
  const formatTimestamp = useCallback(
    (isoString: string): string => {
      try {
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) return isoString;

        if (timezoneMode === "riyadh") {
          const parts = new Intl.DateTimeFormat(isAr ? "ar-SA" : "en-US", {
            timeZone: "Asia/Riyadh",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }).format(date);
          return `${parts} (${isAr ? "ت.س" : "AST"})`;
        }

        return date.toLocaleString(isAr ? "ar-SA" : "en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch {
        return isoString;
      }
    },
    [timezoneMode, isAr],
  );

  const activeNavDef = ADMIN_NAV_ITEMS.find((item) => item.id === currentTab) ?? ADMIN_NAV_ITEMS[0];

  return (
    <div className="cmd-center-root" dir={isAr ? "rtl" : "ltr"}>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="cmd-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Responsive Sidebar */}
      <aside className={`cmd-sidebar ${sidebarOpen ? "open" : ""}`} aria-label="Command Center Navigation">
        <div className="cmd-sidebar-header">
          <div className="cmd-brand-group">
            <Link href="/" className="brand" aria-label="LEMON home">
              <span className="brand-fruit">
                <span>LE</span>
                <b>MON</b>
              </span>
            </Link>
            <span className="cmd-portal-tag">{t.portalTitle}</span>
          </div>
        </div>

        <nav className="cmd-sidebar-nav">
          {ADMIN_NAV_ITEMS.map((item) => {
            const isActive = item.id === currentTab;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigateTab(item.id)}
                className={`cmd-nav-item ${isActive ? "active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="cmd-nav-icon" aria-hidden="true">
                  {item.icon === "grid" && "📊"}
                  {item.icon === "activity" && "🛰️"}
                  {item.icon === "refresh" && "🔄"}
                  {item.icon === "zap" && "⚡"}
                  {item.icon === "shield" && "🛡️"}
                  {item.icon === "list" && "⏱️"}
                  {item.icon === "users" && "👥"}
                  {item.icon === "plug" && "🔌"}
                  {item.icon === "settings" && "⚙️"}
                </span>
                <span className="cmd-nav-label">
                  {isAr ? item.labelAr : item.labelEn}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="cmd-sidebar-footer">
          <div className="cmd-system-pulse">
            <span
              className={`cmd-pulse-dot ${
                data.overview.sourceHealth === "healthy" ? "" : "warning"
              }`}
            />
            <span>
              {data.overview.sourceHealth === "healthy" ? t.statusHealthy : t.statusDegraded}
            </span>
          </div>
          <div style={{ fontSize: "11.5px", color: "var(--muted)" }}>
            {data.overview.activeSnapshotVersion} · Term 144820
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="cmd-workspace">
        {/* Sticky Topbar */}
        <header className="cmd-topbar">
          <div className="cmd-topbar-left">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="cmd-menu-toggle"
              aria-label="Toggle Navigation Menu"
            >
              ☰
            </button>

            <nav className="cmd-breadcrumbs" aria-label="Breadcrumbs">
              <span className="cmd-crumb-root">LEMON</span>
              <span className="cmd-crumb-sep">/</span>
              <span className="cmd-crumb-active">
                {isAr ? activeNavDef.labelAr : activeNavDef.labelEn}
              </span>
            </nav>
          </div>

          <div className="cmd-topbar-right">
            {/* Timezone badge */}
            <span className="cmd-tz-badge" title="Timestamp Timezone">
              🕒 {timezoneMode === "riyadh" ? (isAr ? "الرياض AST" : "Riyadh AST") : (isAr ? "محلي" : "Local")}
            </span>

            {/* Refresh button */}
            <button
              type="button"
              onClick={handleRefreshData}
              disabled={refreshing}
              className="cmd-btn-compact"
              title={t.refreshMetrics}
            >
              🔄 {refreshing ? t.refreshing : t.refreshMetrics}
            </button>

            {/* Language switch */}
            <button
              type="button"
              onClick={() => handleSetLang(isAr ? "en" : "ar")}
              className="cmd-btn-compact"
            >
              {isAr ? "🇬🇧 English" : "🇸🇦 العربية"}
            </button>

            {/* Theme switch */}
            <button
              type="button"
              onClick={() => handleSetTheme(theme === "dark" ? "light" : "dark")}
              className="cmd-btn-compact"
              title="Toggle Theme"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>

            {/* Owner email chip */}
            <div className="cmd-owner-chip">
              <span className="cmd-owner-dot" />
              <span>{data.ownerSession.email}</span>
            </div>

            {/* Sign out link */}
            <a
              href="/api/admin/auth/logout"
              className="cmd-btn-compact danger-outline"
            >
              {t.signOut}
            </a>
          </div>
        </header>

        {/* Viewport Content */}
        <main className="cmd-viewport">
          {currentTab === "overview" && (
            <OverviewTab
              data={data}
              lang={lang}
              timezoneMode={timezoneMode}
              formatTimestamp={formatTimestamp}
              onNavigateTab={handleNavigateTab}
            />
          )}

          {currentTab === "health" && (
            <PlatformHealthTab
              data={data}
              lang={lang}
              formatTimestamp={formatTimestamp}
            />
          )}

          {currentTab === "kfu" && (
            <KfuDataTab
              data={data}
              lang={lang}
              formatTimestamp={formatTimestamp}
            />
          )}

          {currentTab === "performance" && (
            <PerformanceTab
              data={data}
              lang={lang}
            />
          )}

          {currentTab === "security" && (
            <SecurityTab
              data={data}
              lang={lang}
              formatTimestamp={formatTimestamp}
            />
          )}

          {currentTab === "audit" && (
            <AuditTab
              data={data}
              lang={lang}
              formatTimestamp={formatTimestamp}
            />
          )}

          {currentTab === "audience" && (
            <AudienceTab
              data={data}
              lang={lang}
              timezoneMode={timezoneMode}
              formatTimestamp={formatTimestamp}
            />
          )}

          {currentTab === "integrations" && (
            <IntegrationsTab
              data={data}
              lang={lang}
            />
          )}

          {currentTab === "settings" && (
            <SettingsTab
              data={data}
              lang={lang}
              theme={theme}
              timezoneMode={timezoneMode}
              onSetTheme={handleSetTheme}
              onSetLang={handleSetLang}
              onSetTimezoneMode={handleSetTimezoneMode}
            />
          )}
        </main>
      </div>
    </div>
  );
};
