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
