import { describe, expect, it } from "vitest";
import { isArenaMapDefinition } from "@/lib/maps/schema";
import { isPlaceableId } from "@/lib/assets/catalog";
import { SCENE_TEMPLATES, getSceneTemplate } from "@/game/scenes/registry";

describe("scene registry", () => {
  it("has a valid map and unique sockets for every template", () => {
    for (const template of Object.values(SCENE_TEMPLATES)) {
      expect(isArenaMapDefinition(template.map)).toBe(true);
      expect(template.sockets.player_start).toBeDefined();
      const ids = Object.keys(template.sockets);
      expect(new Set(ids).size).toBe(ids.length);
      for (const placeable of template.map.placeables) {
        expect(isPlaceableId(placeable.placeableId)).toBe(true);
      }
    }
  });

  it("returns a known template and rejects an unknown id", () => {
    expect(getSceneTemplate("home_childhood").id).toBe("home_childhood");
    expect(() => getSceneTemplate("nope" as never)).toThrow();
  });

  it("ships the school, street, and work templates", () => {
    for (const id of [
      "schoolyard",
      "street_neighborhood",
      "workplace_office",
      "workplace_shop",
    ] as const) {
      expect(SCENE_TEMPLATES[id].name).not.toContain("stub");
      expect(SCENE_TEMPLATES[id].map.placeables.length).toBeGreaterThanOrEqual(
        3,
      );
    }
  });

  it("ships the birth, home, hospital, memorial, and wedding templates", () => {
    for (const id of [
      "birth_home",
      "birth_hospital",
      "home_family",
      "hospital",
      "cemetery_memorial",
      "wedding_home",
    ] as const) {
      expect(SCENE_TEMPLATES[id].name).not.toContain("stub");
      expect(SCENE_TEMPLATES[id].map.placeables.length).toBeGreaterThanOrEqual(
        3,
      );
    }
  });
});
