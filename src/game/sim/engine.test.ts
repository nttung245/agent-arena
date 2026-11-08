import { describe, expect, it } from "vitest";
import { LifeEngineError, type LifeStepResult } from "@/game/engine/types";
import { DECISIONS } from "@/game/sim/decisions";
import { ENGINE_VERSION, startLife, stepLife } from "@/game/sim/engine";
import { createLocalTransport } from "@/game/sim/localTransport";
import { checkInvariants } from "@/game/sim/person";
import { decodeToken, encodeToken } from "@/game/sim/token";

/** Plays a whole life the way the game does: step, and take the first choice when asked. */
function playLife(seed: number, year: number, check?: (r: LifeStepResult) => void): LifeStepResult[] {
  const results = [startLife({ country: "VNM", seed, year })];
  for (let guard = 0; guard < 400 && !results[results.length - 1].ended; guard++) {
    const last = results[results.length - 1];
    const next = last.decision
      ? stepLife({ token: last.token!, choose: last.decision.choices[0].key })
      : stepLife({ token: last.token! });
    check?.(next);
    results.push(next);
  }
  return results;
}

function expectCode(work: () => unknown, code: string): void {
  try {
    work();
  } catch (error) {
    expect(error).toBeInstanceOf(LifeEngineError);
    expect((error as LifeEngineError).code).toBe(code);
    return;
  }
  throw new Error(`expected a ${code} error`);
}

describe("startLife", () => {
  it("returns a newborn with a birth line, no decision, and a readable token", () => {
    const r = startLife({ country: "VNM", seed: 1, year: 1972, sex: "female", region: "central", place: "village" });
    expect(r.state.age).toBe(0);
    expect(r.state.year).toBe(1972);
    expect(r.events[0][1]).toBe("You were born in a village in the Central region, in 1972.");
    expect(r.decision).toBeNull();
    expect(r.ended).toBe(false);
    expect(r.meta?.engine).toBe(ENGINE_VERSION);
    expect(decodeToken(r.token!).person.sex).toBe("female");
    expect((r.state.mother as { name: string }).name).toMatch(/ /);
  });
});

