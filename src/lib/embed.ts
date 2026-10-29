import type { AgentConfig, AppPersisted, DayNightMode } from "@/lib/types";
import { appConfig } from "@/lib/config";
import { PLACEABLE_SPECS } from "@/lib/assets/catalog";
import { getCharacter } from "@/lib/assets/characters";
import { getPolyPreset } from "@/lib/poly/presets";
import { defaultPersisted } from "@/lib/storage";

/** `?embed&map=<id>&time=day|night|cycle`: one world for an iframe, with no UI and nothing saved. */
export interface EmbedOptions {
  mapId: string;
  /** Fixed lighting, or `cycle` to alternate every `embed.cycleSeconds`. */
  time: DayNightMode | "cycle";
}

export function parseEmbedOptions(search: string): EmbedOptions | null {
  const params = new URLSearchParams(search);
  if (!params.has("embed")) return null;
  const time = params.get("time");
  return {
    mapId: params.get("map") || appConfig.defaults.mapId,
    time: time === "night" || time === "cycle" ? time : "day",
  };
}

/** This page load's embed options, or null for the normal app. */
export const embed = parseEmbedOptions(typeof location === "undefined" ? "" : location.search);

/** Distinct GLB files a world loads: its placeables' models plus its agents' character looks. */
export function worldModelUrls(placeableIds: string[], characterIds: string[]): Set<string> {
  const urls = new Set<string>();
  for (const id of placeableIds) {
    const glb = PLACEABLE_SPECS[id]?.glb;
    if (glb) urls.add(glb);
  }
  for (const id of characterIds) urls.add(getCharacter(id).glb);
  return urls;
}

/** In-memory state for an embedded world: the configured crew on the requested map. */
export function embedPersisted(options: EmbedOptions): AppPersisted {
  const agents: AgentConfig[] = appConfig.embed.crew.map(({ roleId, characterId }, index) => {
    const role = getPolyPreset(roleId);
    return {
      id: `embed_${index}`,
      displayName: role.defaultDisplayName,
      modelConfigId: "",
      polyPresetId: role.id,
      characterId,
      systemPrompt: role.defaultSystemPrompt,
      enabled: true,
      thinkingEnabled: false,
      chattiness: 0,
      skills: [],
      color: role.defaultColor,
      bio: role.defaultBio ?? "",
      createdAt: index,
    };
  });
  return {
    ...defaultPersisted(),
    userName: appConfig.embed.visitorName,
    agents,
    mapId: options.mapId,
    dayNight: options.time === "night" ? "night" : "day",
  };
}
