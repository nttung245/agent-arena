import { describe, expect, it } from "vitest";
import { appConfig } from "@/lib/config";
import { embed, embedPersisted, parseEmbedOptions, worldModelUrls } from "@/lib/embed";

describe("embed mode", () => {
  it("stays off without ?embed", () => {
    expect(parseEmbedOptions("")).toBeNull();
    expect(parseEmbedOptions("?map=halloween")).toBeNull();
    expect(embed).toBeNull();
  });

  it("reads the map and the time of day", () => {
    expect(parseEmbedOptions("?embed&map=red_planet&time=cycle")).toEqual({ mapId: "red_planet", time: "cycle" });
    expect(parseEmbedOptions("?embed&time=night")).toEqual({ mapId: appConfig.defaults.mapId, time: "night" });
    expect(parseEmbedOptions("?embed=1&time=noon")?.time).toBe("day");
  });

  it("puts the configured crew on the requested map", () => {
    const state = embedPersisted({ mapId: "halloween", time: "night" });
    expect(state.userName).toBe(appConfig.embed.visitorName);
    expect(state.mapId).toBe("halloween");
    expect(state.dayNight).toBe("night");
    expect(state.idleChatterEnabled).toBe(false);
    expect(state.agents).toHaveLength(appConfig.embed.crew.length);
    expect(state.agents.every((agent) => agent.enabled && agent.modelConfigId === "")).toBe(true);
    expect(state.agents.map((agent) => agent.characterId)).toEqual(appConfig.embed.crew.map((member) => member.characterId));
    expect(embedPersisted({ mapId: "halloween", time: "cycle" }).dayNight).toBe("day");
  });

  it("counts each model file once and skips procedural props", () => {
    const urls = worldModelUrls(
      ["graveyard__pumpkin", "graveyard__pumpkin", "beacon", "not-real"],
      ["generic-male", "generic-male", "citizen-1"],
    );
    expect(urls.size).toBe(3);
    expect([...urls].some((url) => decodeURIComponent(url).endsWith("graveyard/Pumpkin.glb"))).toBe(true);
  });
});