describe("stepLife", { timeout: 60_000 }, () => {
  it("lives whole lives to the end without breaking a rule", () => {
    for (let i = 0; i < 150; i++) {
      const results = playLife(i, 1950 + (i % 76), (r) => {
        const errors = checkInvariants(decodeToken(r.token!));
        if (errors.length) throw new Error(`seed ${i}: ${errors.join("; ")}`);
      });
      const last = results[results.length - 1];
      expect(last.ended).toBe(true);
      expect(last.death?.cause).toBeTruthy();
      const ages = results.map((r) => r.state.age);
      for (let k = 1; k < ages.length; k++) expect(ages[k]).toBeGreaterThanOrEqual(ages[k - 1]);
    }
  });

  it("replays the same life for the same seed and choices", () => {
    expect(JSON.stringify(playLife(42, 1980))).toBe(JSON.stringify(playLife(42, 1980)));
  });

  it("stops only at decisions, milestones every 5 years, or the end", () => {
    for (const r of playLife(7, 1990).slice(1)) {
      if (!r.decision && !r.ended) expect(r.state.age % 5).toBe(0);
    }
  });

  it("offers decisions with a sourced fact or none, and the natural choice first", () => {
    let seen = 0;
    for (let i = 0; i < 40; i++) {
      for (const r of playLife(1000 + i, 1985)) {
        if (!r.decision) continue;
        seen++;
        const id = r.decision.id.split("@")[0];
        const def = DECISIONS[id];
        expect(r.decision.choices[0].key).toBe(def.choices[0].key);
        expect(r.decision.question).not.toMatch(/\{/);
        if (r.decision.fact) expect(r.decision.fact).toMatch(/\d/);
        expect(r.decision.major).toBe(def.major);
      }
    }
    expect(seen).toBeGreaterThan(100);
  });

  it("writes journal lines with no unfilled placeholders", () => {
    for (let i = 0; i < 60; i++) {
      for (const r of playLife(2000 + i, 1950 + i)) {
        for (const [, text] of r.events) {
          expect(text.length).toBeGreaterThan(5);
          expect(text).not.toMatch(/\{\w+\}/);
        }
      }
    }
  });

  it("looks without living on when asked to view", () => {
    const start = startLife({ country: "VNM", seed: 3, year: 2000 });
    const step = stepLife({ token: start.token! });
    const view = stepLife({ token: step.token!, view: true });
    expect(view.token).toBe(step.token);
    expect(view.events).toEqual([]);
  });

  it("runs to an age, deciding along the way, when until is a number", () => {
    const start = startLife({ country: "VNM", seed: 4, year: 1990 });
    const r = stepLife({ token: start.token!, until: 20 });
    if (!r.ended) {
      expect(r.state.age).toBe(20);
      expect(r.decision).toBeNull();
    }
    const year = stepLife({ token: start.token!, until: "year" });
    expect(year.state.age === 1 || year.decision !== null || year.ended).toBe(true);
  });

  it("sets the focus and shows a spending sheet the person can afford or not", () => {
    const start = startLife({ country: "VNM", seed: 5, year: 2000 });
    const r = stepLife({ token: start.token!, focus: "study" });
    expect(r.focus?.now).toBe("study");
    expect(r.focus?.options?.map((o) => o.key)).toContain("health");
    for (const item of r.sheet ?? []) {
      expect(item.price_ppp).toBeGreaterThan(0);
      if (!item.can) expect(item.why).toBe("Not enough savings");
    }
    const bought = stepLife({ token: r.token!, buy: ["health_insurance", "nonsense"] });
    expect(bought.events.some(([, t]) => t.startsWith("You spent money"))).toBe(false); // no savings yet
  });

  it("buys from the sheet when there are savings", () => {
    const start = startLife({ country: "VNM", seed: 6, year: 2000 });
    const state = decodeToken(start.token!);
    state.money = 500;
    const r = stepLife({ token: encodeToken(state), buy: ["health_insurance"], until: "year" });
    expect(r.events[0][1]).toBe("You spent money on Health insurance card (BHYT).");
    expect(decodeToken(r.token!).flags.insured).toBe(true);
  });

  it("rejects bad input with a clear code", () => {
    const start = startLife({ country: "VNM", seed: 8, year: 2000 });
    expectCode(() => stepLife({ token: "not-a-token" }), "token");
    expectCode(() => stepLife({ token: "al1.bm90IGpzb24" }), "token");
    expectCode(() => stepLife({ token: start.token!, choose: "x" }), "invalid_choice");
    expectCode(() => stepLife({ token: start.token!, focus: "naps" }), "invalid_focus");
    let r = stepLife({ token: start.token! });
    while (!r.decision && !r.ended) r = stepLife({ token: r.token! });
    if (r.decision) expectCode(() => stepLife({ token: r.token!, choose: "not-a-choice" }), "invalid_choice");
    if (r.decision) expect(stepLife({ token: r.token! }).decision?.id).toBe(r.decision.id); // must choose first
  });

  it("keeps the token small", () => {
    let largest = 0;
    for (let i = 0; i < 100; i++) {
      for (const r of playLife(3000 + i, 1950 + (i % 20))) largest = Math.max(largest, r.token!.length);
    }
    expect(largest).toBeLessThan(32 * 1024);
  });
});

describe("createLocalTransport", () => {
  it("starts and steps lives through promises, and rejects errors", async () => {
    const transport = createLocalTransport(() => 99);
    const start = await transport.start({ country: "VNM", year: 2000 });
    expect(decodeToken(start.token!).seed).toBe(99);
    const step = await transport.step({ token: start.token! });
    expect(step.state.age).toBeGreaterThan(0);
    await expect(transport.step({ token: "bad" })).rejects.toBeInstanceOf(LifeEngineError);
  });

  it("draws a random seed when none is given", async () => {
    const a = await createLocalTransport().start({ country: "VNM", year: 2000 });
    expect(Number.isInteger(decodeToken(a.token!).seed)).toBe(true);
  });
});
