# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Agent Arena is a client-only SPA (Vite, React 19, React Three Fiber, Zustand, i18next) where LLM-driven characters live on a 3D map and chat with the user. There is no backend: the browser calls LLM providers directly, using API keys stored in `localStorage`. The app deploys as a static site to GitHub Pages under the base path `/agent-arena/` on every push to `main`; the dev server serves it at `/`.

`App.tsx` picks one of three modes from the URL: the normal arena, `?embed` (one world with no UI, for iframes), and `?life` (Life in Vietnam, a separate first-person game in `src/game/`). Most of this file is about the arena; the last two Architecture sections cover the other modes.

## Commands

```bash
npm install               # also installs a pre-commit hook (lint + test) via simple-git-hooks
npm run dev               # http://localhost:5174 (port from agent-arena.yaml → dev.port)
npm run lint              # oxlint
npm test                  # vitest run --coverage; fails if src/lib coverage < 80% on any metric
npx tsc -b                # typecheck only (~1s); the pre-commit hook does NOT typecheck
npm run build             # tsc -b + vite build → dist/  (CI runs lint, test, build on Node 24)
npm run assets:inventory  # regenerate src/lib/assets/packInventory.generated.ts after adding/removing pack GLBs
```

To run one test file or one named test, call Vitest directly without coverage. `npm test -- <file>` exits 1 even when the tests pass, because the global 80% threshold is still measured over all of `src/lib`.

```bash
npx vitest run src/lib/storage.test.ts
npx vitest run src/lib/storage.test.ts -t "clampChattiness"
```

## Architecture

### Config is data, compiled at build time

- Shipped defaults live in YAML/JSON, not in TS:
  - `agent-arena.yaml`: app defaults, storage keys, graphics, provider defaults, dev port and proxies, languages.
  - `prompts.yaml`: every LLM prompt template.
  - `data/`: characters, roles, placeables, floor surfaces, map presets, builtin maps.
  
  Prefer extending these files over hardcoding values.
- A custom `yaml-import` plugin turns `.yaml` imports into JS objects. The plugin and the `@/` → `src/`, `@data/` → `data/` aliases are duplicated in `vite.config.ts` and `vitest.config.ts` (Vitest does not load the Vite config), so change both.
- Parsed YAML is cast (`raw as AppConfig`, `raw as PromptsFile`, …) with no runtime validation. A new YAML key needs a matching field in its TS interface (`src/lib/config/app.ts`, `src/lib/config/prompts.ts`, or the loader in `src/lib/assets/` / `src/lib/poly/`).
- Restart the dev server after YAML edits. `vite.config.ts` also reads `agent-arena.yaml` at startup for the port and proxies.
- `app.title` and `app.description` must stay in sync with the meta tags in `index.html`. `src/lib/config/index.test.ts` asserts on their wording.

### State: one Zustand store (`src/store/arenaStore.ts`)

- The store has two layers:
  - The persisted slice, `AppPersisted` in `src/lib/types.ts`: user name, language, models, agents, custom maps, graphics, chats, and so on.
  - Runtime-only state: `runtimeAgents`, `placeables`, `activeMap`, UI flags, `chatBusyById`.
- There is no persist middleware. Each mutating action calls `get().persist()`, which writes `persistSlice()` to localStorage. `loadPersisted()` in `src/lib/storage.ts` sanitizes every field, because localStorage may hold older or corrupt shapes, and it also runs legacy migrations (map ids, placeable ids, floor styles).
- Adding a persisted setting touches all of these (commit `978a518` is a worked example):
  1. The default in `agent-arena.yaml`.
  2. `AppConfig`.
  3. `AppPersisted`.
  4. `defaultPersisted()` and `loadPersisted()`.
  5. `persistSlice()`, plus a setter that persists.
  6. The UI and all 10 locale files.
  7. Tests in `storage.test.ts`.
