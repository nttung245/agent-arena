import { describe, expect, it } from "vitest";
import { blankMap } from "@/lib/maps/schema";
import { createDeterministicDirector, selectTemplate } from "@/game/engine/director";
import type { SceneTemplate } from "@/game/scenes/types";
import type { LifeRun } from "@/game/state/lifeRun";

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
    expect(plan.triggerKind).toBe("decision");
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

  it("skips a deceased parent", async () => {
    const director = createDeterministicDirector(
      new Set(["generic-female", "generic-male"]),
    );
    const deadFacts = {
      ...facts,
      people: [
        { name: "Hoa", role: "mother", age: 60, alive: false },
        { name: "Minh", role: "father", age: 65, alive: true },
      ],
    };
    const plan = await director.direct({
      trigger: {
        kind: "decision",
        id: "d_school",
        age: 10,
        decision: decision("school"),
      },
      run: run(10),
      facts: deadFacts,
      templates,
      dressing: [],
    });
    expect(plan.cast.map((member) => member.name)).not.toContain("Hoa");
    expect(plan.cast.map((member) => member.name)).toContain("Minh");
  });

  it("marks a reflection scene as a reflection", async () => {
    const director = createDeterministicDirector(
      new Set(["generic-female"]),
    );
    const plan = await director.direct({
      trigger: { kind: "reflection", id: "reflection:5", age: 5 },
      run: run(5),
      facts,
      templates,
      dressing: [],
    });
    expect(plan.triggerKind).toBe("reflection");
  });

  it("binds choices to distinct template interactions", async () => {
    const anchored = {
      ...template("school_classroom"),
      interactables: [
        { id: "desk", socket: "table", label: "Desk", kind: "use" as const },
        {
          id: "window",
          socket: "player_start",
          label: "Window",
          kind: "look" as const,
        },
      ],
    };
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
      templates: { ...templates, school_classroom: anchored },
      dressing: [],
    });
    const sockets = plan.interactables
      .filter((item) => item.choiceKey)
      .map((item) => item.socket);
    expect(sockets).toHaveLength(2);
    expect(new Set(sockets).size).toBe(2);
  });
});
