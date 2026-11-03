import { blankMap } from "@/lib/maps/schema";
import type { PlaceableInstance } from "@/lib/types";
import type { SceneTemplate } from "@/game/scenes/types";

const p = (
  id: string,
  placeableId: string,
  position: [number, number, number],
  rotationY = 0,
): PlaceableInstance => ({ id, placeableId, position, rotationY });

export const birthHome: SceneTemplate = {
  id: "birth_home",
  name: "The first room",
  map: blankMap({
    id: "birth_home",
    name: "The first room",
    description: "A small bedroom with a bed, a side table and a window.",
    floor: { size: 12, style: "surface", color: "#C8B49A", surface: "office" },
    theme: {
      floor: "#C8B49A",
      accent: "#8A6A4F",
      background: "#BBA98F",
      fog: "#BBA98F",
      ambient: "#E9DDC9",
      hemiSky: "#E6D6C2",
      hemiGround: "#A48968",
      sun: "#F0D8B8",
    },
    spawnPoints: [{ id: "spawn_0", position: [0, 0, 3], rotationY: 0 }],
    placeables: [
      p("birth_bed", "furniture__bed_single", [-3, 0, -2]),
      p("birth_table", "side_table", [-3, 0, 0]),
      p("birth_lamp", "desk_lamp", [3, 0, 2]),
      p("birth_plant", "plant_small", [4, 0, 3]),
      p("birth_wall_1", "wall_solid", [0, 0, -5.5]),
      p("birth_wall_2", "wall_solid", [0, 0, 5.5]),
      p("birth_wall_3", "wall_solid", [-5.5, 0, 0], Math.PI / 2),
      p("birth_wall_4", "wall_solid", [5.5, 0, 0], Math.PI / 2),
    ],
  }),
  sockets: {
    player_start: { position: [0, 0, 3], rotationY: 0 },
    mother: { position: [-1.5, 0, -1], rotationY: 0 },
    father: { position: [1.5, 0, -1], rotationY: 0 },
    bed: { position: [-3, 0, -2], rotationY: 0 },
    window: { position: [0, 0, -5], rotationY: 0 },
  },
  bounds: { minX: -5.5, maxX: 5.5, minZ: -5.5, maxZ: 5.5 },
  interactables: [
    { id: "bed", socket: "bed", label: "Look at the bed", kind: "look" },
    { id: "window", socket: "window", label: "Look out the window", kind: "look" },
  ],
};
