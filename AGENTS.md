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

## Product And UI Direction

MarkAI is a focused AI productivity workspace, not a marketing site. The primary experience is a chat workbench with session history, files, model controls, tools, previews, settings, and an admin console. New UI must feel quiet, capable, and optimized for repeated work. Avoid decorative landing-page composition, oversized copy, floating section cards, excessive gradients, and novelty effects that compete with conversation content.

The intended visual character is:

- Neutral and restrained: gray application canvas, white work surfaces, subtle borders, low-contrast shadows, and sparse use of color.
- Dense but not cramped: controls remain compact on desktop while preserving readable spacing and larger touch targets on mobile.
- Content-first: messages, files, generated artifacts, and operational data carry the visual hierarchy.
- Friendly in empty and authentication states: one randomly selected 3D Fluent Emoji may provide personality, while the MarkAI logo remains visible as the stable brand identifier.
- Consistent across chat, authentication, onboarding, settings, and admin. These surfaces are parts of one application, not separate visual themes.

### Brand Rules

- The canonical logo is `public/images/markai.svg`. Its current fill is blue. Do not recolor individual logo instances in components.
- The default interaction theme is black in light mode and near-white in dark mode. The logo blue and text-selection blue are separate from the interaction theme.
- The default primary color is `black` in `lib/settings.ts`. User-selected accent colors override it through `--color-primary` and `--color-primary-container`.
- Text selection remains blue through `::selection` in `app/globals.css`.
- Use `Plus Jakarta Sans` only for brand labels, model names, compact metadata, or short Latin headings. Use `Noto Sans SC` for normal UI and Chinese content.
- Write the product name as `MarkAI` in normal UI and `MARKAI` only where the existing display treatment intentionally uses uppercase.

### Color And Surface Tokens

Prefer semantic variables and existing Tailwind grays over new hard-coded colors:

- Application canvas: `--chat-app-bg`.
- Main work surface: `--chat-panel-bg`.
- Sticky translucent header: `--chat-header-bg`.
- Composer: `--chat-input-bg` plus the existing bottom overlay variables.
- Menus and popovers: `--chat-popover-bg`.
- User message bubble: `--chat-user-bubble-bg`.
- Primary interaction: `--color-primary` / Tailwind `primary`.

Use blue for the MarkAI logo, text selection, links where blue has semantic value, and small informational accents. Do not make admin navigation or ordinary menu icons multicolored. Admin status badges may retain semantic colors for success, warning, rejection, or danger, but navigation and statistic icons should use the same neutral gray treatment.

Dark mode is not a simple inversion. Use the existing near-black surfaces (`#0e0f11`, `#111214`, `#191919`) and translucent white borders. Avoid introducing blue-black or slate-heavy replacement palettes.

### Shape, Border, And Elevation

- Default controls use 6-8px radii (`rounded-md` or `rounded-lg`).
- Main application panels and composer surfaces use 12px (`rounded-xl`).
- Chat bubbles may use 16px (`rounded-2xl`) with the existing directional corner treatment.
- Circular shapes are reserved for avatars, theme toggles, selection controls, and send/stop buttons.
- Shadows should communicate layering, not decoration. Main panels usually need a border and little or no shadow. Menus, dialogs, and floating composers may use the established soft shadows.
- Do not nest decorative cards. A framed block inside a message is acceptable only when it represents a distinct artifact or auxiliary result, such as a file, chart, tool result, source list, or translation.

### Responsive Layout

- The application must work from 320px wide upward.
- The mobile breakpoint is currently `767px` / Tailwind `md` behavior in `ChatApp`.
- Desktop uses a resizable persistent sidebar and a bordered, rounded work panel with 8px outer application padding.
- Mobile uses an edge-to-edge main panel and a temporary sidebar drawer. Respect `env(safe-area-inset-bottom)` around the composer.
- Interactive controls should be at least 40-44px on touch layouts. Desktop-only compact variants may be 28-36px when the surrounding row remains easy to target.
- Touch devices must not depend on hover to discover core actions. Session menus and message actions must remain visible or otherwise reachable on mobile.
- Text must truncate or wrap safely. Do not allow model names, session titles, filenames, or translated content to resize fixed controls.

### Chat Width Behavior

- Normal conversation content is constrained to 840px for reading comfort.
- Wide mode means the message list and bottom composer both expand to the full available work-panel width.
- Preserve the width transition. Use interpolable values such as `max-width: 840px` to `max-width: 100%`; do not switch to `max-width: none`, which removes the transition.
- The welcome composer remains intentionally narrower than a wide active conversation.
- Selection mode may temporarily use full width for row-level selection highlighting.

### Motion

- Motion should clarify state changes: menu entrance, sidebar movement, width changes, accordion expansion, streaming content, and modal appearance.
- Typical UI transitions are 150-300ms. Sidebar and large split-view transitions may be 300-500ms.
- Authentication and guest pages select one random Fluent Emoji per mount. It may float subtly, but it must not cycle through different emoji while the page remains open.
- Respect `data-reduce-motion="true"`; global CSS already collapses animation and transition durations.
- Do not add perpetual decorative motion outside the small emoji/brand treatment or an explicit loading state.

