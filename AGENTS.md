# Repository Guidelines

## Project Structure & Module Organization

MarkAI is a Next.js 15 App Router application written in TypeScript. Route pages, layouts, and server endpoints live in `app/`; API handlers are grouped under `app/api/`. Reusable React components belong in `components/`, with chat-specific UI in `components/chat/` and primitives in `components/ui/`. Shared application logic lives in `lib/`: chat persistence and utilities are in `lib/chat/`, database schemas and access are in `lib/db/`, and external search integrations are in `lib/search/`. Zustand stores are kept in `stores/`, reusable hooks in `hooks/`, and static files in `public/`. Runtime SQLite data under `.data/` and generated `.next/` output must not be committed.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm run dev`: start the development server at `http://localhost:3000`.
- `npm run lint`: run ESLint across the repository.
- `npm run build`: create a production build and catch Next.js/type errors.
- `npm start`: run the previously built production server.
- `npm run db:generate`: generate Drizzle migrations after schema changes.
- `npm run db:migrate`: apply committed migrations; use `db:studio` for inspection.

Run `npm run lint` and `npm run build` before opening a pull request.

## Coding Style & Naming Conventions

TypeScript strict mode is enabled. Follow the existing two-space indentation, semicolon, and double-quote conventions. Use PascalCase for React components (`MessageItem.tsx`), camelCase for functions and Zustand hooks (`useChatStore.ts`), and lowercase route folders. Prefer the `@/` import alias for repository-root imports. Keep server-only database and credential logic out of client components. Use Tailwind utilities and existing UI primitives before adding new global CSS.

## Testing Guidelines

No automated test framework or coverage threshold is currently configured. For every change, lint and build the project, then manually exercise affected routes and responsive states. When introducing tests, colocate them as `*.test.ts` or `*.test.tsx` near the implementation and add the corresponding `npm test` script in the same change.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commits: `feat:`, `fix:`, `refactor:`, `style:`, and `chore:`, optionally with a scope such as `refactor(chat):`. Keep commits focused and use an imperative summary. Pull requests should explain behavior changes, list validation performed, link relevant issues, and include screenshots or recordings for UI changes. Call out database migrations and new environment variables explicitly.

## Security & Configuration

Copy `.env.example` to `.env.local` for local setup. Never commit API keys, authentication secrets, `.env`, or local database files. Update `.env.example` with safe placeholders whenever adding configuration.
