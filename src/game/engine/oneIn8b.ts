import type { LiveResponse, StartOptions, StepBody } from "@/game/engine/types";

export const API_BASE = "https://1in8b.life/api/v1";
export const LIFE_KEY_STORAGE = "agent-arena-life-key";

export class OneIn8bError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "OneIn8bError";
    this.code = code;
    this.status = status;
  }
}

export interface LifeTransport {
  start(options: StartOptions, signal?: AbortSignal): Promise<LiveResponse>;
  step(body: StepBody, signal?: AbortSignal): Promise<LiveResponse>;
}

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

function normalizeResponse(raw: unknown): LiveResponse {
  if (!isRecord(raw) || !isRecord(raw.state) || !Array.isArray(raw.events)) {
    throw new OneIn8bError("Invalid engine response", "invalid_response", 0);
  }
  return {
    ...raw,
    state: raw.state as LiveResponse["state"],
    events: raw.events as LiveResponse["events"],
    decision: isRecord(raw.decision)
      ? (raw.decision as unknown as LiveResponse["decision"])
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
  ): Promise<LiveResponse> {
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
      if (error instanceof OneIn8bError) throw error;
      throw new OneIn8bError("Network error", "network", 0);
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
      throw new OneIn8bError(message, code, res.status);
    }

    let raw: unknown;
    try {
      raw = await res.json();
    } catch {
      throw new OneIn8bError("Invalid engine response", "invalid_response", res.status);
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
