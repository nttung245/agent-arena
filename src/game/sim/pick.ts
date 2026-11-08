import type { Rng } from "@/game/sim/rng";

/** True with probability `chance` (clamped to [0, 1]). */
export function roll(rng: Rng, chance: number): boolean {
  if (!(chance > 0)) return false;
  if (chance >= 1) return true;
  return rng.next() < chance;
}

/** Yearly chance of an event that happens at a constant `rate` per year. */
export function chanceFromRate(rate: number): number {
  return rate > 0 ? 1 - Math.exp(-rate) : 0;
}

/**
 * Applies a multiplier to a yearly chance by scaling the underlying rate, so
 * the result never passes 1: doubling a 60% chance gives 84%, not 120%.
 */
export function scaleChance(chance: number, multiplier: number): number {
  if (!(chance > 0) || !(multiplier > 0)) return 0;
  if (chance >= 1) return 1;
  return 1 - Math.pow(1 - chance, multiplier);
}

export interface WeightedOption<K extends string> {
  key: K;
  weight: number;
}

/** Picks one key with probability proportional to its weight. */
export function weightedPick<K extends string>(
  rng: Rng,
  options: readonly WeightedOption<K>[],
): K {
  const usable = options.filter((option) => option.weight > 0);
  if (usable.length === 0) throw new Error("weightedPick: no option has a positive weight");
  const total = usable.reduce((sum, option) => sum + option.weight, 0);
  let point = rng.next() * total;
  for (const option of usable) {
    point -= option.weight;
    if (point < 0) return option.key;
  }
  return usable[usable.length - 1].key;
}

export interface LogitOption<K extends string> {
  key: K;
  /** ln(base share) + Σ ln(multiplier): a multinomial-logit utility. */
  logWeight: number;
}

/** Multinomial-logit pick: probability ∝ exp(logWeight). */
export function softmaxPick<K extends string>(
  rng: Rng,
  options: readonly LogitOption<K>[],
): K {
  const finite = options.filter((option) => Number.isFinite(option.logWeight));
  if (finite.length === 0) throw new Error("softmaxPick: no option has a finite weight");
  const top = Math.max(...finite.map((option) => option.logWeight));
  return weightedPick(
    rng,
    finite.map((option) => ({ key: option.key, weight: Math.exp(option.logWeight - top) })),
  );
}

/**
 * Rescales multipliers so their population-weighted mean is 1. A factor like
 * income then moves people around the national rate without moving the rate.
 */
export function meanOne<K extends string>(
  multipliers: Readonly<Record<K, number>>,
  shares: Readonly<Record<K, number>>,
): Record<K, number> {
  const keys = Object.keys(multipliers) as K[];
  let weighted = 0;
  let totalShare = 0;
  for (const key of keys) {
    const share = shares[key] ?? 0;
    weighted += share * multipliers[key];
    totalShare += share;
  }
  if (!(weighted > 0) || !(totalShare > 0)) throw new Error("meanOne: shares and multipliers must be positive");
  const mean = weighted / totalShare;
  return Object.fromEntries(keys.map((key) => [key, multipliers[key] / mean])) as Record<K, number>;
}
