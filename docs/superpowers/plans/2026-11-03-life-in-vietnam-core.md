# Life in Vietnam — Core Arc Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a complete, playable birth-to-death arc for the Life in Vietnam mode: a BYO-key 1in8b Engine run, a first-person 3D scene per major beat, a journal that keeps the full record, and a death/memorial ending.

**Architecture:** A lazy-loaded `src/game` mode inside Agent Arena. The 1in8b `/live` endpoint owns the life; a pure run model and chapter planner decide which beats become scenes; a deterministic scene director stages those beats from authored templates; an R3F renderer puts the player inside the scene in first person. The LLM scene director is a later plan behind the same `SceneDirector` interface.

**Tech Stack:** React 19, React Three Fiber, three.js, Zustand, TypeScript, Vite, Vitest, the 1in8b REST API.

**Spec:** `docs/superpowers/specs/2026-11-03-life-in-vietnam-design.md`

## Global Constraints

- Country is always `VNM`; the mode is set in Vietnam.
- The player brings their own `k8b_` key. Store it only in `localStorage` under `agent-arena-life-key`. Never put it in source, the run JSON, prompts, logs, analytics, or error text. The only destination is `https://1in8b.life/api/v1/live`.
- Start every engine life with `sensitive: 0` and `suicide: 0`.
- Show the credit **“1in8b Engine (1in8b.life)”** and the line **“Simulated lives, not real people.”** on the start screen, birth card, journal, death review, and memorial.
- Ages 15+. No graphic death, war, or sensitive content. Death is off-screen and quiet.
- English UI and dialogue first; Vietnamese names and terms are welcome. Other locales fall back to English.
- 12–16 staged scenes per life; 45–75 minutes. `MAX_SCENES = 16`.
- This plan ships one era kit, `modern` (2016–2026), plus the `future` flag falling back to it. Era expansion is a follow-up plan.
- No new runtime dependencies. Reuse React, R3F, three, Zustand, Vitest, and the repo’s existing assets.
- No custom character GLBs in this plan. Scale the existing adult GLBs by age.
- `npm run lint`, `npm test`, and `npm run build` must pass. New logic gets tests even though the 80% coverage threshold is scoped to `src/lib`.
- Commit after every task.

## Review Focus

These are the failure modes most likely to bite a real player. Each gets a test in the task that owns the code.

1. **A loose `/live` response.** `state` may omit `name`, `partner`, `kids`, `place`, or other optional fields. The adapter and UI must tolerate it and fall back to neutral labels, never crash.
2. **An expired or revoked key mid-run.** The game must show a recoverable error, keep the token and journal, and let the player paste a new key without restarting the life.
3. **Death before the first staged scene.** An infant or child death must still produce a birth card, a journal, a death review, and a memorial; never an empty arc or a stuck scene.
4. **A decision whose choice key is missing from the plan.** The fallback director must bind every engine choice; a plan that misses one is rejected and replaced.
5. **Quota or rate limit.** A `month`, `rate`, or `free_day` error must preserve the run, explain the reset, and offer “resume when available,” not lose the life.

---

## File Structure

```
src/game/
  LifeGame.tsx                     phase router, lazy entry, resume prompt
  engine/
    types.ts                       API response types + runtime guards
    oneIn8b.ts                     transport, key storage, errors
    chapters.ts                    chapter table, major-decision rule, beat selection
    director.ts                    SceneDirector interface + deterministic director
    runLife.ts                     async run controller (start/advance/choose/focus/buy)
    oneIn8b.test.ts
    chapters.test.ts
    director.test.ts
    runLife.test.ts
  state/
    lifeRun.ts                     pure run model + journal
    persistence.ts                 run/completed-life localStorage
    lifeStore.ts                   Zustand wrapper around runLife
    lifeRun.test.ts
    persistence.test.ts
  scenes/
    types.ts                       SceneTemplate, ScenePlan, fact sheet
    validate.ts                    plan + fact validation
    registry.ts                    template registry + dressing
    templates/homeChildhood.ts
    templates/schoolClassroom.ts
    templates/schoolyard.ts
    templates/streetNeighborhood.ts
    templates/workplace.ts
    templates/hospital.ts
    templates/cemeteryMemorial.ts
    templates/birthHome.ts
    templates/homeFamily.ts
    validate.test.ts
    registry.test.ts
    LifeScene.tsx                  R3F scene composition
    LifeCharacter.tsx              GLB character, age scaling, speech
    LifeProps.tsx                  map placeables + primitives
    SceneLighting.tsx
  controls/
    movement.ts                    pure movement + bounds helpers
    FirstPersonControls.tsx        pointer lock + WASD + touch joystick
    movement.test.ts
  ui/
    StartScreen.tsx
    BirthCard.tsx
    LifeHud.tsx
    Dialogue.tsx
    InteractPrompt.tsx
    Journal.tsx
    Summary.tsx
    Reflection.tsx
    PauseMenu.tsx
    DeathScreen.tsx
    Memorial.tsx
    LifeSettings.tsx
  audio/
    ambience.ts                    optional, phase 4; stub only
  life.css                         mode-scoped styles
```

Modify:

- `src/App.tsx` — lazy life mode + `?life` entry.
- `src/components/Hud.tsx` — “Live a life” button.
- `src/i18n/en.json` — `life.*` keys. Other locales fall back to English.

---

### Task 1: 1in8b types and transport

**Files:**
- Create: `src/game/engine/types.ts`
- Create: `src/game/engine/oneIn8b.ts`
- Test: `src/game/engine/oneIn8b.test.ts`

**Interfaces:**
- Consumes: `localStorage` (mocked in tests), global `fetch` (injectable).
- Produces:
  - `StartOptions`, `StepBody`, `LiveResponse`, `OneIn8bState`, `OneIn8bDecision`, `OneIn8bChoice`, `OneIn8bFocus`, `OneIn8bSheetItem`, `OneIn8bUsage`, `OneIn8bMeta`.
  - `class OneIn8bError extends Error { code: string; status: number }`.
  - `interface LifeTransport { start(options: StartOptions, signal?: AbortSignal): Promise<LiveResponse>; step(body: StepBody, signal?: AbortSignal): Promise<LiveResponse>; }`.
  - `createOneIn8bTransport(key: string, fetchImpl?: typeof fetch): LifeTransport`.
  - `readLifeKey(): string | null`, `writeLifeKey(key: string): void`, `clearLifeKey(): void`.
  - `LIFE_KEY_STORAGE = "agent-arena-life-key"`.

- [ ] **Step 1: Write the failing transport tests**

Create `src/game/engine/oneIn8b.test.ts` with these cases:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LIFE_KEY_STORAGE,
  OneIn8bError,
  clearLifeKey,
  createOneIn8bTransport,
  readLifeKey,
  writeLifeKey,
} from "@/game/engine/oneIn8b";

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const baseResponse = {
  state: { age: 0, name: "Lan" },
  events: [],
  decision: null,
  token: "tok_1",
  ended: false,
  meta: { engine: "0.9.22", kind: "live" },
  usage: { used: 1, quota: 2000 },
};

afterEach(() => {
  localStorage.clear();
});

describe("createOneIn8bTransport", () => {
  it("starts a Vietnam life with the key in the header only", async () => {
    const fetchMock = vi.fn(async () => ok(baseResponse));
    const transport = createOneIn8bTransport(
      "k8b_test",
      fetchMock as unknown as typeof fetch,
    );

    const res = await transport.start({
      country: "VNM",
      sex: "female",
      year: 1995,
      sensitive: 0,
      suicide: 0,
    });

    expect(res.state.name).toBe("Lan");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://1in8b.life/api/v1/live");
    expect(init).toMatchObject({ method: "POST" });
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer k8b_test",
    });
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toMatchObject({
      country: "VNM",
      sex: "female",
      year: 1995,
      sensitive: 0,
      suicide: 0,
    });
    expect(body.key).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("k8b_test");
  });

  it("sends step choices without losing the token", async () => {
    const fetchMock = vi.fn(async () => ok(baseResponse));
    const transport = createOneIn8bTransport(
      "k8b_test",
      fetchMock as unknown as typeof fetch,
    );
    await transport.step({ token: "tok_1", choose: "study", focus: "books" });
    const body = JSON.parse(
      String((fetchMock.mock.calls[0]![1] as RequestInit).body),
    );
    expect(body).toEqual({
      token: "tok_1",
      choose: "study",
      focus: "books",
    });
  });

  it("maps a 401 to a key error", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ error: "bad key", code: "key", status: 401 }),
        { status: 401 },
      ),
    );
    const transport = createOneIn8bTransport(
      "k8b_bad",
      fetchMock as unknown as typeof fetch,
    );
    await expect(transport.start({ country: "VNM" })).rejects.toMatchObject({
      code: "key",
      status: 401,
    });
    await expect(transport.start({ country: "VNM" })).rejects.toBeInstanceOf(
      OneIn8bError,
    );
  });

  it("tolerates a loose state with missing optional fields", async () => {
    const fetchMock = vi.fn(async () =>
      ok({
        state: { age: 0 },
        events: [],
        decision: null,
        token: "tok_1",
        ended: false,
      }),
    );
    const transport = createOneIn8bTransport(
      "k8b_test",
      fetchMock as unknown as typeof fetch,
    );
    const res = await transport.start({ country: "VNM" });
    expect(res.state).toEqual({ age: 0 });
    expect(res.state.name).toBeUndefined();
  });
});

