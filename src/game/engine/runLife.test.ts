import { describe, expect, it } from "vitest";
import { blankMap } from "@/lib/maps/schema";
import { createDeterministicDirector } from "@/game/engine/director";
import {
  advanceLife,
  buyItems,
  configToStart,
  startLife,
  submitChoice,
  type LifeDeps,
} from "@/game/engine/runLife";
import { createRun } from "@/game/state/lifeRun";
import type { LiveResponse, StepBody } from "@/game/engine/types";
import type { SceneTemplate } from "@/game/scenes/types";

const template = (id: SceneTemplate["id"]): SceneTemplate => ({
  id,
  name: id,
  map: blankMap({ id, name: id }),
  sockets: {
    player_start: { position: [0, 0, 2], rotationY: 0 },
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

const characterIds = new Set(["generic-female", "generic-male"]);

function deps(transport: ReturnType<typeof fakeTransport>): LifeDeps {
  return {
    transport,
    director: createDeterministicDirector(characterIds),
    templates,
    characterIds,
  };
}

const sequence: LiveResponse[] = [
  {
    state: { age: 0, name: "Lan" },
    events: [[0, "Born."]],
    decision: null,
    token: "t1",
  },
  {
    state: { age: 2 },
    events: [],
    decision: {
      id: "d1",
      question: "Play?",
      about: "weather",
      choices: [{ key: "a", label: "Play" }],
    },
    token: "t2",
  },
  {
    state: { age: 6 },
    events: [],
    decision: {
      id: "d2",
      question: "School?",
      about: "school",
      choices: [
        { key: "study", label: "Study" },
        { key: "play", label: "Play" },
      ],
    },
    token: "t3",
  },
];

function fakeTransport(sequence: LiveResponse[]) {
  let index = 0;
  const calls: StepBody[] = [];
  return {
    calls,
    async start() {
      const response = sequence[index];
      index += 1;
      if (!response) throw new Error("sequence exhausted at start");
      return response;
    },
    async step(body: StepBody) {
      calls.push(body);
      const response = sequence[index];
      index += 1;
      if (!response) throw new Error("sequence exhausted at step");
      return response;
    },
  };
}

describe("configToStart", () => {
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
});

describe("startLife", () => {
  it("stages birth, then auto-resolves a minor decision and stages school", async () => {
    const transport = fakeTransport(sequence);
    const d = deps(transport);
    const born = await startLife(d, {});
    expect(born.scene?.template).toBe("birth_home");

    const next = await advanceLife(d, born.run);
    expect(next.run.token).toBe("t3");
    expect(next.scene?.template).toBe("school_classroom");
    expect(next.scene?.choiceBindings).toHaveProperty("study");
    expect(transport.calls[0]).toMatchObject({ token: "t1", until: "decision" });
    expect(transport.calls[1]).toMatchObject({ token: "t2", choose: "a" });
  });

  it("stages death when the life ends at birth", async () => {
    const transport = fakeTransport([
      {
        state: { age: 0 },
        events: [[0, "Born."]],
        decision: null,
        token: "t1",
        ended: true,
        death: { age: 0 },
      },
    ]);
    const next = await startLife(deps(transport), {});
    expect(next.scene?.template).toBe("cemetery_memorial");
    expect(next.run.phase).toBe("death");
  });
});

describe("submitChoice and buyItems", () => {
  it("sends the choice and the token", async () => {
    const run = createRun(
      {},
      {
        state: { age: 10, name: "Lan" },
        events: [],
        decision: null,
        token: "t1",
      },
    );
    const transport = fakeTransport([
      {
        state: { age: 10 },
        events: [],
        decision: null,
        token: "t2",
        ended: true,
        death: { age: 10 },
      },
    ]);
    const next = await submitChoice(deps(transport), run, "study");
    expect(transport.calls[0]).toEqual({ token: "t1", choose: "study" });
    expect(next.run.ended).toBe(true);
  });

  it("sends purchases and the token", async () => {
    const run = createRun(
      {},
      {
        state: { age: 10, name: "Lan" },
        events: [],
        decision: null,
        token: "t1",
      },
    );
    const transport = fakeTransport([
      {
        state: { age: 10 },
        events: [],
        decision: null,
        token: "t2",
        ended: true,
        death: { age: 10 },
      },
    ]);
    await buyItems(deps(transport), run, ["medicine"]);
    expect(transport.calls[0]).toEqual({
      token: "t1",
      buy: ["medicine"],
    });
  });
});
