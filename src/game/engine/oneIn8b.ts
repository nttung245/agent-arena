import {
  LifeEngineError,
  type LifeStepResult,
  type LifeTransport,
  type StartOptions,
  type StepBody,
} from "@/game/engine/types";

export const API_BASE = "https://1in8b.life/api/v1";
export const LIFE_KEY_STORAGE = "agent-arena-life-key";

export function readLifeKey(): string | null {
  if (typeof localStorage === "undefined") return null;
  const value = localStorage.getItem(LIFE_KEY_STORAGE)?.trim();
  return value ? value : null;
}

export function writeLifeKey(key: string): void {
  if (typeof localStorage === "undefined") return;
  const value = key.trim();
  if (!value) {
    localStorage.removeItem(LIFE_KEY_STORAGE);
    return;
  }
  localStorage.setItem(LIFE_KEY_STORAGE, value);
}

export function clearLifeKey(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(LIFE_KEY_STORAGE);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeResponse(raw: unknown): LifeStepResult {
  if (!isRecord(raw) || !isRecord(raw.state) || !Array.isArray(raw.events)) {
    throw new LifeEngineError("Invalid engine response", "invalid_response", 0);
  }
  return {
    ...raw,
    state: raw.state as LifeStepResult["state"],
    events: raw.events as LifeStepResult["events"],
    decision: isRecord(raw.decision)
      ? (raw.decision as unknown as LifeStepResult["decision"])
      : null,
    token: typeof raw.token === "string" ? raw.token : null,
  };
}

export function createOneIn8bTransport(
  key: string,
  fetchImpl: typeof fetch = fetch,
): LifeTransport {
  const bearer = key.trim();

  async function post(
    body: StartOptions | StepBody,
    signal?: AbortSignal,
  ): Promise<LifeStepResult> {
    let res: Response;
    try {
      res = await fetchImpl(`${API_BASE}/live`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (error instanceof LifeEngineError) throw error;
      throw new LifeEngineError("Network error", "network", 0);
    }

    if (!res.ok) {
      let payload: Record<string, unknown> = {};
      try {
        const parsed = (await res.json()) as unknown;
        if (isRecord(parsed)) payload = parsed;
      } catch {
        // Keep the status-only error below.
      }
      const code =
        typeof payload.code === "string" && payload.code
          ? payload.code
          : "http";
      const message =
        typeof payload.error === "string" && payload.error
          ? payload.error
          : `HTTP ${res.status}`;
      throw new LifeEngineError(message, code, res.status);
    }

    let raw: unknown;
    try {
      raw = await res.json();
    } catch {
      throw new LifeEngineError("Invalid engine response", "invalid_response", res.status);
    }
    return normalizeResponse(raw);
  }

  return {
    start(options, signal) {
      return post(
        {
          ...options,
          sensitive: options.sensitive ?? 0,
          suicide: options.suicide ?? 0,
        },
        signal,
      );
    },
    step(body, signal) {
      return post(body, signal);
    },
  };
}
