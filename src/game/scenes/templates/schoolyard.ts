import { blankMap } from "@/lib/maps/schema";
import type { PlaceableInstance } from "@/lib/types";
import type { SceneTemplate } from "@/game/scenes/types";

const p = (
  id: string,
  placeableId: string,
  position: [number, number, number],
  rotationY = 0,
): PlaceableInstance => ({ id, placeableId, position, rotationY });

export const schoolyard: SceneTemplate = {
  id: "schoolyard",
  name: "Schoolyard",
  map: blankMap({
    id: "schoolyard",
    name: "Schoolyard",
    description:
      "A schoolyard with trees, a bench and the low wall of the school building.",
    floor: { size: 18, style: "surface", color: "#8FA27A", surface: "grass" },
    theme: {
      floor: "#8FA27A",
      accent: "#5E7B73",
      background: "#A9B79D",
      fog: "#A9B79D",
      ambient: "#E4E8D9",
      hemiSky: "#DDE6E8",
      hemiGround: "#8F9A76",
      sun: "#F2E5C4",
    },
    spawnPoints: [{ id: "spawn_0", position: [0, 0, 6], rotationY: 0 }],
    placeables: [
      p("yard_tree_1", "tree_simple", [-7, 0, -5]),
      p("yard_tree_2", "tree_simple", [7, 0, -5]),
      p("yard_tree_3", "tree_simple", [-6, 0, 4]),
      p("yard_bench_1", "bench", [4, 0, 2]),
      p("yard_bench_2", "bench", [-4, 0, 2]),
      p("yard_wall_1", "wall_solid", [0, 0, -7]),
      p("yard_wall_2", "wall_solid", [-9, 0, 0], Math.PI / 2),
      p("yard_wall_3", "wall_solid", [9, 0, 0], Math.PI / 2),
      p("yard_plant", "plant_small", [2, 0, 4]),
    ],
  }),
  sockets: {
    player_start: { position: [0, 0, 6], rotationY: 0 },
    friend: { position: [-3, 0, 1], rotationY: 0 },
    teacher: { position: [3, 0, -4], rotationY: 0 },
    bench: { position: [4, 0, 2], rotationY: 0 },
    gate: { position: [0, 0, 8], rotationY: 0 },
  },
  bounds: { minX: -8.5, maxX: 8.5, minZ: -6.5, maxZ: 6.5 },
  interactables: [
    { id: "friend", socket: "friend", label: "Talk to your friend", kind: "talk" },
    { id: "bench", socket: "bench", label: "Sit on the bench", kind: "look" },
    { id: "gate", socket: "gate", label: "Walk to the gate", kind: "use" },
  ],
};
