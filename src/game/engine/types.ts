/**
 * Types for the 1in8b Engine `/api/v1/live` endpoint.
 *
 * The API is deliberately loose: only `state`, `events`, and `token` are
 * required, and many state fields are optional. Keep these types open so a
 * richer engine response never crashes the client.
 */

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
