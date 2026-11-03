import { blankMap } from "@/lib/maps/schema";
import type { PlaceableInstance } from "@/lib/types";
import type { SceneTemplate } from "@/game/scenes/types";

const p = (
  id: string,
  placeableId: string,
  position: [number, number, number],
  rotationY = 0,
): PlaceableInstance => ({ id, placeableId, position, rotationY });

export const homeChildhood: SceneTemplate = {
  id: "home_childhood",
  name: "Home",
  map: blankMap({
    id: "home_childhood",
    name: "Home",
    description:
      "A small family room with a bed, a low table, a bookshelf and a window.",
    floor: {
      size: 14,
      style: "surface",
      color: "#C8B49A",
      surface: "office",
    },
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
    roomLights: true,
    spawnPoints: [
      { id: "spawn_0", position: [0, 0, 5], rotationY: 0 },
    ],
    placeables: [
      p("home_bed", "furniture__bed_single", [-4, 0, -3]),
      p("home_table", "furniture__table_cross", [0, 0, -1]),
      p("home_chair", "furniture__chair_rounded", [0.9, 0, -1], -Math.PI / 2),
      p("home_bookcase", "bookcase_books", [-4, 0, 1]),
      p("home_rug", "furniture__rug_round", [0, 0, 1.5]),
      p("home_plant", "plant_small", [4, 0, 2]),
      p("home_lamp", "desk_lamp", [3.2, 0, 3.2]),
      p("home_wall_n", "wall_solid", [0, 0, -6.5]),
      p("home_wall_s", "wall_solid", [0, 0, 6.5]),
      p("home_wall_w", "wall_solid", [-6.5, 0, 0], Math.PI / 2),
      p("home_wall_e", "wall_solid", [6.5, 0, 0], Math.PI / 2),
    ],
  }),
  sockets: {
    player_start: { position: [0, 0, 5], rotationY: 0 },
    mother: { position: [-1.5, 0, 0], rotationY: 0 },
    father: { position: [1.5, 0, 0], rotationY: 0 },
    bed: { position: [-4, 0, -3], rotationY: 0 },
    table: { position: [0, 0, -1], rotationY: 0 },
    window: { position: [0, 0, -6], rotationY: 0 },
    door: { position: [5, 0, 0], rotationY: 0 },
  },
  bounds: { minX: -6.5, maxX: 6.5, minZ: -6.5, maxZ: 6.5 },
  interactables: [
    { id: "table", socket: "table", label: "Sit at the table", kind: "use" },
    { id: "bed", socket: "bed", label: "Look at the bed", kind: "look" },
    { id: "window", socket: "window", label: "Look out the window", kind: "look" },
    { id: "door", socket: "door", label: "Go to the door", kind: "use" },
  ],
};
