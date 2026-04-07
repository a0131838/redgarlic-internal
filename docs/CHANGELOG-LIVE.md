# CHANGELOG-LIVE

## 2026-04-07
- bootstrapped `redgarlic-internal` as an independent internal system
- aligned deployment discipline with `tuition-scheduler`
- established standalone Neon/PostgreSQL runtime and release gate baseline
- connected the project to Neon and applied the initial Prisma migration
- added first-run owner setup, admin login/logout, and shared file library MVP
- added team access management for creating staff accounts, disabling accounts, and resetting passwords
- added shared file storage abstraction with local/COS(S3) support and controlled access route
- documented Tencent COS deployment configuration for future storage switch
- refreshed the public and admin entry branding with the Macrocosm logo asset
- raised the Next.js server action body limit to prevent shared-file uploads from failing at 1 MB
- moved shared-file create/update forms to stable POST routes so old tabs do not break after a deploy
- added a permanent delete flow that removes already-marked files from both storage and the database
- fixed the shared-file two-column layout so the right-side forms no longer stretch when the file list gets long
- widened the shared-file desktop layout so the left table can show management actions without squeezing behind the upload rail
- corrected shared-file POST redirects so reverse-proxied requests return to the real domain instead of localhost
- preserved useful scroll position after shared-file actions so row updates and deletes no longer bounce the user to the top
- upgraded the shared file area to a folder-based explorer with nested directories, breadcrumbs, and current-folder uploads
- changed shared-file form redirects from `307` to `303` so browser follow-ups become `GET` requests and upload completion no longer crashes on the destination page
- preserved shared-file audit history after permanent file deletion by detaching audit rows from deleted files and snapshotting the file title
- serialized first-owner bootstrap with a PostgreSQL advisory lock so concurrent setup requests cannot create multiple owner accounts
- changed logout to a `POST`-only side effect so crawlers and third-party pages cannot log users out via a stray `GET`
- rebuilt logout redirects from proxy headers so production sign-out never bounces users toward the internal `localhost` origin
- added server-side upload size enforcement and switched shared-file writes to streaming I/O to avoid buffering a second full copy of every upload in memory
- supplied explicit content length for COS streaming uploads so Tencent-compatible S3 endpoints accept the streamed body
- added desktop-style folder management actions for renaming folders, deleting empty folders, and moving files between directories
