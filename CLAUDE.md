# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                          # Start dev server on :3000
npm run build                        # Production build
npx tsc --noEmit                     # Type check only
npx prisma generate                  # Regenerate Prisma client after schema changes
npx prisma migrate dev --name <desc> # Create + apply a new migration
npx prisma studio                    # Visual DB browser
```

## Architecture

Next.js 15 App Router, TypeScript, Tailwind CSS, NextAuth.js v5, Prisma 6, PostgreSQL.

### Route groups
- `src/app/(auth)/` — public pages: `/login`, `/register`
- `src/app/(app)/` — protected pages: `/dashboard`, future meeting pages
- `src/app/api/auth/[...nextauth]/` — NextAuth handler

### Key files
| File | Role |
|------|------|
| `src/auth.ts` | NextAuth config — credentials provider, JWT callbacks |
| `src/middleware.ts` | Redirects unauthenticated users to `/login` |
| `src/lib/prisma.ts` | Singleton PrismaClient |
| `src/lib/auth-utils.ts` | bcrypt helpers |
| `prisma/schema.prisma` | DB schema — User, Meeting, ActionItem, UserSettings |

### Auth flow
Server actions call `signIn('credentials', ...)` directly. Errors redirect back with `?error=` search params. Session uses JWT strategy — no DB sessions table.

## Environment
Copy `.env.example` → `.env.local` and fill in:
- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — random string (`openssl rand -base64 32`)
- `AUTH_URL` — app base URL

## Database
Schema changes → `npx prisma migrate dev --name <description>`. After changing `schema.prisma`, always run `npx prisma generate`.

## Migration Roadmap
See `ROADMAP.md` for the 6-phase plan. Currently on Phase 1 (foundation). Phase 2 adds Whisper/Ollama API routes.
