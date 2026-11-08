/**
 * The life travels in the token: the whole SimState as versioned, URL-safe
 * base64 JSON. The game stores it in the run and sends it back each step.
 */
import { LifeEngineError } from "@/game/engine/types";
import type { SimState } from "@/game/sim/person";
import { isRngState } from "@/game/sim/rng";

const PREFIX = "al1.";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

export function encodeToken(state: SimState): string {
  return PREFIX + toBase64Url(new TextEncoder().encode(JSON.stringify(state)));
}

function unreadable(): LifeEngineError {
  return new LifeEngineError("This life can't be read. It may come from another version of the game.", "token", 400);
}

export function decodeToken(token: string): SimState {
  if (typeof token !== "string" || !token.startsWith(PREFIX)) throw unreadable();
  let state: unknown;
  try {
    state = JSON.parse(new TextDecoder().decode(fromBase64Url(token.slice(PREFIX.length))));
  } catch {
    throw unreadable();
  }
  const s = state as Partial<SimState> | null;
  if (
    !s ||
    s.version !== 1 ||
    !isRngState(s.rng) ||
    typeof s.age !== "number" ||
    typeof s.year !== "number" ||
    typeof s.phase !== "number" ||
    !s.person ||
    !Array.isArray(s.relatives)
  ) {
    throw unreadable();
  }
  return s as SimState;
}
