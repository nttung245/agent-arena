import { describe, expect, it } from "vitest";
import {
  ASSET_CATEGORIES,
  ASSET_PACKS,
  PLACEABLE_SPECS,
  isPlaceableId,
  listPlaceables,
  pickClipName,
  placeableCanAnimate,
  placeableCanWander,
  yawToward,
} from "@/lib/assets/catalog";
import {
  ALL_CHARACTERS,
  DEFAULT_CHARACTER_ID,
  characterYawOffset,
  getCharacter,
  isCharacterId,
} from "@/lib/assets/characters";
import {
  ALL_POLY_PRESETS,
  CUSTOM_PRESET,
  getPolyPreset,
  isCustomPreset,
} from "@/lib/poly/presets";

describe("catalog helpers", () => {
  it("picks clip names case-insensitively", () => {
    expect(pickClipName(["Idle", "Walk"], ["walk"])).toBe("Walk");
    expect(pickClipName(["Idle"], ["run"])).toBeUndefined();
    expect(pickClipName([], ["walk"])).toBeUndefined();
    expect(pickClipName(["Idle"], undefined)).toBeUndefined();
  });

  it("yaws props toward a target", () => {
    const neg = yawToward([0, 0, 0], [0, 0, 1], "negZ");
    const pos = yawToward([0, 0, 0], [0, 0, 1], "posZ");
    expect(neg).toBeCloseTo(Math.PI, 5);
    expect(pos).toBeCloseTo(0, 5);
  });

  it("indexes placeables by category and wander flags", () => {
    expect(ASSET_PACKS).toContain("animals");
    expect(ASSET_CATEGORIES).toContain("furniture");
    const all = listPlaceables();
    expect(all.length).toBeGreaterThan(10);
    expect(isPlaceableId(all[0]!)).toBe(true);
    expect(isPlaceableId("not-real")).toBe(false);
    const animals = listPlaceables("animals");
    expect(animals.length).toBeGreaterThan(0);
    expect(animals.every((id) => PLACEABLE_SPECS[id].category === "animals")).toBe(true);

    const wanderId = all.find((id) => placeableCanWander(id));
    expect(wanderId).toBeTruthy();
    expect(placeableCanWander("not-real")).toBe(false);

    const animated = all.find((id) => placeableCanAnimate(id));
    expect(animated).toBeTruthy();
  });

  it("slugifies Kenney lounge chair and animal files into catalog ids", () => {
    const chair = Object.keys(PLACEABLE_SPECS).find((id) =>
      id.includes("lounge_chair"),
    );
    expect(chair).toBeTruthy();
    expect(PLACEABLE_SPECS[chair!]?.category).toBe("furniture");
    expect(isPlaceableId("animals__cat") || isPlaceableId("cat")).toBe(true);
  });

  it("classifies pack files into categories and wander/animate flags", () => {
    const byFile = (pack: string, file: string) =>
      Object.values(PLACEABLE_SPECS).find((s) => s.pack === pack && s.glb?.includes(encodeURIComponent(file)));

    expect(byFile("camping", "Tree.glb")?.category).toBe("nature");
    expect(byFile("camping", "Rock.glb")?.category).toBe("nature");
    expect(byFile("camping", "Tent.glb")?.category).toBe("camping");
    expect(byFile("furniture", "Rug Rectangle.glb")?.category).toBe("ground");
    expect(byFile("furniture", "Cardboard Box Closed.glb")?.category).toBe("decor");
    expect(PLACEABLE_SPECS.animals__cat?.canWander).toBe(true);
    expect(PLACEABLE_SPECS.animals__spider?.canWander).toBe(true);

    const fireId = Object.keys(PLACEABLE_SPECS).find((id) => PLACEABLE_SPECS[id].canAnimate);
    expect(fireId).toBeTruthy();
    expect(placeableCanAnimate(fireId!)).toBe(true);

    const blades = byFile("nature", "Grass Blades.glb") ?? byFile("trees", "Grass Blades.glb");
    expect(blades?.footprint[0]).toBeLessThan(1);
    const housePod = byFile("space", "House Pod.glb");
    expect(housePod?.targetSize).toBeTruthy();
    const floorLamp = Object.values(PLACEABLE_SPECS).find(
      (s) => /lamp/i.test(s.label) && /floor/i.test(s.label),
    );
    expect(floorLamp).toBeTruthy();
    expect(listPlaceables("vehicles").length).toBeGreaterThan(0);
    expect(listPlaceables("food").length).toBeGreaterThan(0);
    expect(listPlaceables("space").length).toBeGreaterThan(0);
    expect(listPlaceables("camping").length).toBeGreaterThan(0);
    expect(listPlaceables("decor").length).toBeGreaterThan(0);
    expect(listPlaceables("ground").length).toBeGreaterThan(0);
    expect(listPlaceables("nature").length).toBeGreaterThan(0);
  });

  it("keeps the graveyard kit at one shared scale instead of auto-fitting", () => {
    const pumpkin = PLACEABLE_SPECS.graveyard__pumpkin_carved;
    const crypt = PLACEABLE_SPECS.graveyard__crypt_large;
    const ghost = PLACEABLE_SPECS.graveyard__ghost;
    for (const spec of [pumpkin, crypt, ghost]) {
      expect(spec?.category).toBe("spooky");
      expect(spec?.scale).toBe(2);
      expect(spec?.autoFit).toBeUndefined();
    }
    expect(crypt!.footprint[0]).toBeGreaterThan(pumpkin!.footprint[0]);
    expect(placeableCanWander("graveyard__ghost")).toBe(true);
    expect(ghost?.walkClipHints).toEqual(["walk"]);
    const spooky = listPlaceables("spooky");
    expect(spooky.length).toBeGreaterThan(0);
    expect(spooky.every((id) => PLACEABLE_SPECS[id].pack === "graveyard")).toBe(true);
    expect(ASSET_PACKS).toContain("graveyard");
    expect(ASSET_CATEGORIES).toContain("spooky");
  });

  it("files the outpost kit under Space at its shared scale", () => {
    const dome = PLACEABLE_SPECS.outpost__hab_dome;
    const nose = PLACEABLE_SPECS.outpost__rocket_nose;
    for (const spec of [dome, nose]) {
      expect(spec?.category).toBe("space");
      expect(spec?.scale).toBe(2);
      expect(spec?.autoFit).toBeUndefined();
    }
    expect(dome!.footprint[0]).toBeGreaterThan(nose!.footprint[0]);
    expect(PLACEABLE_SPECS.outpost__crater_large?.footprint).toEqual([1.6, 1.8]);
    expect(placeableCanWander("outpost__alien")).toBe(true);
    expect(PLACEABLE_SPECS.solar_panel?.category).toBe("space");
    expect(PLACEABLE_SPECS.solar_panel?.glb).toBeUndefined();
    expect(ASSET_PACKS).toContain("outpost");
  });
});

describe("characters", () => {
  it("resolves ids and yaw offset", () => {
    expect(ALL_CHARACTERS.length).toBeGreaterThan(0);
    expect(isCharacterId(DEFAULT_CHARACTER_ID)).toBe(true);
    expect(isCharacterId(null)).toBe(false);
    const spec = getCharacter("missing");
    expect(spec.id).toBeTruthy();
    expect(characterYawOffset({ ...spec, faces: "negZ" })).toBe(Math.PI);
    expect(characterYawOffset({ ...spec, faces: "posZ" })).toBe(0);
  });
});

describe("poly presets", () => {
  it("falls back to a known role", () => {
    expect(isCustomPreset(CUSTOM_PRESET.id)).toBe(true);
    expect(isCustomPreset("explorer")).toBe(false);
    expect(getPolyPreset(CUSTOM_PRESET.id).id).toBe(CUSTOM_PRESET.id);
    expect(ALL_POLY_PRESETS.length).toBeGreaterThan(1);
    const known = ALL_POLY_PRESETS.find((p) => p.id !== CUSTOM_PRESET.id)!;
    expect(getPolyPreset(known.id).id).toBe(known.id);
    expect(getPolyPreset("missing").id).toBeTruthy();
  });
});
