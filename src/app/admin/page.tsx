import Link from "next/link";
import { getServerSupabase } from "@/lib/cloud/server";
import { getAdminMetrics, getAdminPrivilegedSupabase, getAdminUsersList, isAdminUser } from "@/lib/cloud/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await getServerSupabase();

  if (!supabase) {
    return (
      <main className="admin-page">
        <div className="admin-card error-card">
          <h1>Admin Dashboard Unavailable</h1>
          <p>Supabase cloud services are not configured. Run LEMON in guest mode or provide credentials in .env.local.</p>
          <Link href="/" className="admin-btn">Return to Planner</Link>
        </div>
      </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="admin-page">
        <div className="admin-card access-denied-card" role="alert">
          <div className="status-badge danger">401 Unauthorized</div>
          <h1>Authentication Required</h1>
          <p>You must be signed in with a verified account to access the administrative portal.</p>
          <div className="admin-actions">
            <Link href="/" className="admin-btn">Back to Home</Link>
          </div>
        </div>
      </main>
    );
  }

  const isAdmin = await isAdminUser(supabase, user.id);

  if (!isAdmin) {
    return (
      <main className="admin-page">
        <div className="admin-card access-denied-card" role="alert">
          <div className="status-badge danger">403 Forbidden</div>
          <h1>Administrator Privileges Required</h1>
          <p>
            Your account (<code>{user.id}</code>) is not on the administrator allowlist.
            Access to this resource is server-enforced and logged.
          </p>
          <div className="admin-actions">
            <Link href="/" className="admin-btn">Back to Planner</Link>
          </div>
        </div>
      </main>
    );
  }

  // User is a verified admin
  const privileged = getAdminPrivilegedSupabase();
  const metrics = await getAdminMetrics(supabase, privileged);
  const usersList = await getAdminUsersList(supabase, privileged);

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div className="admin-brand">
          <Link href="/" className="brand" aria-label="LEMON home">
            <span className="brand-fruit"><span>LE</span><b>MON</b></span>
          </Link>
          <span className="admin-portal-badge">Admin Dashboard</span>
        </div>
        <div className="admin-header-actions">
          <span className="admin-user-pill">Admin: <code>{user.email ?? user.id.slice(0, 8)}</code></span>
          <Link href="/" className="admin-btn secondary">Back to Planner</Link>
        </div>
      </header>

      <div className="admin-content">
        <section className="admin-section">
          <h2>System Overview & Metrics</h2>
          <div className="metrics-grid">
            <div className="metric-card">
              <span className="metric-label">Registered Profiles</span>
              <span className="metric-value">{metrics.aggregate.totalUsers}</span>
              <span className="metric-sub">Synced user accounts</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Total Cloud Schedules</span>
              <span className="metric-value">{metrics.aggregate.totalSchedules}</span>
              <span className="metric-sub">Owner-only cloud records</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">KFU Snapshot Freshness</span>
              <span className="metric-value">{metrics.snapshot.coursesCount} Courses</span>
              <span className="metric-sub">{metrics.snapshot.sectionsCount} Sections · {metrics.snapshot.status}</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Database & Auth Status</span>
              <span className="metric-value status-ok">Operational</span>
              <span className="metric-sub">
                {metrics.systemStatus.serviceRoleConfigured ? "Privileged service role active" : "Standard client mode"}
              </span>
            </div>
          </div>
        </section>

        <section className="admin-section">
          <h2>Snapshot Metadata</h2>
          <div className="info-card">
            <div className="info-row">
              <strong>Academic Term:</strong>
              <span>{metrics.snapshot.termLabel} (ID: {metrics.snapshot.termId})</span>
            </div>
            <div className="info-row">
              <strong>College:</strong>
              <span>{metrics.snapshot.collegeName}</span>
            </div>
            <div className="info-row">
              <strong>Category:</strong>
              <span>{metrics.snapshot.categoryLabel}</span>
            </div>
            <div className="info-row">
              <strong>Imported At:</strong>
              <span>{metrics.snapshot.importedAt}</span>
            </div>
            <div className="info-row">
              <strong>Validation Warnings:</strong>
              <span>{metrics.snapshot.warningsCount} warnings in snapshot</span>
            </div>
          </div>
        </section>

        <section className="admin-section">
          <h2>Unavailable Metrics</h2>
          <p className="admin-hint">The following metrics are not supported by static snapshot data or serverless architecture:</p>
          <div className="info-card warning-card">
            {Object.entries(metrics.unavailableMetrics).map(([key, reason]) => (
              <div className="info-row" key={key}>
                <strong>{key}:</strong>
                <span className="unavailable-tag">{reason}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-section">
          <div className="section-title-wrap">
            <h2>User Management Overview</h2>
            <span className="badge-count">{usersList.length} users</span>
          </div>
          <p className="admin-hint">Minimal necessary metadata only. Private schedules and authentication secrets are strictly excluded.</p>
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Display Name</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {usersList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-cell">No user profiles found.</td>
                  </tr>
                ) : (
                  usersList.map((u) => (
                    <tr key={u.id}>
                      <td><code>{u.id.slice(0, 8)}…</code></td>
                      <td><b>{u.displayName}</b></td>
                      <td>@{u.username}</td>
                      <td>
                        {u.isAdmin ? (
                          <span className="role-tag admin">Administrator</span>
                        ) : (
                          <span className="role-tag user">Standard User</span>
                        )}
                      </td>
                      <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-section">
          <h2>Admin Bootstrap Reference</h2>
          <div className="code-card">
            <p>To grant admin privileges to a verified Supabase user, run this SQL in Supabase SQL Editor:</p>
            <pre>
              {`insert into public.app_admins (user_id)
values ('<VERIFIED_USER_UUID>')
on conflict (user_id) do nothing;`}
            </pre>
          </div>
        </section>
      </div>
    </main>
  );
}