describe("life key storage", () => {
  it("stores, reads, and clears the key under its own localStorage key", () => {
    expect(readLifeKey()).toBeNull();
    writeLifeKey("k8b_test");
    expect(localStorage.getItem(LIFE_KEY_STORAGE)).toBe("k8b_test");
    expect(readLifeKey()).toBe("k8b_test");
    clearLifeKey();
    expect(readLifeKey()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game/engine/oneIn8b.test.ts`
Expected: FAIL — module `@/game/engine/oneIn8b` not found.

- [ ] **Step 3: Implement the types and transport**

Create `src/game/engine/types.ts` with the response types. Keep `OneIn8bState` loose:

```ts
export interface OneIn8bState {
  name?: string;
  age: number;
  year?: number;
  country?: string;
  place?: string | boolean;
  job?: string | null;
  income?: number;
  net_worth?: number;
  health?: number;
  happiness?: number;
  knowledge?: number;
  bonds?: number;
  education?: string;
  partner?: unknown;
  kids?: unknown;
  mother?: unknown;
  father?: unknown;
  siblings?: unknown;
  household?: unknown;
  who?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface OneIn8bChoice {
  key: string;
  label: string;
  note?: string;
}

export interface OneIn8bDecision {
  id: string;
  question: string;
  about?: string;
  fact?: string;
  choices: OneIn8bChoice[];
}

export interface OneIn8bFocusOption {
  key: string;
  label: string;
  [key: string]: unknown;
}

export interface OneIn8bFocus {
  now?: string;
  options?: OneIn8bFocusOption[];
  [key: string]: unknown;
}

export interface OneIn8bSheetItem {
  id: string;
  name: string;
  does?: string;
  price_ppp?: number;
  can?: boolean;
  why?: string;
  [key: string]: unknown;
}

export interface OneIn8bMeta {
  kind?: string;
  tier?: string;
  engine?: string;
  simulated?: string;
  docs?: string;
  credit?: string;
  [key: string]: unknown;
}

export interface OneIn8bUsage {
  month?: string;
  unit?: string;
  used?: number;
  quota?: number;
  this_call?: number;
  [key: string]: unknown;
}

export interface OneIn8bDeath {
  age?: number;
  cause?: string;
  cause_of_death?: string;
  [key: string]: unknown;
}

export type OneIn8bEvent = [number, string] | [number, string, string];

export interface LiveResponse {
  state: OneIn8bState;
  events: OneIn8bEvent[];
  decision: OneIn8bDecision | null;
  focus?: OneIn8bFocus;
  sheet?: OneIn8bSheetItem[];
  ended?: boolean;
  death?: OneIn8bDeath | null;
  token: string | null;
  meta?: OneIn8bMeta;
  usage?: OneIn8bUsage;
  error?: string;
  code?: string;
  status?: number;
}

export interface StartOptions {
  country: string;
  sex?: "female" | "male";
  year?: number;
  future?: boolean;
  fifth?: string;
  place?: "town" | "village";
  faith?: string;
  policy?: "auto" | "ambitious";
  seed?: number;
  sensitive?: 0 | 1;
  suicide?: 0 | 1;
}

export interface StepBody {
  token: string;
  choose?: string;
  focus?: string;
  buy?: string[];
  until?: "decision" | "year" | number;
  view?: boolean;
}
```

Create `src/game/engine/oneIn8b.ts`:

- `LIFE_KEY_STORAGE = "agent-arena-life-key"`.
- `API_BASE = "https://1in8b.life/api/v1"`.
- `readLifeKey` returns the trimmed value or null; `writeLifeKey` trims and writes; `clearLifeKey` removes.
- `createOneIn8bTransport(key, fetchImpl = fetch)` returns `{ start, step }`.
- `post(body)` does `fetchImpl(`${API_BASE}/live`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(body) })`.
- On non-2xx, parse `{ error, code, status }` defensively and throw `OneIn8bError(message, code ?? "http", status)`.
- On network failure, throw `OneIn8bError("Network error", "network", 0)`.
- On 200, validate `state` is an object and `events` is an array; default `events` to `[]`, `decision` to `null`, `token` to `null`. Do not require optional fields.
- Never include the key in the body or in the thrown message.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/game/engine/oneIn8b.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/game/engine/types.ts src/game/engine/oneIn8b.ts src/game/engine/oneIn8b.test.ts
git commit -m "feat(life): add 1in8b engine types and transport"
```

---

### Task 2: Run model, journal, and persistence

**Files:**
- Create: `src/game/state/lifeRun.ts`
- Create: `src/game/state/persistence.ts`
- Test: `src/game/state/lifeRun.test.ts`
- Test: `src/game/state/persistence.test.ts`

**Interfaces:**
- Consumes: `LiveResponse`, `OneIn8bState`, `OneIn8bDecision`, `OneIn8bDeath`, `OneIn8bUsage`, `OneIn8bMeta` from `@/game/engine/types`; `uid` from `@/lib/storage`.
- Produces:
  - `type LifePhase = "setup" | "birth" | "scene" | "summary" | "reflection" | "death" | "review" | "memorial"`.
  - `interface LifeConfig { year?: number; future?: boolean; sex?: "female" | "male" | "random"; fifth?: string; place?: "town" | "village"; seed?: number; }`.
  - `interface JournalEntry { id: string; age: number; year?: number; text: string; source?: string; kind: "event" | "decision" | "summary" | "thought" | "birth"; choiceKey?: string; }`.
  - `interface LifeRun { id: string; startedAt: number; engineVersion: string; config: LifeConfig; token: string; state: OneIn8bState; decision: OneIn8bDecision | null; focus: OneIn8bFocus | null; sheet: OneIn8bSheetItem[]; journal: JournalEntry[]; thoughts: Record<number, string>; chapterIndex: number; sceneCount: number; ended: boolean; death: OneIn8bDeath | null; phase: LifePhase; meta: OneIn8bMeta | null; usage: OneIn8bUsage | null; }`.
  - `interface CompletedLife { id: string; name: string; country: string; bornYear?: number; diedYear?: number; ageAtDeath?: number; cause?: string; journal: JournalEntry[]; thoughts: Record<number, string>; sceneTitles: string[]; completedAt: number; engineVersion: string; }`.
  - `createRun(config, res): LifeRun`.
  - `applyLiveResponse(run, res): LifeRun`.
  - `journalFromResponse(res, kind, year?): JournalEntry[]`.
  - `addThought(run, age, text): LifeRun`.
  - `completeRun(run, sceneTitles): CompletedLife`.
  - `LIFE_RUN_STORAGE = "agent-arena-life"`, `LIFE_LIVES_STORAGE = "agent-arena-life-lives"`.
  - `saveRun(run)`, `loadRun(): LifeRun | null`, `clearRun()`, `saveCompletedLife(life)`, `loadCompletedLives(): CompletedLife[]`.

- [ ] **Step 1: Write the failing run tests**

Create `src/game/state/lifeRun.test.ts` with these cases:

```ts
import { describe, expect, it } from "vitest";
import {
  addThought,
  applyLiveResponse,
  completeRun,
  createRun,
  journalFromResponse,
  type LifeRun,
} from "@/game/state/lifeRun";
import type { LiveResponse } from "@/game/engine/types";

const start: LiveResponse = {
  state: { age: 0, name: "Lan", year: 1995, country: "VNM" },
  events: [[0, "You were born in a village in Vietnam."]],
  decision: null,
  token: "tok_1",
  ended: false,
  meta: { engine: "0.9.22" },
};

describe("createRun", () => {
  it("starts at birth and keeps the first record", () => {
    const run = createRun({ year: 1995 }, start);
    expect(run.phase).toBe("birth");
    expect(run.token).toBe("tok_1");
    expect(run.engineVersion).toBe("0.9.22");
    expect(run.journal[0]).toMatchObject({
      age: 0,
      text: "You were born in a village in Vietnam.",
      kind: "birth",
    });
  });
});

describe("applyLiveResponse", () => {
  it("appends events with their source, updates the token, and ends", () => {
    const run = createRun({}, start);
    const next = applyLiveResponse(run, {
      state: { age: 80, name: "Lan" },
      events: [[80, "You died at home.", "A source note"]],
      decision: null,
      token: "tok_2",
      ended: true,
      death: { age: 80, cause: "old age" },
    });
    expect(next.token).toBe("tok_2");
    expect(next.journal.at(-1)).toMatchObject({
      age: 80,
      source: "A source note",
      kind: "event",
    });
    expect(next.ended).toBe(true);
    expect(next.phase).toBe("death");
    expect(next.death?.cause).toBe("old age");
  });

  it("tolerates a missing token by keeping the previous one", () => {
    const run = createRun({}, start);
    const next = applyLiveResponse(run, {
      state: { age: 1 },
      events: [],
      decision: null,
      token: null,
    });
    expect(next.token).toBe("tok_1");
  });
});

describe("journalFromResponse", () => {
  it("maps both two- and three-element events", () => {
    const entries = journalFromResponse(
      {
        state: { age: 2 },
        events: [
          [2, "You spoke your first word."],
          [2, "A historical note.", "UN source"],
        ],
        decision: null,
        token: "t",
      },
      "event",
    );
    expect(entries).toHaveLength(2);
    expect(entries[1]!.source).toBe("UN source");
  });
});

describe("addThought", () => {
  it("stores the thought and appends a journal entry", () => {
    const run = createRun({}, start);
    const next = addThought(run, 5, "I took clean water for granted.");
    expect(next.thoughts[5]).toBe("I took clean water for granted.");
    expect(next.journal.at(-1)).toMatchObject({
      kind: "thought",
      age: 5,
    });
  });
});

describe("completeRun", () => {
  it("builds a memorial summary", () => {
    const run = createRun({ year: 1995 }, start);
    const done = applyLiveResponse(run, {
      state: { age: 80, name: "Lan", year: 2075 },
      events: [],
      decision: null,
      token: "tok_2",
      ended: true,
      death: { age: 80, cause: "old age" },
    });
    const life = completeRun(done, ["Birth", "First day of school"]);
    expect(life).toMatchObject({
      name: "Lan",
      country: "VNM",
      bornYear: 1995,
      diedYear: 2075,
      ageAtDeath: 80,
      cause: "old age",
    });
    expect(life.sceneTitles).toEqual(["Birth", "First day of school"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game/state/lifeRun.test.ts`
Expected: FAIL — `@/game/state/lifeRun` not found.

- [ ] **Step 3: Implement `lifeRun.ts`**

Implement the functions with these rules:

- `journalFromResponse` creates stable ids with `uid("j")`, copies the age/text/source, and uses the passed `kind`.
- `createRun` sets `phase` to `"birth"` unless `res.ended`, in which case `"death"`.
- `applyLiveResponse` preserves the previous token when `res.token` is null, appends journal entries, sets `decision` to `res.decision ?? null`, and sets `phase` to `"death"` when ended.
- `addThought` trims the text; empty text returns the run unchanged.
- `completeRun` reads `state.name`, `state.country`, `state.year`, `death.cause ?? death.cause_of_death`, and the first birth event's age/year.

- [ ] **Step 4: Write the failing persistence tests**

Create `src/game/state/persistence.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import {
  LIFE_LIVES_STORAGE,
  LIFE_RUN_STORAGE,
  clearRun,
  loadCompletedLives,
  loadRun,
  saveCompletedLife,
  saveRun,
} from "@/game/state/persistence";
import { completeRun, createRun } from "@/game/state/lifeRun";

const start = {
  state: { age: 0, name: "Lan", year: 1995, country: "VNM" },
  events: [[0, "You were born."]],
  decision: null,
  token: "tok_1",
  ended: false,
};

afterEach(() => localStorage.clear());

describe("run persistence", () => {
  it("round-trips a run and never stores the API key", () => {
    const run = createRun({ year: 1995 }, start);
    saveRun(run);
    const raw = localStorage.getItem(LIFE_RUN_STORAGE) ?? "";
    expect(raw).not.toContain("k8b_");
    expect(loadRun()?.state.name).toBe("Lan");
    clearRun();
    expect(loadRun()).toBeNull();
  });

  it("returns null for corrupt data", () => {
    localStorage.setItem(LIFE_RUN_STORAGE, "{nope");
    expect(loadRun()).toBeNull();
  });
});

describe("completed lives", () => {
  it("prepends a life and caps the list", () => {
    const run = createRun({ year: 1995 }, start);
    for (let i = 0; i < 25; i++) {
      saveCompletedLife(completeRun(run, []));
    }
    const lives = loadCompletedLives();
    expect(lives).toHaveLength(20);
    expect(localStorage.getItem(LIFE_LIVES_STORAGE)).not.toContain("k8b_");
  });
});
```

- [ ] **Step 5: Implement `persistence.ts` and run the tests**

Create the storage functions with defensive JSON parsing, a 20-life cap, and no key handling. Run:

`npx vitest run src/game/state/lifeRun.test.ts src/game/state/persistence.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/state/lifeRun.ts src/game/state/persistence.ts src/game/state/lifeRun.test.ts src/game/state/persistence.test.ts
git commit -m "feat(life): add run model, journal, and persistence"
```

---

### Task 3: Chapter planner and major-decision rule

**Files:**
- Create: `src/game/engine/chapters.ts`
- Test: `src/game/engine/chapters.test.ts`

**Interfaces:**
- Consumes: `OneIn8bDecision`, `LiveResponse` from `@/game/engine/types`; `LifeRun` from `@/game/state/lifeRun`.
- Produces:
  - `MAX_SCENES = 16`.
  - `REFLECTION_AGES = [5, 15, 30, 50, 70] as const`.
  - `interface ChapterSpec { id: string; title: string; fromAge: number; toAge: number; }`.
  - `CHAPTERS: readonly ChapterSpec[]`.
  - `chapterForAge(age: number): ChapterSpec`.
  - `chapterIndexForAge(age: number): number`.
  - `isReflectionAge(age: number): boolean`.
  - `isMajorDecision(decision: OneIn8bDecision | null): boolean`.
  - `type SceneTriggerKind = "birth" | "decision" | "event" | "reflection" | "death"`.
  - `interface SceneTrigger { kind: SceneTriggerKind; id: string; age: number; decision?: OneIn8bDecision; eventText?: string; }`.
  - `selectTrigger(input: { run: LifeRun; previousAge: number; response: LiveResponse; sceneCount: number; reflectedAges: ReadonlySet<number>; }): SceneTrigger | null`.
  - `defaultChoiceKey(decision: OneIn8bDecision): string` — first choice key, used only for auto-resolving a minor decision, never to replace a player's choice.

- [ ] **Step 1: Write the failing chapter tests**

Create `src/game/engine/chapters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CHAPTERS,
  MAX_SCENES,
  chapterForAge,
  defaultChoiceKey,
  isMajorDecision,
  isReflectionAge,
  selectTrigger,
} from "@/game/engine/chapters";
import type { LifeRun } from "@/game/state/lifeRun";
import type { LiveResponse, OneIn8bDecision } from "@/game/engine/types";

const decision = (about: string): OneIn8bDecision => ({
  id: `dec_${about}`,
  question: "What do you do?",
  about,
  choices: [
    { key: "a", label: "Study" },
    { key: "b", label: "Work" },
  ],
});

const runAt = (age: number): LifeRun => ({
  id: "r",
  startedAt: 0,
  engineVersion: "e",
  config: {},
  token: "t",
  state: { age },
  decision: null,
  focus: null,
  sheet: [],
  journal: [],
  thoughts: {},
  chapterIndex: 0,
  sceneCount: 0,
  ended: false,
  death: null,
  phase: "scene",
  meta: null,
  usage: null,
});

const response = (patch: Partial<LiveResponse>): LiveResponse => ({
  state: { age: 0 },
  events: [],
  decision: null,
  token: "t",
  ...patch,
});

describe("chapterForAge", () => {
  it("maps ages to the chapter table", () => {
    expect(chapterForAge(0).id).toBe("birth");
    expect(chapterForAge(3).id).toBe("early_childhood");
    expect(chapterForAge(8).id).toBe("school");
    expect(chapterForAge(16).id).toBe("adolescence");
    expect(chapterForAge(40).id).toBe("midlife");
    expect(chapterForAge(75).id).toBe("elder");
    expect(CHAPTERS.length).toBe(8);
  });
});

describe("isMajorDecision", () => {
  it("accepts the staged domains and rejects the rest", () => {
    for (const about of [
      "school",
      "work",
      "partner",
      "children",
      "migration",
      "health",
      "parent",
    ]) {
      expect(isMajorDecision(decision(about))).toBe(true);
    }
    expect(isMajorDecision(decision("weather"))).toBe(false);
    expect(isMajorDecision(null)).toBe(false);
  });
});

describe("isReflectionAge", () => {
  it("matches the five pause ages", () => {
    for (const age of [5, 15, 30, 50, 70]) {
      expect(isReflectionAge(age)).toBe(true);
    }
    expect(isReflectionAge(6)).toBe(false);
  });
});

describe("selectTrigger", () => {
  it("stages a major decision", () => {
    const trigger = selectTrigger({
      run: runAt(10),
      previousAge: 9,
      response: response({ state: { age: 10 }, decision: decision("school") }),
      sceneCount: 0,
      reflectedAges: new Set(),
    });
    expect(trigger).toMatchObject({ kind: "decision", age: 10 });
  });

  it("does not stage a minor decision", () => {
    const trigger = selectTrigger({
      run: runAt(10),
      previousAge: 9,
      response: response({ state: { age: 10 }, decision: decision("weather") }),
      sceneCount: 0,
      reflectedAges: new Set(),
    });
    expect(trigger).toBeNull();
  });

  it("stages birth on the start response", () => {
    const trigger = selectTrigger({
      run: runAt(0),
      previousAge: -1,
      response: response({ state: { age: 0 } }),
      sceneCount: 0,
      reflectedAges: new Set(),
    });
    expect(trigger).toMatchObject({ kind: "birth", age: 0 });
  });

  it("stages a chapter boundary as an event", () => {
    const trigger = selectTrigger({
      run: runAt(6),
      previousAge: 5,
      response: response({ state: { age: 6 } }),
      sceneCount: 0,
      reflectedAges: new Set(),
    });
    expect(trigger).toMatchObject({ kind: "event", age: 6 });
  });

  it("stages a reflection once", () => {
    const trigger = selectTrigger({
      run: runAt(5),
      previousAge: 4,
      response: response({ state: { age: 5 } }),
      sceneCount: 0,
      reflectedAges: new Set(),
    });
    expect(trigger).toMatchObject({ kind: "reflection", age: 5 });
    const again = selectTrigger({
      run: runAt(5),
      previousAge: 4,
      response: response({ state: { age: 5 } }),
      sceneCount: 0,
      reflectedAges: new Set([5]),
    });
    expect(again).toBeNull();
  });

  it("always stages death, even after the scene cap", () => {
    const trigger = selectTrigger({
      run: runAt(80),
      previousAge: 79,
      response: response({
        state: { age: 80 },
        ended: true,
        death: { age: 80 },
      }),
      sceneCount: MAX_SCENES,
      reflectedAges: new Set(),
    });
    expect(trigger).toMatchObject({ kind: "death", age: 80 });
  });

  it("stops new scenes at the cap", () => {
    const trigger = selectTrigger({
      run: runAt(40),
      previousAge: 39,
      response: response({ state: { age: 40 }, decision: decision("work") }),
      sceneCount: MAX_SCENES,
      reflectedAges: new Set(),
    });
    expect(trigger).toBeNull();
  });
});

describe("defaultChoiceKey", () => {
  it("returns the first choice key", () => {
    expect(defaultChoiceKey(decision("work"))).toBe("a");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game/engine/chapters.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `chapters.ts`**

Rules:

- `CHAPTERS` exactly as the design’s chapter table: `birth` 0, `early_childhood` 1–5, `school` 6–11, `adolescence` 12–18, `early_adulthood` 19–29, `midlife` 30–49, `late_life` 50–69, `elder` 70–200.
- `isMajorDecision` lowercases `about` and `question`, then checks for these substrings: `school`, `educat`, `exam`, `univers`, `job`, `work`, `career`, `partner`, `marri`, `child`, `pregnan`, `migrat`, `move`, `abroad`, `health`, `illness`, `sick`, `hospital`, `parent`, `death`, `care`, `money`, `debt`.
- `selectTrigger` order: death → birth (when `previousAge < 0` and `age === 0`) → scene cap (return `null` except death) → major decision → reflection → chapter boundary → `null`.
- `previousAge` comes from the run before the response was applied. The chapter-boundary trigger fires when `chapterForAge(age).id !== chapterForAge(previousAge).id`.
- The run controller passes `previousAge: -1` for the start response so birth is always a scene.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/game/engine/chapters.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/game/engine/chapters.ts src/game/engine/chapters.test.ts
git commit -m "feat(life): add chapter planner and major-decision rule"
```

---

### Task 4: Scene types, validation, and fact guard

**Files:**
- Create: `src/game/scenes/types.ts`
- Create: `src/game/scenes/validate.ts`
- Test: `src/game/scenes/validate.test.ts`

**Interfaces:**
- Consumes: `ArenaMapDefinition` from `@/lib/maps/schema`; `OneIn8bState` from `@/game/engine/types`.
- Produces:
  - `type LifeTemplateId = "birth_home" | "birth_hospital" | "home_childhood" | "home_family" | "school_classroom" | "schoolyard" | "street_neighborhood" | "workplace_office" | "workplace_shop" | "workplace_factory" | "farm_field" | "hospital" | "temple_church" | "cemetery_memorial" | "wedding_home" | "station"`.
  - `interface SceneSocket { position: [number, number, number]; rotationY: number; }`.
  - `interface SceneInteractableDef { id: string; socket: string; label: string; kind: "talk" | "look" | "use"; }`.
  - `interface SceneTemplate { id: LifeTemplateId; name: string; map: ArenaMapDefinition; sockets: Record<string, SceneSocket>; bounds: { minX: number; maxX: number; minZ: number; maxZ: number }; interactables: SceneInteractableDef[]; }`.
  - `interface SceneCastMember { role: string; name: string; age: number; characterId: string; mood: string; socket: string; lines: string[]; }`.
  - `interface SceneInteractable { id: string; socket: string; label: string; kind: "talk" | "look" | "use"; choiceKey?: string; focusKey?: string; }`.
  - `interface ScenePlan { template: LifeTemplateId; title: string; summary: string; timeOfDay: "morning" | "noon" | "afternoon" | "evening" | "night"; weather: "clear" | "rain" | "overcast" | "hot"; cast: SceneCastMember[]; player: { socket: string; age: number; cameraHeight: number }; dialogue: Array<{ speaker: string; text: string }>; interactables: SceneInteractable[]; choiceBindings: Record<string, string>; ambience: string; }`.
  - `interface LifeFactSheet { playerName: string; age: number; year?: number; place?: string; job?: string; partner?: string; children: string[]; people: Array<{ name: string; role: string; age?: number; alive: boolean; }>; }`.
  - `buildFactSheet(state: OneIn8bState): LifeFactSheet`.
  - `interface SceneValidationContext { template: SceneTemplate; characterIds: ReadonlySet<string>; choiceKeys: readonly string[]; focusKeys: readonly string[]; facts: LifeFactSheet; }`.
  - `type ValidationResult = { ok: true; plan: ScenePlan } | { ok: false; errors: string[] }`.
  - `validateScenePlan(plan: unknown, ctx: SceneValidationContext): ValidationResult`.

- [ ] **Step 1: Write the failing validation tests**

Create `src/game/scenes/validate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { blankMap } from "@/lib/maps/schema";
import { buildFactSheet, validateScenePlan } from "@/game/scenes/validate";
import type { ScenePlan, SceneTemplate } from "@/game/scenes/types";

const template: SceneTemplate = {
  id: "home_childhood",
  name: "Home",
  map: blankMap({ id: "home_childhood", name: "Home" }),
  sockets: {
    player_start: { position: [0, 0, 2], rotationY: 0 },
    mother: { position: [-1, 0, 0], rotationY: 0 },
    table: { position: [1, 0, 0], rotationY: 0 },
  },
  bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 },
  interactables: [
    { id: "table", socket: "table", label: "Sit at the table", kind: "use" },
  ],
};

const facts = {
  playerName: "Lan",
  age: 6,
  people: [{ name: "Hoa", role: "mother", age: 30, alive: true }],
  children: [],
};

const valid: ScenePlan = {
  template: "home_childhood",
  title: "A small room",
  summary: "Your mother calls you to the table.",
  timeOfDay: "morning",
  weather: "clear",
  cast: [
    {
      role: "mother",
      name: "Hoa",
      age: 30,
      characterId: "generic-female",
      mood: "warm",
      socket: "mother",
      lines: ["Come and eat."],
    },
  ],
  player: { socket: "player_start", age: 6, cameraHeight: 1.1 },
  dialogue: [{ speaker: "Hoa", text: "Come and eat." }],
  interactables: [
    {
      id: "table",
      socket: "table",
      label: "Sit at the table",
      kind: "use",
      choiceKey: "eat",
    },
  ],
  choiceBindings: { eat: "table" },
  ambience: "home",
};

const ctx = (over: Partial<Parameters<typeof validateScenePlan>[1]> = {}) => ({
  template,
  characterIds: new Set(["generic-female"]),
  choiceKeys: ["eat"],
  focusKeys: [],
  facts,
  ...over,
});

describe("validateScenePlan", () => {
  it("accepts a complete plan", () => {
    expect(validateScenePlan(valid, ctx()).ok).toBe(true);
  });

  it("rejects a missing choice binding", () => {
    const bad = { ...valid, choiceBindings: {} };
    const result = validateScenePlan(bad, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("missing_choice:eat");
  });

  it("rejects an unknown character id", () => {
    const bad = {
      ...valid,
      cast: [{ ...valid.cast[0]!, characterId: "nope" }],
    };
    const result = validateScenePlan(bad, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain("unknown_character");
  });

  it("rejects an unknown socket", () => {
    const bad = { ...valid, player: { ...valid.player, socket: "nope" } };
    const result = validateScenePlan(bad, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain("unknown_socket");
  });

  it("rejects a dead person speaking in the present unless it is a memory", () => {
    const deadFacts = {
      ...facts,
      people: [{ name: "Hoa", role: "mother", age: 60, alive: false }],
    };
    const result = validateScenePlan(valid, ctx({ facts: deadFacts }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain("dead_speaks");
    const memory = { ...valid, memory: true };
    expect(validateScenePlan(memory, ctx({ facts: deadFacts })).ok).toBe(true);
  });

  it("rejects an unknown person name", () => {
    const bad = {
      ...valid,
      cast: [{ ...valid.cast[0]!, name: "Stranger" }],
    };
    const result = validateScenePlan(bad, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain("unknown_person");
  });
});

describe("buildFactSheet", () => {
  it("collects the family defensively and skips unnamed people", () => {
    const sheet = buildFactSheet({
      age: 10,
      name: "Lan",
      mother: { name: "Hoa", age: 35, alive: true },
      father: { name: "Minh", age: 38, dead: true },
      siblings: [{ name: "An", age: 8 }],
      partner: { name: "Bao" },
      kids: [{ name: "Mai" }],
    });
    expect(sheet.playerName).toBe("Lan");
    expect(sheet.people.map((p) => p.name)).toEqual(["Hoa", "Minh", "An", "Bao", "Mai"]);
    expect(sheet.people.find((p) => p.name === "Minh")?.alive).toBe(false);
    expect(sheet.children).toEqual(["Mai"]);
  });

  it("does not invent a name when the state is loose", () => {
    const sheet = buildFactSheet({ age: 0 });
    expect(sheet.people).toEqual([]);
    expect(sheet.playerName).toBe("You");
  });
});
```

Add `memory?: boolean` to `ScenePlan` for the flashback exception.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game/scenes/validate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the types and validators**

`validateScenePlan` must check, in order, and collect all errors:

1. `plan` is an object with a known `template` id.
2. `template` matches `ctx.template.id`.
3. `player.socket` and every `cast[].socket` and `interactables[].socket` exist in `template.sockets`.
4. Every `cast[].characterId` is in `ctx.characterIds`.
5. Every `cast[].name` is `facts.playerName` or a name in `facts.people`; `unknown_person:<name>` otherwise.
6. A person in `facts.people` with `alive: false` may not have a present-tense `lines` entry unless `plan.memory === true`; use `dead_speaks:<name>`.
7. Every `ctx.choiceKeys` appears in `plan.choiceBindings`; `missing_choice:<key>`.
8. Every `choiceBindings` value is an interactable id present in `plan.interactables`; `unknown_binding:<key>`.
9. Every `ctx.focusKeys` appears in an interactable’s `focusKey`; `missing_focus:<key>`.
10. Text caps: title ≤ 80, summary ≤ 240, each line/dialogue ≤ 240.

`buildFactSheet` reads `state.mother`, `state.father`, `state.partner`, `state.kids`, `state.siblings`, `state.household` and extracts `name`, `age`, and alive status (`alive === false` or `dead === true` means dead; anything else is alive). It skips unnamed entries. `children` is the names from `state.kids` (or `state.children`). Use `"You"` when `state.name` is missing.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/game/scenes/validate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/scenes/types.ts src/game/scenes/validate.ts src/game/scenes/validate.test.ts
git commit -m "feat(life): add scene schema, validation, and fact guard"
```

---

### Task 5: Deterministic scene director

**Files:**
- Create: `src/game/engine/director.ts`
- Test: `src/game/engine/director.test.ts`

**Interfaces:**
- Consumes: `SceneTrigger`, `chapterForAge` from `@/game/engine/chapters`; `LifeRun`; `SceneTemplate`, `ScenePlan`, `LifeFactSheet`, `LifeTemplateId`; `validateScenePlan`.
- Produces:
  - `interface SceneDirector { direct(input: DirectorInput): Promise<ScenePlan>; }`.
  - `interface DirectorInput { trigger: SceneTrigger; run: LifeRun; facts: LifeFactSheet; templates: Record<LifeTemplateId, SceneTemplate>; dressing: string[]; }`.
  - `selectTemplate(trigger: SceneTrigger, run: LifeRun): LifeTemplateId`.
  - `createDeterministicDirector(characterIds: ReadonlySet<string>): SceneDirector`; the templates arrive in `DirectorInput`.

- [ ] **Step 1: Write the failing director tests**

Create `src/game/engine/director.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { blankMap } from "@/lib/maps/schema";
import { createDeterministicDirector, selectTemplate } from "@/game/engine/director";
import type { SceneTemplate } from "@/game/scenes/types";
import type { LifeRun } from "@/game/state/lifeRun";
import type { SceneTrigger } from "@/game/engine/chapters";

const template = (id: SceneTemplate["id"]): SceneTemplate => ({
  id,
  name: id,
  map: blankMap({ id, name: id }),
  sockets: {
    player_start: { position: [0, 0, 2], rotationY: 0 },
    mother: { position: [-1, 0, 0], rotationY: 0 },
    table: { position: [1, 0, 0], rotationY: 0 },
  },
  bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 },
  interactables: [],
});

const templates = {
  birth_home: template("birth_home"),
  birth_hospital: template("birth_hospital"),
  home_childhood: template("home_childhood"),
  home_family: template("home_family"),
  school_classroom: template("school_classroom"),
  schoolyard: template("schoolyard"),
  street_neighborhood: template("street_neighborhood"),
  workplace_office: template("workplace_office"),
  workplace_shop: template("workplace_shop"),
  hospital: template("hospital"),
  cemetery_memorial: template("cemetery_memorial"),
  wedding_home: template("wedding_home"),
} as Record<SceneTemplate["id"], SceneTemplate>;

const run = (age: number): LifeRun => ({
  id: "r",
  startedAt: 0,
  engineVersion: "e",
  config: {},
  token: "t",
  state: { age, name: "Lan" },
  decision: null,
  focus: null,
  sheet: [],
  journal: [],
  thoughts: {},
  chapterIndex: 0,
  sceneCount: 0,
  ended: false,
  death: null,
  phase: "scene",
  meta: null,
  usage: null,
});

const facts = {
  playerName: "Lan",
  age: 10,
  people: [
    { name: "Hoa", role: "mother", age: 35, alive: true },
    { name: "Minh", role: "father", age: 38, alive: true },
  ],
  children: [],
};

const decision = (about: string) => ({
  id: `d_${about}`,
  question: "What now?",
  about,
  choices: [
    { key: "study", label: "Study" },
    { key: "play", label: "Play" },
  ],
});

describe("selectTemplate", () => {
  it("maps the major domains to templates", () => {
    expect(selectTemplate({ kind: "birth", id: "b", age: 0 }, run(0))).toBe(
      "birth_home",
    );
    expect(
      selectTemplate(
        { kind: "decision", id: "d", age: 10, decision: decision("school") },
        run(10),
      ),
    ).toBe("school_classroom");
    expect(
      selectTemplate(
        { kind: "decision", id: "d", age: 25, decision: decision("work") },
        run(25),
      ),
    ).toBe("workplace_office");
    expect(
      selectTemplate(
        { kind: "decision", id: "d", age: 30, decision: decision("partner") },
        run(30),
      ),
    ).toBe("wedding_home");
    expect(
      selectTemplate(
        { kind: "decision", id: "d", age: 40, decision: decision("health") },
        run(40),
      ),
    ).toBe("hospital");
    expect(selectTemplate({ kind: "death", id: "d", age: 80 }, run(80))).toBe(
      "cemetery_memorial",
    );
  });
});

describe("createDeterministicDirector", () => {
  it("binds every engine choice and casts the family", async () => {
    const director = createDeterministicDirector(
      new Set(["generic-female", "generic-male"]),
    );
    const plan = await director.direct({
      trigger: {
        kind: "decision",
        id: "d_school",
        age: 10,
        decision: decision("school"),
      },
      run: run(10),
      facts,
      templates,
      dressing: [],
    });
    expect(plan.template).toBe("school_classroom");
    expect(plan.choiceBindings).toEqual({
      study: expect.any(String),
      play: expect.any(String),
    });
    expect(plan.cast.map((c) => c.name)).toContain("Hoa");
    expect(plan.cast.map((c) => c.name)).toContain("Minh");
    expect(plan.dialogue.length).toBeGreaterThan(0);
  });

  it("produces a continue interaction for a non-decision event", async () => {
    const director = createDeterministicDirector(
      new Set(["generic-female"]),
    );
    const plan = await director.direct({
      trigger: { kind: "event", id: "chapter:school", age: 6 },
      run: run(6),
      facts,
      templates,
      dressing: [],
    });
    expect(plan.choiceBindings).toEqual({});
    expect(plan.interactables.some((i) => i.id === "continue")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game/engine/director.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `director.ts`**

Rules:

- `selectTemplate`: death → `cemetery_memorial`; birth → `birth_home`; reflection → `home_childhood` for ages < 18, `home_family` for adults, `home_childhood` for elders; decisions: `school`/`educat`/`exam` → `school_classroom`, `work`/`job`/`career` → `workplace_office`, `partner`/`marri` → `wedding_home`, `health`/`illness`/`hospital` → `hospital`, `money`/`debt` → `workplace_shop`, `migrat` → `street_neighborhood`, default → `home_family` for adults, `home_childhood` for children.
- The director casts the player’s mother and father if alive, plus the partner if present, into sockets named `mother`, `father`, `partner` if the template has them; otherwise use `player_start` and offset positions. Use `generic-female` for women and `generic-male` for men; if the template lacks the socket, skip the cast member.
- Dialogue: 2–3 short templated lines. For a decision, the question becomes the first line; each choice becomes an interactable with the choice key. For an event, one “Continue” interactable.
- Every choice key gets a binding to an interactable id `choice_<key>`.
- The plan passes `validateScenePlan` in the director before returning; if validation fails, throw `new Error("invalid_scene:" + errors.join(","))`. The run controller catches and uses a minimal fallback plan.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/game/engine/director.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/engine/director.ts src/game/engine/director.test.ts
git commit -m "feat(life): add deterministic scene director"
```

---

### Task 6: Scene registry and the first two templates

**Files:**
- Create: `src/game/scenes/templates/homeChildhood.ts`
- Create: `src/game/scenes/templates/schoolClassroom.ts`
- Create: `src/game/scenes/registry.ts`
- Test: `src/game/scenes/registry.test.ts`

**Interfaces:**
- Consumes: `ArenaMapDefinition`, `blankMap` from `@/lib/maps/schema`; `isPlaceableId` from `@/lib/assets/catalog`; `SceneTemplate`, `LifeTemplateId`.
- Produces:
  - `SCENE_TEMPLATES: Record<LifeTemplateId, SceneTemplate>` — for now include the two templates and stub entries that throw on access? No: the director needs all ids. Provide a `STUB_TEMPLATE` fallback for unimplemented ids so the game can run, and mark it `stub: true` in the template type (optional). The plan adds real templates in Tasks 15–17.
  - `getSceneTemplate(id): SceneTemplate`.
  - `buildSceneMap(template, dressing): ArenaMapDefinition`.

- [ ] **Step 1: Write the failing registry tests**

Create `src/game/scenes/registry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isArenaMapDefinition } from "@/lib/maps/schema";
import { isPlaceableId } from "@/lib/assets/catalog";
import { SCENE_TEMPLATES, getSceneTemplate } from "@/game/scenes/registry";

describe("scene registry", () => {
  it("has a valid map and unique sockets for every template", () => {
    for (const template of Object.values(SCENE_TEMPLATES)) {
      expect(isArenaMapDefinition(template.map)).toBe(true);
      expect(template.sockets.player_start).toBeDefined();
      const ids = Object.keys(template.sockets);
      expect(new Set(ids).size).toBe(ids.length);
      for (const placeable of template.map.placeables) {
        expect(isPlaceableId(placeable.placeableId)).toBe(true);
      }
    }
  });

  it("returns a known template and rejects an unknown id", () => {
    expect(getSceneTemplate("home_childhood").id).toBe("home_childhood");
    expect(() => getSceneTemplate("nope" as never)).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/game/scenes/registry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the templates and registry**

`homeChildhood.ts`:

- 14×14 m floor, `office` surface, warm theme.
- Placeables: `furniture__bed_single`, `furniture__table_cross`, `furniture__chair_rounded`, `furniture__bookcase_open`, `furniture__rug_round`, `plant_small`, `desk_lamp`, `wall_solid` around the room.
- Sockets: `player_start` at `[0, 0, 5]`, `mother` at `[-1.5, 0, 0]`, `father` at `[1.5, 0, 0]`, `bed` at `[-4, 0, -3]`, `table` at `[0, 0, -1]`, `window` at `[0, 0, -6]`, `door` at `[5, 0, 0]`.
- Bounds: `{ minX: -6.5, maxX: 6.5, minZ: -6.5, maxZ: 6.5 }`.
- Interactables: `table` (use), `bed` (look), `window` (look), `door` (use).

`schoolClassroom.ts`:

- 16×12 m floor, `concrete`/`office` surface, cooler theme.
- Placeables: `desk` ×4, `chair` ×4, `bookshelf`, `wall_solid`, `plant_small`.
- Sockets: `player_start` at `[0, 0, 5]`, `teacher` at `[0, 0, -5]`, `friend` at `[-3, 0, 0]`, `desk` at `[0, 0, 0]`, `board` at `[0, 0, -6]`.
- Bounds: `{ minX: -7.5, maxX: 7.5, minZ: -5.5, maxZ: 5.5 }`.
- Interactables: `desk` (use), `board` (look), `friend` (talk).

`registry.ts`:

- `const STUB = (id: LifeTemplateId): SceneTemplate` returns a `home_childhood` clone with the requested id (temporary until Tasks 15–17).
- Export `SCENE_TEMPLATES` with the two real templates and stubs for the rest.
- `getSceneTemplate` throws `new Error("unknown_template:" + id)` when missing.
- `buildSceneMap` returns `structuredClone(template.map)`; dressing is ignored in this plan (reserved).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/game/scenes/registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/scenes/templates src/game/scenes/registry.ts src/game/scenes/registry.test.ts
git commit -m "feat(life): add scene registry and first templates"
```

---

### Task 7: Movement helpers and first-person controls

**Files:**
- Create: `src/game/controls/movement.ts`
- Create: `src/game/controls/FirstPersonControls.tsx`
- Test: `src/game/controls/movement.test.ts`

**Interfaces:**
- Consumes: `useThree` from `@react-three/fiber`; `useFrame`; `THREE`.
- Produces:
  - `interface Bounds { minX: number; maxX: number; minZ: number; maxZ: number; }`.
  - `interface MoveInput { forward: number; strafe: number; yaw: number; speed: number; dt: number; }`.
  - `nextPosition(current: [number, number], input: MoveInput): [number, number]`.
  - `clampToBounds(x: number, z: number, bounds: Bounds): [number, number]`.
  - `nearestInteractable(position: [number, number], interactables: Array<{ id: string; position: [number, number]; radius: number }>): string | null`.
  - `FirstPersonControls` props: `{ start: { position: [number, number, number]; yaw: number }; bounds: Bounds; cameraHeight: number; enabled: boolean; onInteract: (id: string) => void; interactables: Array<{ id: string; position: [number, number]; radius: number }>; }`.

- [ ] **Step 1: Write the failing movement tests**

Create `src/game/controls/movement.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { clampToBounds, nearestInteractable, nextPosition } from "@/game/controls/movement";

describe("nextPosition", () => {
  it("moves forward along -Z at yaw 0", () => {
    const [x, z] = nextPosition([0, 0], {
      forward: 1,
      strafe: 0,
      yaw: 0,
      speed: 2,
      dt: 0.5,
    });
    expect(x).toBeCloseTo(0);
    expect(z).toBeCloseTo(-1);
  });

  it("normalizes diagonal input", () => {
    const [x, z] = nextPosition([0, 0], {
      forward: 1,
      strafe: 1,
      yaw: 0,
      speed: 2,
      dt: 0.5,
    });
    expect(Math.hypot(x, z)).toBeCloseTo(1);
  });
});

describe("clampToBounds", () => {
  it("keeps the player inside the room", () => {
    expect(clampToBounds(99, -99, { minX: -5, maxX: 5, minZ: -4, maxZ: 4 })).toEqual([
      5, -4,
    ]);
  });
});

describe("nearestInteractable", () => {
  it("returns the closest interactable in range", () => {
    const id = nearestInteractable(
      [0, 0],
      [
        { id: "far", position: [5, 0], radius: 1 },
        { id: "near", position: [0.5, 0], radius: 1 },
      ],
    );
    expect(id).toBe("near");
    expect(nearestInteractable([0, 0], [])).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game/controls/movement.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the movement helpers and the component**

`nextPosition`: normalize `(forward, strafe)` when the length > 1; rotate by yaw; return `[x + dx * speed * dt, z + dz * speed * dt]`. At yaw 0, forward is `-Z` and strafe is `+X`.

`FirstPersonControls`:

- On mount, set `camera.position` to `start.position` with `y = cameraHeight`; set `camera.rotation.order = "YXZ"` and `camera.rotation.y = start.yaw`.
- Click on the canvas requests pointer lock; `Escape` releases.
- `keydown`/`keyup` track `KeyW`, `KeyA`, `KeyS`, `KeyD`, arrow keys; `KeyE` calls `onInteract` with the nearest interactable id.
- `useFrame` reads the key state, computes `nextPosition`, clamps, sets `camera.position.x/z`.
- `mousemove` while pointer-locked adjusts yaw/pitch; clamp pitch to ±80°.
- Touch: a left-bottom joystick updates forward/strafe; a right-half drag adjusts yaw. Keep it simple: two DOM overlay divs with pointer events, passed via props? The component is inside Canvas, so DOM overlays are siblings. Add a `TouchControls` export that renders outside the Canvas and calls the same movement state via a ref. For this task, implement a minimal keyboard/mouse version and a `TouchControls` placeholder that renders nothing; Task 18 adds touch. The plan can note “touch deferred to Task 18.”
- The component returns `null`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/game/controls/movement.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/controls
git commit -m "feat(life): add first-person movement helpers and controls"
```

---

### Task 8: Life scene renderer

**Files:**
- Create: `src/game/scenes/LifeScene.tsx`
- Create: `src/game/scenes/LifeCharacter.tsx`
- Create: `src/game/scenes/LifeProps.tsx`
- Create: `src/game/scenes/SceneLighting.tsx`
- Modify: `src/game/life.css`

**Interfaces:**
- Consumes: `ScenePlan`, `SceneTemplate`, `buildSceneMap`; `ArenaFloor`; `Placeables`; `getCharacter`, `fitGlbToHeight`, `applyCharacterProportions`, `cloneSkinned`; `FirstPersonControls`.
- Produces: `<LifeScene template plan onInteract />`, `<LifeCharacter member />`, `<SceneLighting theme />`.

- [ ] **Step 1: Build the scene components**

`LifeProps.tsx`:

- `export function LifeProps({ map }: { map: ArenaMapDefinition })` renders `<Placeables items={map.placeables} />` inside a group. Do not use the arena store.

`LifeCharacter.tsx`:

- `export function LifeCharacter({ member, onPick }: { member: SceneCastMember; onPick?: (member) => void })`.
- Use `getCharacter(member.characterId)`; `useGLTF(spec.glb)`; clone with `SkeletonUtils.clone`; `prepareCharacterMeshes`; `fitGlbToHeight` with `spec.targetHeight * ageScale(member.age)`; `applyCharacterProportions`; `useAnimations` with Idle/Walk.
- `ageScale(age)`: `age < 3 ? 0.55 : age < 12 ? 0.72 : age < 18 ? 0.88 : age > 70 ? 0.95 : 1`.
- Render `<group position={socket.position} rotation-y={socket.rotationY}>` with the clone and an `<Html>` speech bubble showing the current line (first line for now).
- Add a simple procedural idle bob; no wander.

`SceneLighting.tsx`:

- Use `template.map.theme`; ambient + hemisphere + directional light; no store. Mirror the colors from `ArenaScene` but keep it simple. `roomLights` true for interiors.
- Add fog matching the theme.

`LifeScene.tsx`:

- `<Canvas shadows dpr={[1, 1.5]} camera={{ fov: 60, near: 0.05, far: 100 }}>`.
- Inside: `<SceneLighting theme={map.theme} />`, `<ArenaFloor floor={map.floor} />`, `<LifeProps map={map} />`, cast `LifeCharacter`s, `<FirstPersonControls ... />`.
- `onInteract` is passed up to the UI.
- The player start socket may be missing; fall back to `[0,0,0]` and yaw 0.
- Add a `Suspense` fallback with a simple loading block.

- [ ] **Step 2: Add mode-scoped CSS**

Add `src/game/life.css` with `.life-mode`, `.life-canvas`, `.life-speech`, `.life-dialogue`, `.life-hud`, `.life-journal`, `.life-start`, and `.life-scene-loading`. Keep the arena styles untouched. Import it in `LifeGame.tsx` (Task 11) or `src/main.tsx` later.

- [ ] **Step 3: Build and manually verify**

Run: `npm run build`
Expected: PASS.
Manual: render a dev-only route or temporary harness with the `home_childhood` template and a fake plan; confirm the room, characters, and camera load without console errors. Remove the harness after the check.

- [ ] **Step 4: Commit**

```bash
git add src/game/scenes src/game/life.css
git commit -m "feat(life): add 3D scene renderer, characters, and props"
```

---

### Task 9: Dialogue, HUD, and interaction UI

**Files:**
- Create: `src/game/ui/Dialogue.tsx`
- Create: `src/game/ui/InteractPrompt.tsx`
- Create: `src/game/ui/LifeHud.tsx`
- Modify: `src/game/life.css`

**Interfaces:**
- Consumes: `ScenePlan`, `OneIn8bDecision`, `OneIn8bFocus`.
- Produces:
  - `<Dialogue plan={plan} decision={decision} onChoose={(key) => void} busy={boolean} />`.
  - `<InteractPrompt label={string | null} />`.
  - `<LifeHud age={number} year={number} title={string} onJournal={...} onPause={...} />`.

- [ ] **Step 1: Implement the UI**

`Dialogue`:

- Renders the scene’s current dialogue lines in a bottom panel, with the speaker name.
- If a decision exists, render one button per engine choice, using the choice label. Each button calls `onChoose(choice.key)`.
- If a focus exists and no decision, render the focus options as buttons; each calls `onFocus(option.key)`.
- If neither, render a “Continue” button that calls `onContinue()`.
- Disable buttons when `busy`.

`InteractPrompt`:

- A small centered prompt `Press E to <label>` when the player is near an interactable.

`LifeHud`:

- Top-left: chapter title, age, year.
- Top-right: Journal button, Pause button.
- Bottom-left: a subtle “1in8b Engine” credit link.

- [ ] **Step 2: Build and manually verify**

Run: `npm run build`
Expected: PASS.
Manual: render a static `Dialogue` with a 2-choice decision; confirm buttons and keyboard focus.

- [ ] **Step 3: Commit**

```bash
git add src/game/ui src/game/life.css
git commit -m "feat(life): add dialogue, HUD, and interaction UI"
```

---

### Task 10: Start screen, key setup, and birth card

**Files:**
- Create: `src/game/ui/StartScreen.tsx`
- Create: `src/game/ui/BirthCard.tsx`
- Modify: `src/game/life.css`

**Interfaces:**
- Consumes: `LifeConfig`; `readLifeKey`, `writeLifeKey`; `LifeRun`.
- Produces:
  - `<StartScreen initialKey={string} onStart={(config, key) => void} busy error />`.
  - `<BirthCard run={LifeRun} onContinue={() => void} />`.

- [ ] **Step 1: Implement the start screen**

Fields:

- Country: “Vietnam” (read-only).
- Period: a `<select>` with `Past (1986–2025)`, `Today`, `Future`, `Any`. A year slider (1986–2025) when Past is selected.
- Sex: female / male / random.
- Advanced (collapsed): family income fifth (1–5 or any), city/village/any.
- API key: password input, prefilled from `readLifeKey()`, with a “Get a free key” link to `https://1in8b.life/en/api/` and a mailto `api@1in8b.life`.
- Scene director: “Template scenes (no LLM)” (the only option in this plan).
- Content notice and credit.
- Start button disabled when the key is empty; on submit, call `writeLifeKey(key)` and `onStart(config, key)`.

`BirthCard`:

- Shows name, sex, born year, country, place (if the engine provides a string), parents’ ages/work when present, family fifth, faith.
- Shows the first journal entry.
- Credit line and “Simulated life, not a real person.”
- Continue button.

- [ ] **Step 2: Build and manually verify**

Run: `npm run build`
Expected: PASS.
Manual: open the start screen with no key; Start is disabled. Enter a fake key; Start enables. The birth card renders with a loose state `{ age: 0 }` without crashing.

- [ ] **Step 3: Commit**

```bash
git add src/game/ui/StartScreen.tsx src/game/ui/BirthCard.tsx src/game/life.css
git commit -m "feat(life): add start screen, key setup, and birth card"
```

---

### Task 11: Run controller and life store

**Files:**
- Create: `src/game/engine/runLife.ts`
- Create: `src/game/state/lifeStore.ts`
- Test: `src/game/engine/runLife.test.ts`

**Interfaces:**
- Consumes: `LifeTransport`, `LiveResponse`; `LifeRun`, `createRun`, `applyLiveResponse`, `addThought`; `selectTrigger`, `isMajorDecision`, `defaultChoiceKey`, `MAX_SCENES`; `SceneDirector`; `buildFactSheet`, `validateScenePlan`.
- Produces:
  - `interface LifeDeps { transport: LifeTransport; director: SceneDirector; templates: Record<LifeTemplateId, SceneTemplate>; characterIds: ReadonlySet<string>; }`.
  - `interface LifeNext { run: LifeRun; scene: ScenePlan | null; }`.
  - `configToStart(config: LifeConfig): StartOptions`.
  - `startLife(deps, config): Promise<LifeNext>`.
  - `advanceLife(deps, run): Promise<LifeNext>`.
  - `submitChoice(deps, run, key): Promise<LifeNext>`.
  - `submitFocus(deps, run, key): Promise<LifeNext>`.
  - `buyItems(deps, run, ids): Promise<LifeNext>`.
  - `useLifeStore` (Zustand) with `run`, `scene`, `phase`, `error`, `busy`, `start`, `choose`, `focus`, `buy`, `continueScene`, `reflect`, `reset`, `resume`.
  - `setLifeDeps(deps)` for tests.

- [ ] **Step 1: Write the failing controller tests**

Create `src/game/engine/runLife.test.ts` with a fake transport that returns a sequence:

```ts
const sequence: LiveResponse[] = [
  { state: { age: 0, name: "Lan" }, events: [[0, "Born."]], decision: null, token: "t1" },
  { state: { age: 2 }, events: [], decision: { id: "d1", question: "Play?", about: "weather", choices: [{ key: "a", label: "Play" }] }, token: "t2" },
  { state: { age: 6 }, events: [], decision: { id: "d2", question: "School?", about: "school", choices: [{ key: "study", label: "Study" }, { key: "play", label: "Play" }] }, token: "t3" },
];
```

Test:

```ts
it("auto-resolves a minor decision and stages the next major one", async () => {
  const transport = fakeTransport(sequence);
  const next = await startLife(deps(transport), {});
  expect(next.run.token).toBe("t3");
  expect(next.scene?.template).toBe("school_classroom");
  expect(next.scene?.choiceBindings).toHaveProperty("study");
});

it("stages death even when the life ends before a scene", async () => {
  const transport = fakeTransport([
    { state: { age: 0 }, events: [[0, "Born."]], decision: null, token: "t1", ended: true, death: { age: 0 } },
  ]);
  const next = await startLife(deps(transport), {});
  expect(next.scene?.template).toBe("cemetery_memorial");
  expect(next.run.phase).toBe("death");
});
```

Also test `submitChoice` sends `{ token, choose }` and `buyItems` sends `{ token, buy }`.

Add a `configToStart` test:

```ts
it("maps the selected period to a Vietnam start request", () => {
  expect(configToStart({ year: 1995, sex: "female" })).toMatchObject({
    country: "VNM",
    year: 1995,
    sex: "female",
    policy: "auto",
    sensitive: 0,
    suicide: 0,
  });
  expect(configToStart({ future: true, sex: "male" })).toMatchObject({
    country: "VNM",
    future: true,
    sex: "male",
  });
  expect(["female", "male"]).toContain(configToStart({ sex: "random" }).sex);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game/engine/runLife.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the controller**

`configToStart`:

- Past uses `year`; Today omits `year` and `future`; Future sets `future: true`; Any picks randomly among a random past year (1986–2025), today, and future.
- `sex: "random"` picks female or male.
- Always `country: "VNM"`, `policy: "auto"`, `sensitive: 0`, `suicide: 0`; pass `fifth` and `place` when set.

`startLife`:

- `res = await transport.start(configToStart(config))`.
- `run = createRun(config, res)`.
- Call `advanceFrom(deps, run, -1, new Set())`.

`advanceLife`:

- If `run.ended`, return `{ run, scene: null }` (the UI shows death).
- Call `advanceFrom(deps, run, run.state.age, new Set(Object.keys(run.thoughts).map(Number)))`.

`advanceFrom(deps, run, previousAge, reflectedAges)`:

- Loop up to 30 times:
  - `res = await transport.step({ token: run.token, until: "decision" })`.
  - `next = applyLiveResponse(run, res)`.
  - `trigger = selectTrigger({ run: next, previousAge, response: res, sceneCount: next.sceneCount, reflectedAges })`.
  - If trigger: build facts, select template via the director (the director’s input includes all templates), direct, validate, return `{ run: { ...next, sceneCount: next.sceneCount + 1 }, scene }`.
  - If `res.ended`: return `{ run: next, scene: null }`.
  - If `res.decision && !isMajorDecision(res.decision)`: `res = await transport.step({ token: next.token, choose: defaultChoiceKey(res.decision) })`; `run = applyLiveResponse(next, res)`; continue.
  - Else: `run = next`; `previousAge = next.state.age`; continue.
- If 30 iterations pass without a scene or death, return `{ run, scene: null }` and set `run.phase = "summary"`.

`submitChoice`:

- `res = await transport.step({ token: run.token, choose: key })`.
- `next = applyLiveResponse(run, res)`; append a decision journal entry with `choiceKey: key`.
- Return `advanceFrom(deps, next, run.state.age, reflectedAges)`.

`submitFocus`, `buyItems`: same pattern with `focus`/`buy`.

`lifeStore.ts`:

- Zustand state: `run`, `scene`, `error`, `busy`.
- `start(config)`: set busy; `startLife(defaultDeps(), config)`; save run; set.
- `choose(key)`, `focus(key)`, `buy(ids)`, `continueScene()`: same.
- `reflect(age, text)`: `addThought` and save.
- `resume()`: `loadRun()`; if ended, go to death. Otherwise call `transport.step({ token, view: true })`, apply the view response (it carries the current state and waiting decision and counts no units), and if a major decision is waiting, stage it; else call `advanceLife`. Never advance past a waiting decision with `until` before looking at it.
- `reset()`: `clearRun()`; reset state.
- `setLifeDeps` swaps dependencies for tests.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/game/engine/runLife.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/engine/runLife.ts src/game/state/lifeStore.ts src/game/engine/runLife.test.ts
git commit -m "feat(life): add run controller and life store"
```

---

### Task 12: Journal, summary, and reflections

**Files:**
- Create: `src/game/ui/Journal.tsx`
- Create: `src/game/ui/Summary.tsx`
- Create: `src/game/ui/Spending.tsx`
- Create: `src/game/ui/Reflection.tsx`
- Create: `src/game/engine/summary.ts`
- Test: `src/game/engine/summary.test.ts`

**Interfaces:**
- Consumes: `LifeRun`, `JournalEntry`, `chapterForAge`.
- Produces:
  - `summarizeYears(run: LifeRun, fromAge: number, toAge: number): JournalEntry[]`.
  - `journalSections(run: LifeRun): { birth: JournalEntry[]; events: JournalEntry[]; decisions: JournalEntry[]; thoughts: JournalEntry[] }`.
  - `<Journal run={run} onClose={...} />`.
  - `<Summary entries={...} onContinue={...} />`.
  - `<Spending sheet={OneIn8bSheetItem[]} onBuy={(ids: string[]) => void} onSkip={() => void} />`.
  - `<Reflection age={age} onSave={(text) => void} onSkip={() => void} />`.

- [ ] **Step 1: Write the failing summary tests**

Create `src/game/engine/summary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { journalSections, summarizeYears } from "@/game/engine/summary";
import type { LifeRun } from "@/game/state/lifeRun";

const run = {
  journal: [
    { id: "1", age: 0, kind: "birth", text: "Born." },
    { id: "2", age: 6, kind: "event", text: "School." },
    { id: "3", age: 10, kind: "decision", text: "Choose.", choiceKey: "study" },
    { id: "4", age: 30, kind: "thought", text: "A thought." },
  ],
} as LifeRun;

describe("summarizeYears", () => {
  it("returns the entries inside the age range", () => {
    expect(summarizeYears(run, 6, 10).map((e) => e.id)).toEqual(["2", "3"]);
  });
});

describe("journalSections", () => {
  it("groups entries by kind", () => {
    const sections = journalSections(run);
    expect(sections.birth.map((e) => e.id)).toEqual(["1"]);
    expect(sections.events.map((e) => e.id)).toEqual(["2"]);
    expect(sections.decisions.map((e) => e.id)).toEqual(["3"]);
    expect(sections.thoughts.map((e) => e.id)).toEqual(["4"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/game/engine/summary.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the summary helpers and UI**

- `summarizeYears` filters `run.journal` by `age >= fromAge && age <= toAge`.
- `journalSections` groups by kind; `birth` includes `birth` and the age-0 event.
- `Journal` renders sections with the engine credit and the simulated line. It shows stats from `run.state` only when the fields are numbers; otherwise a dash. Family names from `buildFactSheet`. Thoughts from `run.thoughts`.
- `Summary` renders the year range, a short “years pass” line, and the filtered entries; a Continue button.
- `Spending` renders the engine’s sheet items with name, “does”, and price. Checkboxes allow at most two items. “Buy” sends the selected ids; “Skip” sends none. It appears at a chapter boundary when `run.sheet.length > 0`, before the summary.
- `Reflection` renders the age, a prompt, a textarea, “Save thought” and “Skip.” The prompt is one of: age 5 “What did you take for granted?”, 15 “What did you want to become?”, 30 “What are you carrying?”, 50 “What would you tell your younger self?”, 70 “What remains?”.

- [ ] **Step 4: Run the tests and build**

Run: `npx vitest run src/game/engine/summary.test.ts`
Expected: PASS.
Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/engine/summary.ts src/game/engine/summary.test.ts src/game/ui/Journal.tsx src/game/ui/Summary.tsx src/game/ui/Spending.tsx src/game/ui/Reflection.tsx
git commit -m "feat(life): add journal, year summaries, spending, and reflections"
```

---

### Task 13: Death, life review, and memorial

**Files:**
- Create: `src/game/engine/review.ts`
- Create: `src/game/ui/DeathScreen.tsx`
- Create: `src/game/ui/Memorial.tsx`
- Test: `src/game/engine/review.test.ts`

**Interfaces:**
- Consumes: `LifeRun`, `CompletedLife`, `completeRun`, `saveCompletedLife`.
- Produces:
  - `interface LifeReview { name: string; bornYear?: number; diedYear?: number; ageAtDeath?: number; cause?: string; scenes: string[]; keyEntries: JournalEntry[]; thoughts: Array<{ age: number; text: string }>; }`.
  - `buildReview(run: LifeRun, sceneTitles: string[]): LifeReview`.
  - `<DeathScreen review={review} onContinue={...} />`.
  - `<Memorial review={review} onAnother={...} onClose={...} />`.

- [ ] **Step 1: Write the failing review test**

Create `src/game/engine/review.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildReview } from "@/game/engine/review";
import type { LifeRun } from "@/game/state/lifeRun";

const run = {
  state: { age: 80, name: "Lan", year: 2075 },
  config: { year: 1995 },
  death: { age: 80, cause: "old age" },
  journal: [
    { id: "1", age: 0, kind: "birth", text: "Born." },
    { id: "2", age: 6, kind: "event", text: "School." },
    { id: "3", age: 80, kind: "event", text: "Died." },
  ],
  thoughts: { 5: "Water.", 30: "Carrying my family." },
} as LifeRun;

describe("buildReview", () => {
  it("collects the arc, the key entries, and the thoughts", () => {
    const review = buildReview(run, ["Birth", "School"]);
    expect(review.name).toBe("Lan");
    expect(review.bornYear).toBe(1995);
    expect(review.diedYear).toBe(2075);
    expect(review.ageAtDeath).toBe(80);
    expect(review.cause).toBe("old age");
    expect(review.scenes).toEqual(["Birth", "School"]);
    expect(review.thoughts.map((t) => t.age)).toEqual([5, 30]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/game/engine/review.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the review and UI**

- `buildReview` uses `completeRun(run, sceneTitles)` for the summary fields and keeps the first 8 non-death journal entries plus the death entry; thoughts sorted by age.
- `DeathScreen` shows the name, years, a short quiet line, and a Continue to the review. No medical detail.
- `Memorial` shows the life summary, the thoughts, the scene stills (text placeholders), the engine credit, “Simulated life, not a real person,” and “Live another life.”
- On first mount of `DeathScreen`, call `saveCompletedLife(completeRun(run, sceneTitles))` once; guard with a ref.

- [ ] **Step 4: Run the test and build**

Run: `npx vitest run src/game/engine/review.test.ts`
Expected: PASS.
Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/engine/review.ts src/game/engine/review.test.ts src/game/ui/DeathScreen.tsx src/game/ui/Memorial.tsx
git commit -m "feat(life): add death review and memorial"
```

---

### Task 14: Mode integration, lazy load, and entry point

**Files:**
- Create: `src/game/LifeGame.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/Hud.tsx`
- Modify: `src/i18n/en.json`
- Modify: `src/game/life.css` (import in `LifeGame.tsx`)

**Interfaces:**
- Consumes: `useLifeStore`, `StartScreen`, `BirthCard`, `LifeScene`, `Dialogue`, `LifeHud`, `Journal`, `Summary`, `Reflection`, `DeathScreen`, `Memorial`.
- Produces: `<LifeGame />`; `?life` opens the mode; a HUD button opens it.

- [ ] **Step 1: Implement `LifeGame.tsx`**

- Read the `?life` URL param on mount; if present, set the mode active.
- Phase router:
  - `setup` → `StartScreen`.
  - `birth` → `BirthCard` + a short 3D prologue scene if a scene is staged.
  - `scene` → `LifeScene` with `Dialogue` and `LifeHud`.
  - `summary` → `Spending` when `run.sheet.length > 0`, then `Summary`.
  - `reflection` → `Reflection`.
  - `death` → `DeathScreen`.
  - `review`/`memorial` → `Memorial`.
- `Journal` opens as an overlay from the HUD; `PauseMenu` opens from the HUD.
- On mount, call `resume()` if a saved run exists; show a “Resume life” card in the start screen.
- Use `React.lazy` in `App.tsx`:

```ts
const LifeGame = lazy(() => import("@/game/LifeGame"));
```

- Wrap in `<Suspense fallback={null}>`.

`App.tsx`:

- Add `const [lifeOpen, setLifeOpen] = useState(false)`.
- If `lifeOpen`, render `<LifeGame onExit={() => setLifeOpen(false)} />` instead of the arena UI. Keep the arena canvas unmounted while the life mode is open (or dormant) to free GPU.
- `?life` sets `lifeOpen` true on mount.
- Render the life branch **before** the `!userName` gate, so `?life` works without entering an arena display name.
- Add `lazy`, `Suspense`, and `useState` to the React imports.

`Hud.tsx`:

- Add a button “Live a life” that calls a new `onLife` prop or a store action. Simpler: pass `onLife` from `App` to `Hud`.
- Add `life.*` keys to `en.json`: `life.entry`, `life.setup.title`, `life.setup.country`, `life.setup.period`, `life.setup.past`, `life.setup.today`, `life.setup.future`, `life.setup.any`, `life.setup.sex`, `life.setup.female`, `life.setup.male`, `life.setup.random`, `life.setup.key`, `life.setup.keyHelp`, `life.setup.start`, `life.setup.notice`, `life.birth.title`, `life.birth.continue`, `life.hud.journal`, `life.hud.pause`, `life.journal.title`, `life.journal.close`, `life.death.title`, `life.death.continue`, `life.memorial.title`, `life.memorial.another`, `life.credit`.

- [ ] **Step 2: Build and manually verify**

Run: `npm run build`
Expected: PASS.
Manual: open `?life`; the start screen appears; the arena is not visible; closing returns to the arena. The arena still works after closing.

- [ ] **Step 3: Commit**

```bash
git add src/game/LifeGame.tsx src/App.tsx src/components/Hud.tsx src/i18n/en.json src/game/life.css
git commit -m "feat(life): add lazy-loaded life mode entry"
```

---

### Task 15: Remaining scene templates — school, street, work

**Files:**
- Create: `src/game/scenes/templates/schoolyard.ts`
- Create: `src/game/scenes/templates/streetNeighborhood.ts`
- Create: `src/game/scenes/templates/workplace.ts`
- Modify: `src/game/scenes/registry.ts`
- Test: `src/game/scenes/registry.test.ts` (extend)

**Interfaces:**
- Consumes: `SceneTemplate`, `blankMap`, `isPlaceableId`.
- Produces: real templates for `schoolyard`, `street_neighborhood`, `workplace_office`, `workplace_shop`.

- [ ] **Step 1: Add the templates**

`schoolyard`: 18×14 m, concrete/grass, trees, bench, wall; sockets `player_start`, `friend`, `teacher`, `bench`, `gate`; interactables `friend` (talk), `bench` (look), `gate` (use).

`streetNeighborhood`: 20×10 m, asphalt/sidewalk, cars/trees/shophouse walls; sockets `player_start`, `mother`, `friend`, `shop`, `corner`; interactables `shop` (use), `corner` (look), `friend` (talk).

`workplace`: 16×12 m, office floor, desks/chairs/monitors; sockets `player_start`, `boss`, `coworker`, `desk`, `window`; interactables `desk` (use), `boss` (talk), `window` (look). Use the same template for `workplace_office` and `workplace_shop` with different names/placeables (shop: counter, shelves, food).

- [ ] **Step 2: Extend the registry test**

Add an assertion that every template id in `SCENE_TEMPLATES` has a non-stub map with at least 3 placeables and a `player_start` socket. The existing loop covers validity; add:

```ts
it("ships the school, street, and work templates", () => {
  for (const id of ["schoolyard", "street_neighborhood", "workplace_office", "workplace_shop"] as const) {
    expect(SCENE_TEMPLATES[id].name).not.toContain("stub");
    expect(SCENE_TEMPLATES[id].map.placeables.length).toBeGreaterThanOrEqual(3);
  }
});
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run src/game/scenes/registry.test.ts`
Expected: PASS.

- [ ] **Step 4: Build and manually verify**

Run: `npm run build`
Expected: PASS.
Manual: direct the director to each template with a fake trigger; confirm no missing GLB warnings.

- [ ] **Step 5: Commit**

```bash
git add src/game/scenes/templates src/game/scenes/registry.ts src/game/scenes/registry.test.ts
git commit -m "feat(life): add school, street, and work scene templates"
```

---

### Task 16: Remaining scene templates — birth, home, hospital, memorial

**Files:**
- Create: `src/game/scenes/templates/birthHome.ts`
- Create: `src/game/scenes/templates/homeFamily.ts`
- Create: `src/game/scenes/templates/hospital.ts`
- Create: `src/game/scenes/templates/cemeteryMemorial.ts`
- Create: `src/game/scenes/templates/weddingHome.ts`
- Modify: `src/game/scenes/registry.ts`
- Test: `src/game/scenes/registry.test.ts` (extend)

**Interfaces:**
- Consumes: `SceneTemplate`, `blankMap`, `isPlaceableId`.
- Produces: real templates for `birth_home`, `birth_hospital`, `home_family`, `hospital`, `cemetery_memorial`, `wedding_home`.

- [ ] **Step 1: Add the templates**

- `birth_home`: small bedroom, bed, cradle (primitive), window, altar; sockets `player_start`, `mother`, `father`, `bed`, `window`.
- `birth_hospital`: clinic room, bed, cabinet, window; sockets `player_start`, `mother`, `nurse`, `bed`.
- `home_family`: living room/kitchen, table, sofa, altar, plants; sockets `player_start`, `partner`, `child`, `table`, `altar`.
- `hospital`: ward, bed, chair, window; sockets `player_start`, `doctor`, `family`, `bed`.
- `cemetery_memorial`: graveyard pack, incense, bench; sockets `player_start`, `grave`, `bench`, `tree`.
- `wedding_home`: small ceremony room, table, flowers, altar; sockets `player_start`, `partner`, `mother`, `father`.

- [ ] **Step 2: Extend the registry test**

Add the same non-stub assertion for all six ids.

- [ ] **Step 3: Run the tests and build**

Run: `npx vitest run src/game/scenes/registry.test.ts`
Expected: PASS.
Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/game/scenes/templates src/game/scenes/registry.ts src/game/scenes/registry.test.ts
git commit -m "feat(life): add birth, home, hospital, and memorial templates"
```

---

### Task 17: Save/resume, errors, and quota

**Files:**
- Modify: `src/game/state/lifeStore.ts`
- Modify: `src/game/ui/StartScreen.tsx`
- Modify: `src/game/LifeGame.tsx`
- Create: `src/game/ui/LifeError.tsx`
- Modify: `src/game/life.css`
- Test: `src/game/engine/runLife.test.ts` (extend)

**Interfaces:**
- Consumes: `OneIn8bError`, `loadRun`, `saveRun`, `clearRun`.
- Produces: `LifeError` with `{ error, onRetry, onNewKey, onExit }`; store `resume()` and `setError()`.

- [ ] **Step 1: Extend the controller tests**

Add:

```ts
it("preserves the run when the key is rejected mid-life", async () => {
  const transport = {
    start: async () => ({
      state: { age: 0 },
      events: [],
      decision: null,
      token: "t1",
    }),
    step: async () => {
      throw new OneIn8bError("bad key", "key", 401);
    },
  };
  const next = await startLife(deps(transport), {});
  expect(next.run.token).toBe("t1");
  expect(next.error?.code).toBe("key");
});

it("preserves the run on a quota error", async () => {
  const transport = {
    start: async () => ({
      state: { age: 0 },
      events: [],
      decision: null,
      token: "t1",
    }),
    step: async () => {
      throw new OneIn8bError("quota", "month", 429);
    },
  };
  const next = await startLife(deps(transport), {});
  expect(next.run.token).toBe("t1");
  expect(next.error?.code).toBe("month");
});
```

Implement the controller so a thrown `OneIn8bError` is caught and returned as `{ run, scene: null, error }` (extend `LifeNext` with `error?: OneIn8bError`). The store keeps the run, saves it, and shows `LifeError`.

- [ ] **Step 2: Implement the error UI and resume**

- `LifeError` shows a friendly message for `key`, `month`, `rate`, `free_day`, `network`, `not_in_world`, `token`, and a generic fallback.
- “Paste a new key” returns to the start screen with the current key field empty; the run is preserved.
- `resume()` loads the run; if ended, goes to death; otherwise it calls `transport.step({ token, view: true })` first, stages a waiting major decision, and only then calls `advanceLife`.
- On `LifeGame` mount, if `loadRun()` exists, show a resume card before the start screen.

- [ ] **Step 3: Run the tests and build**

Run: `npx vitest run src/game/engine/runLife.test.ts`
Expected: PASS.
Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/game/state/lifeStore.ts src/game/ui/StartScreen.tsx src/game/ui/LifeError.tsx src/game/LifeGame.tsx src/game/life.css src/game/engine/runLife.test.ts
git commit -m "feat(life): add save/resume and recoverable engine errors"
```

---

### Task 18: Interaction polish, touch, accessibility, and performance

**Files:**
- Modify: `src/game/controls/FirstPersonControls.tsx`
- Modify: `src/game/ui/Dialogue.tsx`
- Modify: `src/game/ui/Journal.tsx`
- Modify: `src/game/scenes/LifeScene.tsx`
- Modify: `src/game/life.css`
- Create: `src/game/controls/TouchControls.tsx`

**Interfaces:**
- Consumes: existing components.
- Produces: touch joystick, keyboard focus, subtitles, reduced motion, scene disposal.

- [ ] **Step 1: Add touch controls**

`TouchControls` renders two overlay zones outside the Canvas: a left joystick (pointerdown/move/up → `forward`/`strafe`) and a right drag zone (yaw). It writes to a mutable `touchState` object passed to `FirstPersonControls`. Add a `touchState` prop.

- [ ] **Step 2: Add accessibility**

- All dialogue choices are `<button>` with visible focus.
- `aria-live="polite"` on the dialogue text.
- `prefers-reduced-motion`: disable the idle bob and the camera smoothing; keep the scene static.
- Add subtitles: dialogue is always text; no audio required.
- The journal and pause menus close on `Escape`.
- The canvas has an accessible label and a “Keyboard controls” help line on the HUD.

- [ ] **Step 3: Add performance guards**

- `LifeScene` has a `<Suspense>` loading block and uses `frameloop="demand"`? No — the first-person camera needs continuous frames. Use `dpr={[1, 1.5]}` and `gl={{ antialias: false }}` on low-end. Dispose the previous scene’s GLBs? `useGLTF` caches; don’t dispose shared assets. Clear only local scene objects.
- Add `powerPreference: "high-performance"`.

- [ ] **Step 4: Build and manually verify**

Run: `npm run build`
Expected: PASS.
Manual matrix:
- Desktop: WASD + mouse look, E interact, Esc releases pointer lock.
- Touch: joystick moves, drag looks, tap choice.
- Keyboard-only: Tab to choices, Enter selects.
- Reduced motion: no bob.
- 16 scenes: no console memory warnings; FPS ≥ 30 on the test machine.

- [ ] **Step 5: Commit**

```bash
git add src/game/controls src/game/ui src/game/scenes/LifeScene.tsx src/game/life.css
git commit -m "feat(life): add touch, accessibility, and performance polish"
```

---

### Task 19: Full-arc verification and handoff

**Files:**
- Modify: `README.md` (add a short “Life in Vietnam” section with the key requirement, the credit, and `?life`)
- Modify: `docs/superpowers/specs/2026-11-03-life-in-vietnam-design.md` (mark phase 2 delivered, note the follow-up plan)

- [ ] **Step 1: Run the full gates**

```bash
npm run lint
npm test
npm run build
```

Expected: all pass; tests include the new game logic; coverage thresholds unchanged.

- [ ] **Step 2: Play three full lives**

With a real `k8b_` key, play:
- a 1995 rural life,
- a 2026 urban life,
- a future life.

For each, verify: birth card, 12–16 scenes or an early death, journal record, at least one reflection, death review, memorial, and “live another life.” Record the engine version and unit usage.

- [ ] **Step 3: Check the failure cases**

- Invalid key at start.
- Key revoked mid-run (simulate by clearing the key in devtools).
- Quota exhausted (use a key with no units, or mock the response).
- Offline (devtools network offline).
- Infant death (use a seed/year that produces one, or mock a `ended` response).

- [ ] **Step 4: Update the docs and commit**

Add the README section and the design status. Commit:

```bash
git add README.md docs/superpowers/specs/2026-11-03-life-in-vietnam-design.md
git commit -m "docs(life): document the Life in Vietnam mode and phase 2 status"
```

---

## Follow-up plan (not in this plan)

- **Eras:** `doi_moi` (1986–1999), `opening` (2000–2015), `war_subsidy` (1950–1985, careful content pass), `future` kit, period selector wiring.
- **LLM scene director:** prompt, JSON schema validation, fact guard, caching, fallback, dialogue quality.
- **Art pass:** 10–15 Vietnamese props (motorbike, altar, shophouse, plastic stool, market stall, conical hat, etc.), `ATTRIBUTION.md`, `npm run assets:inventory`.
- **Remaining templates:** `workplace_factory`, `farm_field`, `temple_church`, `station`.
- **Cohort of same-second lives, audio, Vietnamese localization, more countries.**
