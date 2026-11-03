import { blankMap } from "@/lib/maps/schema";
import type { PlaceableInstance } from "@/lib/types";
import type { SceneTemplate } from "@/game/scenes/types";

const p = (
  id: string,
  placeableId: string,
  position: [number, number, number],
  rotationY = 0,
): PlaceableInstance => ({ id, placeableId, position, rotationY });

export const schoolClassroom: SceneTemplate = {
  id: "school_classroom",
  name: "Classroom",
  map: blankMap({
    id: "school_classroom",
    name: "Classroom",
    description:
      "A simple classroom: desks in rows, a board at the front, a bookshelf and a plant.",
    floor: {
      size: 16,
      style: "surface",
      color: "#B9B3A6",
      surface: "office",
    },
    theme: {
      floor: "#B9B3A6",
      accent: "#5E7B73",
      background: "#AEB4AE",
      fog: "#AEB4AE",
      ambient: "#E2E6E0",
      hemiSky: "#D8E0E2",
      hemiGround: "#9A917F",
      sun: "#EFE5CC",
    },
    roomLights: true,
    spawnPoints: [
      { id: "spawn_0", position: [0, 0, 5], rotationY: 0 },
    ],
    placeables: [
      p("school_desk_1", "desk", [-3, 0, -1]),
      p("school_desk_2", "desk", [0, 0, -1]),
      p("school_desk_3", "desk", [3, 0, -1]),
      p("school_desk_4", "desk", [0, 0, 2]),
      p("school_chair_1", "chair", [-3, 0, 0]),
      p("school_chair_2", "chair", [0, 0, 0]),
      p("school_chair_3", "chair", [3, 0, 0]),
      p("school_chair_4", "chair", [0, 0, 3]),
      p("school_bookshelf", "bookshelf", [-6, 0, -4]),
      p("school_plant", "plant_small", [6, 0, 4]),
      p("school_wall_n", "wall_solid", [0, 0, -6]),
      p("school_wall_s", "wall_solid", [0, 0, 6]),
      p("school_wall_w", "wall_solid", [-8, 0, 0], Math.PI / 2),
      p("school_wall_e", "wall_solid", [8, 0, 0], Math.PI / 2),
    ],
  }),
  sockets: {
    player_start: { position: [0, 0, 5], rotationY: 0 },
    teacher: { position: [0, 0, -5], rotationY: 0 },
    friend: { position: [-3, 0, 0], rotationY: 0 },
    desk: { position: [0, 0, 0], rotationY: 0 },
    board: { position: [0, 0, -6], rotationY: 0 },
  },
  bounds: { minX: -7.5, maxX: 7.5, minZ: -5.5, maxZ: 5.5 },
  interactables: [
    { id: "desk", socket: "desk", label: "Sit at your desk", kind: "use" },
    { id: "board", socket: "board", label: "Look at the board", kind: "look" },
    { id: "friend", socket: "friend", label: "Talk to your friend", kind: "talk" },
  ],
};
