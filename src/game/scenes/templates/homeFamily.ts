import { blankMap } from "@/lib/maps/schema";
import type { PlaceableInstance } from "@/lib/types";
import type { SceneTemplate } from "@/game/scenes/types";

const p = (
  id: string,
  placeableId: string,
  position: [number, number, number],
  rotationY = 0,
): PlaceableInstance => ({ id, placeableId, position, rotationY });

export const homeFamily: SceneTemplate = {
  id: "home_family",
  name: "Family home",
  map: blankMap({
    id: "home_family",
    name: "Family home",
    description:
      "A family living room with a sofa, a low table, shelves and a small altar.",
    floor: { size: 16, style: "surface", color: "#C8B49A", surface: "office" },
    theme: {
      floor: "#C8B49A",
      accent: "#8A6A4F",
      background: "#B9A78F",
      fog: "#B9A78F",
      ambient: "#E8DCC8",
      hemiSky: "#E6D6C2",
      hemiGround: "#A48968",
      sun: "#F0D8B8",
    },
    spawnPoints: [{ id: "spawn_0", position: [0, 0, 5], rotationY: 0 }],
    placeables: [
      p("family_sofa", "couch", [-3, 0, 1]),
      p("family_coffee", "coffee_table", [0, 0, 1]),
      p("family_table", "table", [3, 0, -2]),
      p("family_chair_1", "chair", [3, 0, 0]),
      p("family_chair_2", "chair", [4, 0, -2]),
      p("family_shelf", "bookshelf", [-6, 0, -4]),
      p("family_rug", "rug", [0, 0, 1]),
      p("family_plant", "plant_small", [6, 0, 4]),
      p("family_wall_1", "wall_solid", [0, 0, -6]),
      p("family_wall_2", "wall_solid", [-8, 0, 0], Math.PI / 2),
      p("family_wall_3", "wall_solid", [8, 0, 0], Math.PI / 2),
    ],
  }),
  sockets: {
    player_start: { position: [0, 0, 5], rotationY: 0 },
    partner: { position: [-1.5, 0, 0], rotationY: 0 },
    child: { position: [1.5, 0, 0], rotationY: 0 },
    table: { position: [0, 0, -1], rotationY: 0 },
    altar: { position: [-5, 0, -4], rotationY: 0 },
  },
  bounds: { minX: -7.5, maxX: 7.5, minZ: -5.5, maxZ: 5.5 },
  interactables: [
    { id: "table", socket: "table", label: "Sit at the table", kind: "use" },
    { id: "partner", socket: "partner", label: "Talk to your partner", kind: "talk" },
    { id: "child", socket: "child", label: "Talk to your child", kind: "talk" },
    { id: "altar", socket: "altar", label: "Stand by the altar", kind: "look" },
  ],
};
