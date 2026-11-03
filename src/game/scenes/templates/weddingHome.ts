import { blankMap } from "@/lib/maps/schema";
import type { PlaceableInstance } from "@/lib/types";
import type { SceneTemplate } from "@/game/scenes/types";

const p = (
  id: string,
  placeableId: string,
  position: [number, number, number],
  rotationY = 0,
): PlaceableInstance => ({ id, placeableId, position, rotationY });

export const weddingHome: SceneTemplate = {
  id: "wedding_home",
  name: "A small ceremony",
  map: blankMap({
    id: "wedding_home",
    name: "A small ceremony",
    description:
      "A small room set for a family ceremony: a table, flowers and a woven rug.",
    floor: { size: 14, style: "surface", color: "#C8B49A", surface: "office" },
    theme: {
      floor: "#C8B49A",
      accent: "#8A6A4F",
      background: "#C2AE92",
      fog: "#C2AE92",
      ambient: "#EEE0C8",
      hemiSky: "#EAD8BE",
      hemiGround: "#A48968",
      sun: "#F3DDB8",
    },
    spawnPoints: [{ id: "spawn_0", position: [0, 0, 4], rotationY: 0 }],
    placeables: [
      p("wedding_table", "table", [0, 0, -1]),
      p("wedding_chair_1", "chair", [-1, 0, 1]),
      p("wedding_chair_2", "chair", [1, 0, 1]),
      p("wedding_rug", "rug", [0, 0, 1]),
      p("wedding_plant_1", "plant_small", [-4, 0, -3]),
      p("wedding_plant_2", "plant_small", [4, 0, -3]),
      p("wedding_wall_1", "wall_solid", [0, 0, -5.5]),
      p("wedding_wall_2", "wall_solid", [-5.5, 0, 0], Math.PI / 2),
      p("wedding_wall_3", "wall_solid", [5.5, 0, 0], Math.PI / 2),
    ],
  }),
  sockets: {
    player_start: { position: [0, 0, 4], rotationY: 0 },
    partner: { position: [1.5, 0, 0], rotationY: 0 },
    mother: { position: [-1.5, 0, 0], rotationY: 0 },
    father: { position: [-3, 0, 1], rotationY: 0 },
  },
  bounds: { minX: -5.5, maxX: 5.5, minZ: -4.5, maxZ: 4.5 },
  interactables: [
    { id: "partner", socket: "partner", label: "Take your partner's hand", kind: "talk" },
    { id: "table", socket: "player_start", label: "Stand at the table", kind: "use" },
  ],
};
