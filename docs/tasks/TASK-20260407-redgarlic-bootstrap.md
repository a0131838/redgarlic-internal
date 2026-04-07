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

## Decisions
- keep the application on the existing server, but isolate runtime, port, env, and database
- use Neon PostgreSQL instead of Tencent Cloud LighthouseDB
- reserve object storage for shared file content in the next implementation phase
- use local `public/uploads/shared-files` storage for the first closed-loop MVP so the app can go live before COS integration
