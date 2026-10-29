import { PLACEABLE_SPECS } from "@/lib/assets/catalog";

export type LampKind =
  | "floor"
  | "desk"
  | "ceiling"
  | "wall"
  | "beacon"
  | "pumpkin"
  | "lantern"
  | "lightpost"
  | "candle";

/** Resolve lamp type from curated id or pack GLB name. */
export function getLampKind(placeableId: string): LampKind | null {
  if (placeableId === "floor_lamp" || placeableId === "lamp_square") return "floor";
  if (placeableId === "desk_lamp") return "desk";
  if (placeableId === "beacon") return "beacon";

  const glb = PLACEABLE_SPECS[placeableId]?.glb ?? "";
  const decoded = decodeURIComponent(glb).toLowerCase();
  const id = placeableId.toLowerCase();
  if (/beacon/.test(id)) return "beacon";
  // Graveyard kit practicals carry no "lamp" in their names.
  if (/pumpkin.*carved/.test(id)) return "pumpkin";
  if (/lightpost/.test(id)) return "lightpost";
  if (/lantern/.test(id)) return "lantern";
  if (/candle/.test(id)) return "candle";
  if (!/lamp/.test(decoded) && !/lamp/.test(id)) return null;

  if (/ceiling/.test(decoded) || /ceiling/.test(id)) return "ceiling";
  if (/wall/.test(decoded) || /wall/.test(id)) return "wall";
  if (/floor/.test(decoded) || /floor/.test(id)) return "floor";
  if (/table|desk/.test(decoded) || /table|desk/.test(id)) return "desk";
  return "desk";
}

export function isLampPlaceable(placeableId: string): boolean {
  return getLampKind(placeableId) != null;
}
