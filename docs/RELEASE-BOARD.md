# RELEASE-BOARD

## Current Release
- App: `redgarlic-internal`
- Stage: MVP in progress
- Deployment target: same server as `tuition-scheduler`, but isolated app/runtime/database
- Database: independent Neon PostgreSQL
- Domain: `redgarlicai.com`
- Live capabilities:
  - first-run owner account setup
  - admin login/logout with database-backed sessions
  - shared file categories, uploads, listing, archive/delete status, audit trail
  - team access page for creating employee accounts and managing password/status
  - shared files can now be stored with `local` or `s3` driver via env configuration
  - COS switch instructions are documented for server deployment
  - homepage and admin login now display the Macrocosm logo branding asset
  - shared file uploads now allow larger request bodies instead of failing near the default 1 MB action limit
  - shared file actions now submit through stable POST endpoints instead of deploy-sensitive server action ids
  - deleted files can now be permanently removed from storage and the database after a soft delete
  - the right-side upload and category cards keep their own height even when the left file table becomes very long
  - the desktop split now prioritizes the file table width while keeping the upload rail fixed and sticky

## Release Rules
- every production deploy must include changelog, release board, and task note updates
- deploy path is `npm ci -> prisma generate -> prisma migrate deploy -> build -> pm2 start/restart`
- production database must never point to localhost
- health endpoint `/api/health` must return `200`