- `AgentConfig` holds persisted settings; `ArenaAgent` holds runtime pose, state and speech bubble. `placeAgentsOnMap` resets everyone to spawn points (used on map change). `syncRuntimeAgents` keeps existing poses and copies in config edits. Disabled agents are never placed.
- `tick(dt, now)` is the simulation step: agents walking and wandering, wandering placeables, speech-bubble expiry. `SceneTick` in `ArenaScene.tsx` calls it every frame and skips it while the map editor is open. `dayNightBlend` is also advanced by an rAF loop in `App.tsx`, so it keeps animating while the arena is dormant.

### AI layer (`src/lib/ai/`)

- `chatCompletion()` has three callers:
  - **Private 1:1 chat:** `send()` in `src/components/ChatPanel.tsx`. It sends the last `storage.maxApiChatHistory` messages.
  - **Shared arena chat:** `sendArenaChatMessage()` in `arenaChat.ts`. With no `@mention`, every enabled agent that has a model replies. `@Name` targets agents by case-insensitive prefix match.
  - **Idle mutters:** `tickAgentChatter()` in `chatter.ts`, polled every second by `<AgentChatterLoop>`.
    - Opt-in through `idleChatterEnabled`, which is off by default.
    - Paused while the tab is hidden or while Settings or the map editor is open.
    - Writes to speech bubbles and the arena feed, never to private chat history.
- All three callers build the system prompt with `buildAgentSystemPrompt()` and prepend a `<situation>` block to the user turn with `withSituationUserMessage()`. Both live in `arenaContext.ts`; they take templates from `prompts.yaml` and world facts snapshotted from the store. Changes to prompt behavior usually belong in `prompts.yaml`.
- `chatBusyById[agentId]` is the per-agent lock:
  - Arena replies skip a busy agent.
  - Chatter aborts its request and reschedules.
  - `tick` shows the agent as thinking.
  - Move commands are ignored.
  
  `setChatBusy(id, false)` is also the point where a streamed chat is persisted (not on every token).
- Passing `onToken` makes `chatCompletion` stream. Callers batch UI updates through `requestAnimationFrame`.
- `providers.ts`:
  - Gemini and Claude have their own request and stream code. `openai`, `ollama` and `custom` share the OpenAI-compatible Chat Completions path.
  - Claude browser calls require the `anthropic-dangerous-direct-browser-access` header.
  - In dev, `resolveRequestBaseUrl()` rewrites localhost base URLs for OpenAI-compatible providers to the `/ollama` and `/local-llm/<host>/<port>/` proxies in `vite.config.ts`. Production has no proxies, so local models work only under `npm run dev`.

### Maps (`src/lib/maps/`, format "aamf v1")

- `ArenaMapDefinition` and its validator `isArenaMapDefinition` live in `schema.ts`. Every JSON in `data/maps/` is a builtin map; they are discovered with `import.meta.glob` and keyed by the file's `id` field. User maps use `custom_*` ids and live in localStorage.
- `resolveMapDefinition()` always returns a clone, so builtins are never mutated. Saving a builtin from the editor creates a custom copy.
- The map editor (`src/components/MapEditor/`) has its own `<Canvas>`:
  - It edits a local draft with undo/redo through `useMapHistory`: `commit` records a step, `setLive` doesn't, and `beginGesture`/`endGesture` wrap drags.
  - It writes back to the store only through `saveMapFromEditor`.
  - The arena Canvas stays mounted but dormant while the editor is open, to avoid WebGL context loss.
  - `useEditorSession` reads `customMaps` with `getState()` on purpose. Subscribing to it would wipe the draft on every store update.

### Assets

- Placeable ids are stored in map JSON and come from `PLACEABLE_SPECS` in `src/lib/assets/catalog.ts`. They are either curated short ids from `data/placeables.yaml` or a generated `<pack>__<slug-of-filename>` id for every other GLB in `packInventory.generated.ts`.
  - Renaming or removing a GLB changes or breaks ids that maps use.
  - If a rename is unavoidable, map the old id in `LEGACY_PLACEABLE_IDS` in `schema.ts`.
  - A GLB claimed by a curated entry gets no `<pack>__` id (`camping/Fire.glb` exists only as `fire`).
