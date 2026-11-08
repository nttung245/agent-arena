/**
 * The contract between the game and whatever engine lives the life.
 *
 * Only `state`, `events`, and `token` are required, and many state fields are
 * optional. Keep these types open so a richer engine response never crashes
 * the client.
 */

import type { LifeTemplateId } from "@/game/scenes/types";

export type LifeRegion = "north" | "central" | "south";

export class LifeEngineError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "LifeEngineError";
    this.code = code;
    this.status = status;
  }
}

/** Starts and steps a life. The game never talks to an engine any other way. */
export interface LifeTransport {
  start(options: StartOptions, signal?: AbortSignal): Promise<LifeStepResult>;
  step(body: StepBody, signal?: AbortSignal): Promise<LifeStepResult>;
}

export interface LifeState {
  name?: string;
  age: number;
  year?: number;
  country?: string;
  region?: LifeRegion;
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

export interface LifeChoice {
  key: string;
  label: string;
  note?: string;
}

export interface LifeDecision {
  id: string;
  question: string;
  about?: string;
  fact?: string;
  choices: LifeChoice[];
  /** The engine marks decisions worth a staged scene. */
  major?: boolean;
  /** The scene template the engine suggests for this decision. */
  template?: LifeTemplateId;
}

export interface LifeFocusOption {
  key: string;
  label: string;
  [key: string]: unknown;
}

export interface LifeFocus {
  now?: string;
  options?: LifeFocusOption[];
  [key: string]: unknown;
}

export interface LifeSheetItem {
  id: string;
  name: string;
  does?: string;
  price_ppp?: number;
  can?: boolean;
  why?: string;
  [key: string]: unknown;
}

export interface LifeMeta {
  kind?: string;
  tier?: string;
  engine?: string;
  simulated?: string;
  docs?: string;
  credit?: string;
  [key: string]: unknown;
}

export interface LifeUsage {
  month?: string;
  unit?: string;
  used?: number;
  quota?: number;
  this_call?: number;
  [key: string]: unknown;
}

export interface LifeDeath {
  age?: number;
  cause?: string;
  cause_of_death?: string;
  [key: string]: unknown;
}

export type LifeEvent = [number, string] | [number, string, string];

export interface LifeStepResult {
  state: LifeState;
  events: LifeEvent[];
  decision: LifeDecision | null;
  focus?: LifeFocus;
  sheet?: LifeSheetItem[];
  ended?: boolean;
  death?: LifeDeath | null;
  token: string | null;
  meta?: LifeMeta;
  usage?: LifeUsage;
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
  region?: LifeRegion;
  faith?: string;
  disability?: string;
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
