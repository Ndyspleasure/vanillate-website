# CMS upgrade — 17 November 2026

Status: implemented in working tree; not deployed. Production remains unchanged.

## Resource budget

- Statistics: up to 12 history requests / 12,000 downloaded rows → 1 RPC / at most 400 samples. Snapshot request remains separate. Sampling runs on indexed time/bot range (maximum 30 days), security invoker preserves RLS. This reduces transfer; CPU benefit has not been measured.
- FAQ: full answers for entire result set → 26 metadata rows per request, 25 displayed, one answer requested on edit. Categories reused during page session. Search is explicit Enter to avoid per-keystroke network requests.
- Page editor: all page_content rows → one active key. Number of read requests stays one; concurrent writes use updated_at comparison.
- Monitoring: hidden-tab recurring queries → zero until visible again. In-flight requests finish; automatic polls cannot overlap. Explicit manual refresh paths need further load measurement.
- Production database measured read-only: 52,464,787 bytes (~50 MiB). No deletion, VACUUM or schema application performed; no storage reduction claimed. Existing log retention and hourly stats rollup are already active.
- Baseline fixture build: 19.57 s and 762,784 KiB peak child RSS. Later builds passed but were not measured under identical conditions; no timing/memory savings claimed.

## UI and workflow

Navigation grouped into eight task categories; original routes retained. Mobile sidebar is a closed-by-default drawer with overlay, Escape, focus handling, scroll containment and 44px controls. Dashboard, registry and FAQ fixture screens passed 360/390/768/1440 checks without horizontal overflow or JS errors before final pagination changes.

`/admin/bots` adds source-derived metadata and TODO lists for Vanillate.ID, Anonymous Chat, Workspace and Story. Story is represented as a feature of Vanillate.ID. Metadata is static and public-safe, not a runtime configuration writer. Missing release/hosting/visual/permission data remains TODO. Search requires no database request. Runtime status is available via existing operational panel links; automatic unified telemetry has not been implemented.

Page and FAQ writes detect stale/deleted rows instead of claiming success. Page editor warns on unsaved navigation. Login uses email directly, removing client-side username-to-email lookup.

## Validation

Build with `ASTRO_TELEMETRY_DISABLED=1 BLOG_FIXTURE=tests/fixtures/blog.json npm run build`.
`npm test`: 237 tests pass, including optimistic editor saves, strict sync preservation and visibility-aware polling.
`PGBIN=<postgres bin> npm run test:admin-auth` verifies protected role changes, last-login writes, anonymous resolver denial, <=400 samples, latest-sample preservation, authenticated RLS denial and authorized access, rollback and row preservation in a disposable database.
Existing `npm run test:sql` suites also passed earlier. No lint script is configured.

## Deployment and recovery

1. Obtain a direct PostgreSQL connection and take a full custom-format pg_dump outside the repository; restore into a disposable database and validate before production writes. Current connector access provided read-only inspection, not a full restorable backup. No database password/connection string is available in the execution environment.
2. Apply `supabase/migrations/20261116144645_admin_auth_hardening.sql` before deploying the frontend. It contains auth hardening and the bounded stats RPC. Run in a transaction; verify role restrictions and RPC under the actual admin JWT.
3. Deploy website using the existing Pages pipeline. Smoke test email login, OTP/reset, stats, FAQ search/pagination/save conflicts and mobile tables with populated production data.
4. SQL rollback: `supabase/admin-auth-hardening-rollback.sql` restores the previous access behavior (including known security weaknesses). No rows are removed by either migration. Roll back frontend together with SQL because the new stats page requires the RPC.
5. Source snapshot before edits: commit 93f191d; full git bundle and tar saved in `/workspace/work/cms-upgrade/`. This is a SOURCE backup, not a database backup. Working-tree changes remain reviewable in git diff.

## Deferred / blocked

- Production backup, migration and deploy: blocked on restorable database backup/connection. Do not deploy frontend alone.
- Exact production CPU, memory, latency and per-page query benchmark: requires authenticated production/browser monitoring; fixture numbers are not production estimates.
- Full command-option inventory, unknown bot metadata: requires missing Workspace repo and confirmation of active deployment values; catalog TODOs document gaps.
- Atomic announcement batch save, audit restore UI and full-site query pagination audit remain future work. Sync failure reporting is implemented: CI sets SYNC_STRICT=1, stages writes in memory, preserves existing snapshots on required-output failure, reports failed outputs in GitHub summary, and stops commit/deploy. Priority medium for editor batch/audit UI. All should reuse existing storage and avoid new polling.
- PM2 controls, secret manager and automated deploy buttons deferred: high operational risk and additional server integration; existing bot command controls remain available.

## Final review

Snapshot cards now populate all declared metrics. Changing chart range ignores superseded responses and clears stale table rows. Migration and rollback each run as one transaction. Source tests and fixture build passed after these changes. Production rollout still requires the backup prerequisite above; no production changes were made.