- Pack-fill GLBs are auto-fitted one by one to a target size. Packs listed under `packScale` in `data/placeables.yaml` (the graveyard and outpost kits) skip that and share one scale, so modular pieces keep their relative sizes.
- The map id `mars` is taken: `LEGACY_MAP_IDS` in `storage.ts` redirects it to `space` (the Mars builtin is `red_planet`).
- Lights and flames attach to props by name: `getLampKind()` in `src/components/scene/lampKind.ts` (light profiles live in `LampFx.tsx`) and `getFireFxKind()` in `fireFx.ts`. Each light-emitting prop adds point lights, so keep a new map near the Office map's count (about 30).
- Build asset URLs from `import.meta.env.BASE_URL` with `encodeURIComponent(file)`, because filenames contain spaces. Never hardcode `/assets/...`: production is served under `/agent-arena/`.
- Character looks (`data/characters.yaml`, GLB models) and roles (`data/roles.yaml`: persona prompt, color, name) are independent of each other. Characters, roles and map presets all reference i18n keys (`nameKey`, `blurbKey`, …) that must exist in the locale files.
- 3D assets are CC0 or CC BY, not MIT. Every new GLB needs a credit row in `public/assets/ATTRIBUTION.md` and a run of `npm run assets:inventory`.

### i18n

- Files in `src/i18n/*.json` are auto-discovered, but a locale loads only if its two-letter code is listed under `languages` in `agent-arena.yaml`. The UI language is also the reply language sent to models.
- Every locale currently has every key in `en.json`. Add new UI strings to all 10 files. Nothing enforces this; missing keys silently fall back to English.

### Embed mode (`?embed&map=<id>&time=day|night|cycle`)

- `src/lib/embed.ts` parses the URL once, at module load, into `embed`. When it is set:
  - The store hydrates from `embedPersisted()` instead of `loadPersisted()`. That is the `embed.crew` from `agent-arena.yaml`: agents with no model, so they wander but cannot chat.
  - `persist()` returns early, so an embedded world never reads or writes the visitor's localStorage.
- `App.tsx` renders `<ArenaScene embedded />` with no UI. Once every GLB from `worldModelUrls()` has loaded, it posts `{ type: "agent-arena:ready" }` to the parent window.

### Life in Vietnam mode (`src/game/`, `?life`)

