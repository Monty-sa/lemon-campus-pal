# Netlify deployment

## Compatibility

- Next.js 16.4.5 (App Router, React 19) is supported by Netlify's OpenNext adapter with no runtime plugin or extra dependency. Netlify also supports Turbopack builds.
- The planner and GPA pages build without private credentials in guest-only mode. Server routes support status, snapshot delivery, authenticated ingestion, optional notifications/admin operations, and optional Supabase account infrastructure.
- `netlify.toml` sets the build command (`npm run build`), publish directory (`.next`), and Node 22. Next.js 16 requires Node.js 20.9 or later.

## Manual Netlify deployment

1. Run the complete quality gate from a clean disposable copy created from the reviewed source.
2. Keep the detected settings: build command `npm run build`, publish directory `.next`, and Node 22.
3. Keep `NEXT_PUBLIC_GUEST_ONLY_MODE=true` for the public release. Configure server-only ingestion/Blobs values in Netlify, never in tracked files.
4. Use the authenticated Netlify CLI to create and verify a draft deploy before promoting an explicitly approved production build.
5. Confirm the site shows the verified term, freshness status, official source link, and working guest persistence.

Do not connect the public GitHub repository to Netlify automatic deployments. GitHub Actions performs quality checks only and has no deployment or polling credentials.

No Netlify plugin, adapter pin, or additional dependency is needed. Netlify maintains the Next.js adapter automatically.

## Restrict preview access

Deploy Preview URLs are public by default, even though they are hard to guess.

- **Netlify Pro or Enterprise:** open **Project configuration → General → Visitor access → Project visibility → Edit visibility**, choose **Password**, and set the scope to **Previews only** (shown as **Non-production deploys only** on the legacy UI). Production stays public; Deploy Previews and branch deploys require the password.
- **Free or Personal plans:** password protection is unavailable. Either make the project **Private** (restricts all deploys to the team/owner) or disable previews under **Project configuration → Build & deploy → Deploy previews** by selecting **Don't deploy pull requests**.
- Preview URLs rotate on every deploy, so never use a preview URL itself as access control.
- Do not commit `.env` files or credentials. This project does not need any.

## Data provenance and freshness

- The app ships validated fallback snapshots and can read the current published pair from Netlify Blobs without rebuilding.
- The operator-controlled Windows worker performs the authorized hourly source refresh and signs ingestion requests with an HMAC secret stored outside the repository. Public CI never fetches or publishes KFU data.
- The UI and print output show the verified term, college, student category, last successful import date, official source URL, and the snapshot-only availability disclaimer.
- Before deploying data changes, run `npm run validate:kfu`, review the refreshed snapshot, then rerun `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. See [DATA_SOURCE.md](DATA_SOURCE.md) for the source and access constraints.

Deployment does not resolve the KFU permission and refresh-ownership conditions recorded in [RELEASE_READINESS.md](RELEASE_READINESS.md).
