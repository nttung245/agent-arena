import { blankMap } from "@/lib/maps/schema";
import type { PlaceableInstance } from "@/lib/types";
import type { SceneTemplate } from "@/game/scenes/types";

const p = (
  id: string,
  placeableId: string,
  position: [number, number, number],
  rotationY = 0,
): PlaceableInstance => ({ id, placeableId, position, rotationY });

export const birthHospital: SceneTemplate = {
  id: "birth_hospital",
  name: "Clinic room",
  map: blankMap({
    id: "birth_hospital",
    name: "Clinic room",
    description: "A small clinic room with a bed, a cabinet and a window.",
    floor: { size: 12, style: "surface", color: "#C6C9C4", surface: "concrete" },
    theme: {
      floor: "#C6C9C4",
      accent: "#5E7B73",
      background: "#B9C0BC",
      fog: "#B9C0BC",
      ambient: "#E6ECE8",
      hemiSky: "#DCE6E6",
      hemiGround: "#9AA39A",
      sun: "#EDE8D8",
    },
    spawnPoints: [{ id: "spawn_0", position: [0, 0, 3], rotationY: 0 }],
    placeables: [
      p("clinic_bed", "furniture__bed_single", [-2, 0, -2]),
      p("clinic_cabinet", "cabinet", [3, 0, -3]),
      p("clinic_plant", "plant_small", [4, 0, 3]),
      p("clinic_wall_1", "wall_solid", [0, 0, -5.5]),
      p("clinic_wall_2", "wall_solid", [0, 0, 5.5]),
      p("clinic_wall_3", "wall_solid", [-5.5, 0, 0], Math.PI / 2),
      p("clinic_wall_4", "wall_solid", [5.5, 0, 0], Math.PI / 2),
    ],
  }),
  sockets: {
    player_start: { position: [0, 0, 3], rotationY: 0 },
    mother: { position: [-3, 0, 0], rotationY: 0 },
    nurse: { position: [2, 0, -1], rotationY: 0 },
    bed: { position: [-2, 0, -2], rotationY: 0 },
  },
  bounds: { minX: -5.5, maxX: 5.5, minZ: -5.5, maxZ: 5.5 },
  interactables: [
    { id: "bed", socket: "bed", label: "Look at the bed", kind: "look" },
    { id: "nurse", socket: "nurse", label: "Talk to the nurse", kind: "talk" },
  ],
};

export const hospital: SceneTemplate = {
  id: "hospital",
  name: "Hospital ward",
  map: blankMap({
    id: "hospital",
    name: "Hospital ward",
    description: "A hospital ward with a bed, a chair and a window.",
    floor: { size: 14, style: "surface", color: "#C6C9C4", surface: "concrete" },
    theme: {
      floor: "#C6C9C4",
      accent: "#5E7B73",
      background: "#B9C0BC",
      fog: "#B9C0BC",
      ambient: "#E6ECE8",
      hemiSky: "#DCE6E6",
      hemiGround: "#9AA39A",
      sun: "#EDE8D8",
    },
    spawnPoints: [{ id: "spawn_0", position: [0, 0, 4], rotationY: 0 }],
    placeables: [
      p("ward_bed", "furniture__bed_single", [-2, 0, -2]),
      p("ward_chair", "chair", [2, 0, -1]),
      p("ward_cabinet", "cabinet", [4, 0, -3]),
      p("ward_plant", "plant_small", [5, 0, 4]),
      p("ward_wall_1", "wall_solid", [0, 0, -5]),
      p("ward_wall_2", "wall_solid", [0, 0, 5]),
      p("ward_wall_3", "wall_solid", [-6.5, 0, 0], Math.PI / 2),
      p("ward_wall_4", "wall_solid", [6.5, 0, 0], Math.PI / 2),
    ],
  }),
  sockets: {
    player_start: { position: [0, 0, 4], rotationY: 0 },
    doctor: { position: [2, 0, -2], rotationY: 0 },
    family: { position: [1, 0, 1], rotationY: 0 },
    bed: { position: [-2, 0, -2], rotationY: 0 },
  },
  bounds: { minX: -6.5, maxX: 6.5, minZ: -4.5, maxZ: 4.5 },
  interactables: [
    { id: "bed", socket: "bed", label: "Look at the bed", kind: "look" },
    { id: "doctor", socket: "doctor", label: "Talk to the doctor", kind: "talk" },
  ],
};
