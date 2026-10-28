# Settings workspace

The settings workspace follows LobeHub's personal-settings information architecture, using MarkAI components and data sources. Reference revision: `49204982cab98bfa2f2fb6831a34d5018a2af6be` (inspected 2026-10-28).

Reference sources:

- [Category groups](https://github.com/lobehub/lobehub/blob/49204982cab98bfa2f2fb6831a34d5018a2af6be/src/features/Settings/hooks/useCategory.tsx)
- [Sidebar](https://github.com/lobehub/lobehub/blob/49204982cab98bfa2f2fb6831a34d5018a2af6be/src/features/Settings/Layout/Body/index.tsx)
- [Profile](https://github.com/lobehub/lobehub/blob/49204982cab98bfa2f2fb6831a34d5018a2af6be/src/features/Settings/profile/index.tsx)
- [Appearance](https://github.com/lobehub/lobehub/blob/49204982cab98bfa2f2fb6831a34d5018a2af6be/src/features/Settings/appearance/index.tsx)
- [Public billing entry](https://github.com/lobehub/lobehub/blob/49204982cab98bfa2f2fb6831a34d5018a2af6be/src/business/client/BusinessSettingPages/Billing.tsx) — public commercial page entries return `null`; the commercial implementation is not included.
- [Upstream license](https://github.com/lobehub/lobehub/blob/49204982cab98bfa2f2fb6831a34d5018a2af6be/LICENSE)

No LobeHub source or packages are copied into the application. Local reference downloads are ignored. The local settings primitives are shared by all new pages. Page bodies and the workspace are loaded lazily.

## Connected features

- Profile edits and avatar uploads reuse the existing profile/upload endpoints; the account menu and profile dialog share the editor.
- Password changes use the existing Better Auth client, with revocation of other sessions.
- Appearance, conversation, shortcuts, auxiliary translation models, voice and layout preferences reuse `useSettingsStore`.
- Personalization is opt-in. The web client sends current preferences with the generation request; the server sanitizes and includes them for OpenAI-compatible, Anthropic and Gemini runtimes. This adds no synchronous settings read before generation. Older clients omitting the field retain previous behavior.
- Skill installation/removal uses `useToolStore` and the existing endpoints.
- Storage reads actual file usage and opens the existing file manager. Settings import/export uses a versioned, validated JSON envelope and excludes provider credentials, messages and files.
- `/api/settings/usage` is authenticated and rate-limited, scopes cloud queries to the authorized user, supports local SQLite, and aggregates 7/30/90-day usage. Dates use UTC. It does not expose message contents. Statistics include current saved messages, including estimated usage, and exclude deleted messages and replaced variants. They are **not a billing ledger**.

## Explicitly unavailable

User confirmed this release is UI and existing-capability integration. Subscription, credits, billing, referral rewards, trash, platform API keys, OAuth apps and labs display truthful unavailable states with disabled operations. No plan prices, credits, invoices, payment methods, keys or recovery records are fabricated. Model-provider API configuration remains available separately.

Excluded: messenger/chat-platform bindings, devices, environments, notifications, labels, memory, connectors and credential-management pages. Workspace/team administration and desktop-only system tools/proxy are not personal web settings.

## Billing follow-up

A future paid release needs a durable append-only usage/transaction ledger independent of chat history, idempotent payment webhooks, prices and entitlements, subscription lifecycle handling and an invoice/payment-provider integration. Historical chat statistics must not be used as authoritative charges.

## Source alignment follow-up (2026-10-28)

The first version did not reproduce the settings layouts sufficiently. The follow-up reads the page implementations and shared navigation/form sources, rather than using only the category registry.

| Surface | Source-aligned implementation |
| --- | --- |
| Settings shell | 44px compact header, 14px navigation labels, 18px icons in 28px slots, 36px desktop rows, 1px row gaps; content max-width 1024px and 24px desktop inset. Mobile retains 44px targets. |
| Shared forms | Filled group heading, 16px heading and inset, white outlined body with 3px outer inset, 16px form-row padding; shared by profile, appearance, security, model preferences, storage and unavailable pages. |
| Profile | 160px label column, inline value editing, avatar, username when present, email and password-settings entry. Existing profile API and save flow retained. |
| AI providers | 280px secondary navigation, 16px card inset, 24px brand marks, two-line 14px introduction, separated enable switch; enabled/custom/disabled groups, provider descriptions, detailed configuration and existing model discovery. |
| Skills | 300px secondary list, search, selected-tool introduction, features and callable capabilities; existing install/uninstall API. Shared split-view component with providers. |
| Statistics | Welcome/date metadata, cumulative cards and prior-month baselines, annual heatmap with token/message switch, peak/streak/duration summary, expandable model/assistant/topic rankings, month selector, model/provider breakdown, stacked daily trends and sorted/paginated records. |
| About | Product introduction, version, client download, source/documentation and feedback links using MarkAI destinations. |

Additional upstream references under the same pinned revision:

- `src/features/NavPanel/components/NavItem.tsx`
- `src/features/NavHeader/index.tsx`
- `src/features/Settings/stats/` (overview, visualization, rankings, usage)
- `src/features/Settings/provider/` (menu, grid, configuration)
- `src/features/Settings/skill/` and `profile/features/ProfileRow.tsx`

The local `SettingsGroup` also follows the filled-group structure documented in Lobe UI's `src/Form/components/FormGroup.tsx` and `src/Form/style.ts` (read-only reference). No runtime package imports were added.

### Shared backend and statistics contract

Android already calls this repository's Next.js `/api` endpoints using its API client and session authentication; it is not a frontend-only project. The new `/api/settings/statistics` endpoint uses the same authorization and storage infrastructure and can be consumed by either client. No parallel backend or separate database was introduced.

- `GET /api/settings/statistics`: overview, previous-month cumulative counts, annual activity and rankings.
- `GET /api/settings/statistics?view=monthly&month=2026-10&page=1&pageSize=5&sort=time&direction=desc`: monthly daily aggregates and paginated records. Page sizes are 5/10/20/50; sort is time/tokens; direction is asc/desc. Invalid month/pagination values return 400.
- Cloud SQL binds authenticated identity on every query. Local mode uses SQLite. Responses are private/no-store; source messages and secrets are not included. The existing `/api/settings/usage?days=...` contract remains available.
- MarkAI has one built-in assistant, rather than LobeHub's configurable agent entities. The assistant card identifies this explicitly; models remain separate and are distinguished by provider/model pairs.
- Duration is saved single-reply generation duration, not a fabricated agent-operation duration. Fees remain unavailable because message records have neither actual charges nor historical price snapshots. Existing user-approved restrictions on payment and new API-key/OAuth/trash backends still apply.
- Rankings return up to 50 leading records; monthly detail is paginated on the server. Deleted/replaced messages remain outside the historical dataset. This is usage analytics, not a billing ledger.

Validation includes SQLite aggregate tests, cloud SQL ownership/binding tests, UTC/leap-year/streak tests and API parameter/auth/rate-limit tests. Visual similarity is based on the inspected source; payment screens remain an independent MarkAI design because their public LobeHub implementations are empty.

### Visual refinements (2026-10-29)

The settings shell uses a 240px navigation allocation and one bordered work panel. Numeric summaries are borderless and shared dividers use a light neutral token. Scrollbars share global neutral hover styling. The MarkAI provider card follows the supplied branded-card reference without an enable-switch footer.

Monthly records show a reusable green total / gray input-output token breakdown. The daily chart includes a structured date/total/model tooltip, legend toggles, keyboard and touch inspection, and width-aware date ticks. Costs, output speed and TTFT remain unavailable when historical records do not contain those values. This refinement was not browser-tested, at the user’s request.

### Route and shared controls

Settings lives at `/settings`, with directly addressable sections such as `/settings/statistics` and `/settings/service-model`. `/setting` redirects to the canonical route. Account and command-center entries use a shared navigation hook with the existing guest sign-in guard; direct cloud requests validate the session. The page loads its settings/model dependencies independently of chat and uses the same appearance-application hook.

Service model fields use `ModelSelect`, which reuses the composer’s `ModelSelectorDialog` including search, provider groups and model details. Optional system/follow-message choices are part of the same keyboard-navigable list and do not change the chat model. Scrollbar sizing is owned by the global `--app-scrollbar-size` token (4px on Chromium/WebKit; native thin fallback on Firefox); standard scrollbar properties are reset on WebKit-capable browsers so they cannot override the pixel width.
