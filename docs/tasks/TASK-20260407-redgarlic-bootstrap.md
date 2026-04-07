# TASK-20260407 Redgarlic Bootstrap

## Goal
Build the first independent project skeleton for Hongsuan Intelligent's internal system.

## Scope
- create a standalone Next.js + Prisma project
- keep database separate from `tuition-scheduler`
- carry over the existing deployment discipline and release gate pattern
- prepare for file sharing MVP and later employee system expansion
- implement the first usable admin setup, login, and shared file flow
- prepare shared file storage for future Tencent COS integration without changing the business pages
- replace placeholder text branding with the provided Macrocosm logo asset on core entry pages

## Decisions
- keep the application on the existing server, but isolate runtime, port, env, and database
- use Neon PostgreSQL instead of Tencent Cloud LighthouseDB
- reserve object storage for shared file content in the next implementation phase
- use local `public/uploads/shared-files` storage for the first closed-loop MVP so the app can go live before COS integration
- raise the Next.js server action body limit so file uploads do not break once real documents exceed the default 1 MB cap
- move the shared-file mutation forms to route handlers so already-open tabs remain usable across deployments
- require a two-step deletion flow: mark a file deleted first, then allow permanent removal from storage and the database
- keep the shared-file right rail top-aligned so long file tables do not distort the upload and category cards
- favor a wider left document table on desktop so admins can always reach operation buttons without awkward clipping
- build shared-file redirects from forwarded host/protocol headers so proxy deployments never bounce users to localhost
- preserve operator context after shared-file mutations by redirecting back to the touched row or relevant section
- evolve the shared file area from a flat table into a desktop-like folder explorer with real nested directories
- return `303 See Other` from shared-file mutation routes so successful POST submissions always land back on the explorer through a safe `GET`
- keep audit evidence after permanent file deletion by allowing audit rows to outlive the deleted file row
- serialize the first-owner bootstrap path so one empty system cannot mint multiple owners under concurrent load
- move logout side effects behind `POST` rather than `GET`
- rebuild logout redirects from forwarded host/protocol headers so sign-out lands on the public domain in proxied deployments
- enforce a server-side upload byte cap and stream shared-file writes to reduce memory pressure during uploads
- include content length when streaming uploads to Tencent COS so the S3-compatible endpoint accepts the request body
- complete the desktop-style file explorer with folder rename, empty-folder deletion, and per-file move controls
- continue the desktop-style explorer with in-place file rename and folder move actions for day-to-day reorganization
- support multi-select style batch moves for files so larger current-directory cleanups do not require one-by-one actions
- polish the explorer UX with clearer folder delete guidance and denser file-row controls to better match desktop file managers
- expand batch file handling from move-only into common desktop actions like archive and soft delete
- collapse secondary per-file actions into a tighter “more actions” interaction pattern
- replace raw action codes in explorer feedback with human-readable Chinese messages and align folder-card actions with the same disclosure pattern
- ship a bundled explorer polish pass with sorting controls, stronger path navigation, and confirmation prompts for dangerous actions
- follow with a second bundled polish pass that improves density control and current-page bulk-selection ergonomics
