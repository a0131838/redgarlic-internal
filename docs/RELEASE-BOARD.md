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

## Release Rules
- every production deploy must include changelog, release board, and task note updates
- deploy path is `npm ci -> prisma generate -> prisma migrate deploy -> build -> pm2 start/restart`
- production database must never point to localhost
- health endpoint `/api/health` must return `200`