### Icons, Buttons, Menus, And Tooltips

- Use `lucide-react` for general interface icons. Use `@lobehub/icons` only for model/provider brand identities.
- Icon-only buttons require an accessible name and a tooltip.
- Prefer local primitives: `IconButton`, `MenuAction`, `DropdownSurface`, `AppDialog`, `AppSelect`, `ToggleSwitch`, and `ConfirmDialog`.
- Use a familiar icon instead of a rounded text button when the command is universally recognizable.
- Destructive actions use red only in the action itself and its confirmation flow.
- Global tooltips are owned by `components/GlobalTooltip.tsx`. Prefer `aria-label` plus `data-markai-tooltip` for new icon controls. Existing `title` attributes are migrated automatically, but new code should avoid relying on the browser-native tooltip.
- Menus use neutral icons. Subordinate option sets, such as translation languages, should use a submenu instead of opening a separate dialog.

### Empty, Loading, Error, And Feedback States

- Use skeletons when the final layout is known. Avoid generic centered spinners that replace a stable work surface.
- Do not force a long splash delay. `AppBootSplash` should leave as soon as the route is ready, subject only to its short anti-flash minimum.
- User-facing errors must be Chinese and actionable. A failed assistant generation is an interrupted message with continue/regenerate options, not a normal English assistant reply.
- Toasts should be brief except for operations whose completion time is unknown. A translation loading toast must use infinite duration and be replaced by the success/error toast with the same toast ID.
- Never expose an enabled control that silently does nothing. Existing placeholder controls intentionally show `NOT_IMPLEMENTED_TOAST`; do not remove them without explicit product direction.

## Authentication And Guest Experience

- Cloud-mode anonymous access to `/` renders `GuestChatApp`; it must not immediately redirect to `/login`.
- A guest may type a draft. Sending, attaching a file, selecting a model, enabling search, or opening protected history prompts for authentication.
- Save a guest draft under `markai:guest-draft`; authenticated `ChatApp` restores and removes it.
- Explicit protected URLs, including session URLs and protected API routes, still require authentication.
- Login and registration share the full-frame auth layout in `app/(auth)/layout.tsx`.
- Auth pages retain the MarkAI logo and use one random, non-cycling 3D emoji as a friendly guide.
- Keep login callback URLs local. Reject or replace callback values that do not start with `/`.

## Component Architecture

Use the existing ownership boundaries before adding abstractions.

### Application Shell

- `components/chat/ChatApp.tsx`: chat orchestration and layout composition. It coordinates stores, route/history behavior, side panels, exports, and responsive layout. Avoid adding low-level rendering logic here.
- `components/chat/Sidebar.tsx`: navigation, grouped sessions, plugin entry, and account area.
- `components/chat/TopHeader.tsx`: active-session title and conversation-level actions.
- `components/chat/ChatInput.tsx`: composer, attachments, tools, web search, model selection, and send/stop controls.
- `components/chat/WelcomePanel.tsx`: authenticated empty state.
- `components/guest/GuestChatApp.tsx`: anonymous shell that does not call protected data APIs.

### Message Rendering

- `components/chat/MessageItem.tsx`: message-level composition and actions.
- `MarkdownContent`, `ThinkingPanel`, `MessageSources`, and the components under `components/chat/message/` own specialized message content.
- Persist auxiliary message output as typed `MessageSegment` entries when it must survive reloads and exports. Do not add a database column for every new visual block.
- Keep tool, generated-file, thinking, content, and translation segments discriminated by `type`.
- A translation is stored as a `translation` segment and rendered below the source message in a collapsible, visually distinct neutral card. The expanded region contains only the complete translated text, never a source/translation comparison.

### Dialogs And Overlays

- Use `AppDialog` for modal workflows and `ConfirmDialog` for destructive confirmation.
- Use `FloatingMenu` for message menus. It supports nested submenu items for compact option sets.
- Use `GlobalTooltip` for small contextual labels.
- Preview surfaces such as HTML and ECharts should remain framed artifacts, not generic page cards.

### State Ownership

- `useChatStore`: active messages, draft, pending attachments, streaming, editing, variants, translation, message mutation, and copy/delete actions.
- `useSessionStore`: session list, active session, loading/cancellation, history navigation, persistence, rename, favorite, and revision-aware writes.
- `useUIStore`: transient interface state including sidebar, selection, menus, wide mode, model list, selected model, web search, and plugin drawer.
- `useSettingsStore`: persisted general and language-model preferences with immediate local application and debounced server synchronization.
- `useToolStore`: installed/enabled tools and their active-session binding.

Do not duplicate store state in component state unless the value is strictly local and ephemeral, such as one open dialog, hover state, a temporary form, or an animation handoff.

## Chat And Persistence Invariants