- **What it is:** a first-person life simulation, lazy-loaded with `React.lazy`. While it is open, `App.tsx` renders only `<LifeGame>`, so the arena Canvas unmounts.
- **Docs:** the design spec and the implementation plan live in `docs/superpowers/`. Read the plan's "Global Constraints" and "Review Focus" sections before you change this mode.
- **Engine:** a local microsimulation in `src/game/sim/`, pure TypeScript with no React, DOM or network. `engine.ts` (`startLife`, `stepLife`) returns the same `LifeStepResult` shape the game always used, and `localTransport.ts` implements `LifeTransport` (`engine/types.ts`) over it.
  - A year runs in phases (history, relatives' deaths, illness, sudden death, school, work, family, moves, occasional decisions, year end). A phase can pause the year for a decision; the year carries on from the next phase after the choice. With no decision waiting, a step stops at ages that are multiples of 5.
  - Each decision's **first choice is the natural one**: it lets the data decide. Lives on defaults stay calibrated, so keep a new decision's first choice natural.
  - All randomness goes through the seeded `Rng` whose state lives in the token (`al1.` + base64url JSON of `SimState`). Never use `Math.random` in `src/game/sim/`.
  - Multipliers (income fifth, town/village, schooling) are rescaled to average 1 so they move people around the national rates without moving them. Crisis deaths (war, storms, COVID-19) are already inside the UN death rates: they are causes, never an extra hazard.
- **Data:** `npm run life:data` (`scripts/life-data/`) downloads UN, World Bank and UNESCO data (about 1.2 GB, cached in `.cache/life-data/`) and writes compact Viet Nam tables to `data/life/vnm/*.json`; `SOURCES.md` there records each source, transform and licence. Our own estimates and text live in `data/life/*.yaml` (effects, history, decisions, events, names, jobs, catalog); every estimate is marked.
- **Calibration tests:** `src/game/sim/calibration.test.ts` and the calibration blocks in `family`, `school`, `work` and `migration` tests check that thousands of simulated lives reproduce the tables. Print the comparisons with `npx vitest run src/game/sim/calibration.test.ts --reporter=verbose --silent=false`. `src/game/sim/**` is inside the 80% coverage gate.
- **State:** `state/lifeStore.ts` is its own Zustand store, independent of `arenaStore`. It uses two localStorage keys: `agent-arena-life` (the current run) and `agent-arena-life-lives` (completed lives). A saved run whose `engineVersion` doesn't start with `arena-life@` came from the old 1in8b Engine; it can't continue and can be kept as an unfinished memorial.
- **Flow:**
  - `engine/runLife.ts` (`startLife`, `advanceLife`, `submitChoice`, `resumeLife`) steps the engine.
  - `engine/chapters.ts` picks which beats get a staged scene (`selectTrigger`, `isMajorDecision`, reflection ages, `MAX_SCENES = 16`). Minor decisions are auto-answered with `defaultChoiceKey`.
  - `state/lifeRun.ts` folds each response into the `LifeRun` and its journal.
- **Scenes:** a `SceneDirector` turns a trigger into a `ScenePlan`.
  - The only director so far is `createDeterministicDirector` in `engine/director.ts`. It uses the decision's own `template` hint (the local engine always sends one) and falls back to matching keywords in the decision text. An LLM director is planned follow-up work.
  - `scenes/validate.ts` rejects any plan that leaves an engine choice key unbound, uses an unknown socket or character, or casts a person who is not in the engine's facts or who has died (`buildFactSheet`).
  - Each template in `scenes/templates/` wraps an aamf `ArenaMapDefinition`, so scenes reuse the arena's floors, placeables and character GLBs. A template id with no authored template falls back to a stub in `scenes/registry.ts`.
- **Text is English only:** life-mode strings are hardcoded in `src/game/ui/`. The only i18n key is `life.entry`, the HUD button.
- **Content rules:**
  - `LifeCredit` shows the data credits and a simulated-life notice on the start screen, birth card, journal, death screen and memorial; lives made by 1in8b keep its credit.
  - Self-harm is never a named cause. Never show death graphically.
  - History rows (`data/life/history.yaml`) are short, factual, neutral and sourced; rows marked `review: true` need a person's read before release.

## Testing

- Vitest runs in the `node` environment, with no DOM. `src/test/setup.ts` shims `window`, provides an in-memory `localStorage`, and makes `requestAnimationFrame` synchronous.
- Vitest collects only `src/**/*.test.ts`, so a `.test.tsx` file is silently ignored.
- The 80% coverage gate covers `src/lib/**` and `src/game/sim/**`, excluding `src/lib/three/`, generated files, `useStickToBottom.ts` and `types.ts`. Components have no tests, so logic worth testing belongs in `src/lib` (or `src/game/sim` for the life engine).
- The rest of `src/game/**/*.test.ts` runs outside the gate. `setLifeDeps()` in `lifeStore.ts` swaps in a fake transport and director.
- Mocking patterns:
  - Provider tests stub `fetch` with `vi.stubGlobal`.
  - Modules that read the store (`arenaChat`, `chatter`, `arenaContext`) mock `@/lib/ai/providers` with `vi.mock` and seed the real store with `useArenaStore.setState(...)`.
  - Shared fixtures are `sampleAgent`, `sampleModel` and `sampleMap` in `src/test/fixtures.ts`.
- For UI changes, the PR template also asks for a manual smoke check of chat plus at least one map in Chromium.
