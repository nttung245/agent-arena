import { describe, expect, it } from "vitest";
import {
  clampToBounds,
  nearestInteractable,
  nextPosition,
} from "@/game/controls/movement";

describe("nextPosition", () => {
  it("moves forward along -Z at yaw 0", () => {
    const [x, z] = nextPosition([0, 0], {
      forward: 1,
      strafe: 0,
      yaw: 0,
      speed: 2,
      dt: 0.5,
    });
    expect(x).toBeCloseTo(0);
    expect(z).toBeCloseTo(-1);
  });

  it("normalizes diagonal input", () => {
    const [x, z] = nextPosition([0, 0], {
      forward: 1,
      strafe: 1,
      yaw: 0,
      speed: 2,
      dt: 0.5,
    });
    expect(Math.hypot(x, z)).toBeCloseTo(1);
  });
});

describe("clampToBounds", () => {
  it("keeps the player inside the room", () => {
    expect(
      clampToBounds(99, -99, { minX: -5, maxX: 5, minZ: -4, maxZ: 4 }),
    ).toEqual([5, -4]);
  });
});

describe("nearestInteractable", () => {
  it("returns the closest interactable in range", () => {
    const id = nearestInteractable(
      [0, 0],
      [
        { id: "far", position: [5, 0], radius: 1 },
        { id: "near", position: [0.5, 0], radius: 1 },
      ],
    );
    expect(id).toBe("near");
    expect(nearestInteractable([0, 0], [])).toBeNull();
  });
});
