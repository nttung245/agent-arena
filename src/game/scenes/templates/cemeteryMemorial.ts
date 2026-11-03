import { blankMap } from "@/lib/maps/schema";
import type { PlaceableInstance } from "@/lib/types";
import type { SceneTemplate } from "@/game/scenes/types";

const p = (
  id: string,
  placeableId: string,
  position: [number, number, number],
  rotationY = 0,
): PlaceableInstance => ({ id, placeableId, position, rotationY });

export const cemeteryMemorial: SceneTemplate = {
  id: "cemetery_memorial",
  name: "Memorial",
  map: blankMap({
    id: "cemetery_memorial",
    name: "Memorial",
    description:
      "A quiet memorial ground with gravestones, a bench and trees.",
    floor: { size: 18, style: "surface", color: "#7F8A6E", surface: "grass" },
    theme: {
      floor: "#7F8A6E",
      accent: "#6B735F",
      background: "#9AA28C",
      fog: "#9AA28C",
      ambient: "#DDE2D4",
      hemiSky: "#D8E0E0",
      hemiGround: "#7C8468",
      sun: "#EADDBA",
    },
    spawnPoints: [{ id: "spawn_0", position: [0, 0, 6], rotationY: 0 }],
    placeables: [
      p("memorial_grave_1", "graveyard__gravestone_cross", [-3, 0, -2]),
      p("memorial_grave_2", "graveyard__gravestone_cross", [0, 0, -2]),
      p("memorial_grave_3", "graveyard__gravestone_cross", [3, 0, -2]),
      p("memorial_grave_4", "graveyard__grave", [0, 0, -5]),
      p("memorial_bench", "bench", [0, 0, 2]),
      p("memorial_tree_1", "tree_simple", [-7, 0, -4]),
      p("memorial_tree_2", "tree_simple", [7, 0, -4]),
      p("memorial_plant", "plant_small", [5, 0, 3]),
    ],
  }),
  sockets: {
    player_start: { position: [0, 0, 6], rotationY: 0 },
    grave: { position: [0, 0, -2], rotationY: 0 },
    bench: { position: [0, 0, 2], rotationY: 0 },
    tree: { position: [-7, 0, -4], rotationY: 0 },
  },
  bounds: { minX: -8.5, maxX: 8.5, minZ: -6.5, maxZ: 6.5 },
  interactables: [
    { id: "grave", socket: "grave", label: "Stand by the grave", kind: "look" },
    { id: "bench", socket: "bench", label: "Sit on the bench", kind: "look" },
  ],
};
