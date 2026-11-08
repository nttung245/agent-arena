import type { CompletedLife, LifeRun } from "@/game/state/lifeRun";

export const LIFE_RUN_STORAGE = "agent-arena-life";
export const LIFE_LIVES_STORAGE = "agent-arena-life-lives";
/** Where earlier versions kept the player's 1in8b API key. */
export const LEGACY_KEY_STORAGE = "agent-arena-life-key";

/** The game no longer needs a key; remove any key an earlier version stored. */
export function forgetLegacyKey(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(LEGACY_KEY_STORAGE);
}
const MAX_COMPLETED_LIVES = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function saveRun(run: LifeRun): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LIFE_RUN_STORAGE, JSON.stringify(run));
}

export function loadRun(): LifeRun | null {
  const parsed = readJson(LIFE_RUN_STORAGE);
  if (
    !isRecord(parsed) ||
    !isRecord(parsed.state) ||
    !Array.isArray(parsed.journal) ||
    typeof parsed.token !== "string"
  ) {
    return null;
  }
  return parsed as unknown as LifeRun;
}

export function clearRun(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(LIFE_RUN_STORAGE);
}

export function loadCompletedLives(): CompletedLife[] {
  const parsed = readJson(LIFE_LIVES_STORAGE);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (life): life is CompletedLife =>
      isRecord(life) &&
      typeof life.id === "string" &&
      typeof life.name === "string" &&
      Array.isArray(life.journal) &&
      isRecord(life.thoughts),
  );
}

export function saveCompletedLife(life: CompletedLife): void {
  if (typeof localStorage === "undefined") return;
  const lives = [life, ...loadCompletedLives()].slice(0, MAX_COMPLETED_LIVES);
  localStorage.setItem(LIFE_LIVES_STORAGE, JSON.stringify(lives));
}
