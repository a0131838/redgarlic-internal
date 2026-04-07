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