- Switching sessions must abort the active model stream before loading another session.
- Session loading uses both `AbortController` and a monotonically increasing request ID. Preserve both protections so stale responses cannot replace the active conversation.
- Before applying streamed results to visible state, verify that the target session is still active.
- Persist the completed/interrupted message even when the user has navigated away, but do not overwrite the visible messages of another session.
- New-session creation failure must restore the user's draft and pending attachments.
- Keep the selected model as a provider/model pair using `getModelKey`; model IDs alone are not globally unique.
- Message variants must carry their content, reasoning, segments, usage, provider, and model metadata together.
- Translation updates must replace the previous translation segment for that message rather than accumulating stale translations.
- Do not place credentials, decrypted provider configuration, or database code in client components.

## Translation Contract

- The default server translation model is configured with `MARKAI_TRANSLATION_MODEL="provider/modelId"`, matching the format of `MARKAI_CONVERSATION_TITLE_MODEL`.
- User preference wins over the environment default. The settings choices are: system default, follow the source message model, or a fixed configured model.
- Resolution order is: fixed user model; explicit follow-message choice; server environment model; source-message model; currently selected chat model.
- If the environment variable is present but invalid or does not match a configured server model, return a clear error instead of silently switching models.
- Translation calls go through `/api/translate`, are authenticated/rate-limited, and send only the current message plus target language/model metadata.
- The prompt must require a complete one-to-one translation, preserve Markdown/code, never repeat the source, and never output arrows, comparison labels, or commentary.
- The server extracts the `<translation>` payload and strips common wrappers/prefixes before returning it.

## Admin UI

- Admin is an operational console and should be denser than the chat welcome state.
- Navigation icons, account-menu admin icons, and overview statistic icons are neutral gray.
- Semantic status badges may use restrained green, amber, red, indigo, or gray states.
- Charts may use multiple series colors where comparison requires them; surrounding chrome should remain neutral.
- Mobile admin navigation uses the compact four-item row already established in `AdminConsole`.

## Performance And Development Memory

The Next.js development server warning `Server is approaching the used memory threshold, restarting...` is emitted when V8 `used_heap_size` exceeds 80% of `heap_size_limit`. In the observed local environment:

- Node is `v26.3.0`.
- `NODE_OPTIONS` is unset.
- V8 heap limit is approximately 4192 MB, so Next restarts near 3354 MB used heap.
- The repository has about 202 TS/TSX files and 27k source lines.
- `@lobehub/ui`, `@lobehub/icons`, and `@lobehub/fluent-emoji` contain roughly 6.4k, 7.8k, and 3.9k files respectively.
- Additional heavy graphs include ECharts/ECharts GL, XLSX, Mammoth, DOCX, syntax highlighting, and auth/database dependencies.

Development-memory rules:

- Avoid new imports from the `@lobehub/ui` top-level barrel. Prefer existing local wrappers or a documented targeted subpath export.
- Do not import an entire model-icon package when a provider-specific export exists.
- Dynamically import heavy preview/editor/export code that is not needed on the initial chat route.
- Keep server-only Office parsers and generators out of client dependency graphs.
- Split very large components when the split creates a real lazy-load or ownership boundary; splitting files alone does not reduce the module graph.
- Prefer an active Node LTS release supported by the installed Next version (Node 20 or 22) over Node 26 for routine development.
- Consider `experimental.optimizePackageImports` for LobeHub packages only after verifying their export behavior and measuring module counts.
- Increasing `NODE_OPTIONS=--max-old-space-size=6144` is a temporary mitigation, not the primary fix. It moves the 80% restart threshold to roughly 4.9 GB but does not shrink the graph.
- Do not disable Next's memory watcher as a normal solution; that converts a controlled restart into a possible out-of-memory crash.
- Never run `next build` and `next dev` concurrently in the same checkout because both write `.next` and can corrupt manifests/chunks. Stop the dev server first, use a separate worktree/dist directory, or let the user run the server/build.
- Agents must not start the dev server or run a production build when the user says they own the running port. Use `npm run lint` and `npx tsc --noEmit --incremental false` for non-mutating validation in that case.

Recommended investigation order for memory regressions:

1. Record Node version, heap limit, and `NODE_OPTIONS`.
2. Inspect the route's compiled module count and which package barrels entered the graph.
3. Move heavy optional panels behind dynamic imports.
4. Replace broad imports with targeted imports/local primitives.
5. Retest on Node 20/22 LTS with a clean `.next` directory and only one Next process.
6. Raise the heap limit only if the optimized graph still legitimately needs more memory.

## Validation Checklist

For UI or chat changes, validate in proportion to scope:

- Run `npm run lint`.
- Run `npx tsc --noEmit --incremental false` when a full build is inappropriate or would interfere with the user's dev server.
- Run `npm run build` before a PR only when no dev server shares the checkout and the user has not prohibited it.
- Check `git diff --check`.
- Exercise light and dark modes.
- Check at least one desktop viewport and a 390px mobile viewport.
- Verify no horizontal overflow, overlay collisions, or text clipping.
- Test touch reachability for sidebar, composer, message actions, dialogs, and menus.
- For streaming changes, test completion, abort, error, navigation during stream, and persistence after reload.
- For translation, test system model, user override, target-language submenu, loading toast persistence, pure translated output, collapse/expand, and reload persistence.
- For auth changes, test anonymous `/`, deferred login prompt, draft restoration, direct protected URL redirect, login callback sanitization, and registration modes.
