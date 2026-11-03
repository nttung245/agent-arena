import { blankMap } from "@/lib/maps/schema";
import type { PlaceableInstance } from "@/lib/types";
import type { SceneTemplate } from "@/game/scenes/types";

const p = (
  id: string,
  placeableId: string,
  position: [number, number, number],
  rotationY = 0,
): PlaceableInstance => ({ id, placeableId, position, rotationY });

export const workplaceOffice: SceneTemplate = {
  id: "workplace_office",
  name: "Office",
  map: blankMap({
    id: "workplace_office",
    name: "Office",
    description: "A small office floor with desks, monitors and a window.",
    floor: { size: 16, style: "surface", color: "#BDB7AA", surface: "office" },
    theme: {
      floor: "#BDB7AA",
      accent: "#5E7B73",
      background: "#AEB2AC",
      fog: "#AEB2AC",
      ambient: "#E4E4DB",
      hemiSky: "#DCE3E5",
      hemiGround: "#9A917F",
      sun: "#EFE4CB",
    },
    spawnPoints: [{ id: "spawn_0", position: [0, 0, 5], rotationY: 0 }],
    placeables: [
      p("office_desk_1", "desk", [-3, 0, -1]),
      p("office_desk_2", "desk", [0, 0, -1]),
      p("office_desk_3", "desk", [3, 0, -1]),
      p("office_chair_1", "chair", [-3, 0, 0]),
      p("office_chair_2", "chair", [0, 0, 0]),
      p("office_chair_3", "chair", [3, 0, 0]),
      p("office_monitor_1", "monitor", [-3, 0, -1.3]),
      p("office_monitor_2", "monitor", [0, 0, -1.3]),
      p("office_monitor_3", "monitor", [3, 0, -1.3]),
      p("office_shelf", "bookshelf", [-6, 0, -4]),
      p("office_plant", "plant_small", [6, 0, 4]),
      p("office_wall_1", "wall_solid", [0, 0, -6]),
      p("office_wall_2", "wall_solid", [-8, 0, 0], Math.PI / 2),
      p("office_wall_3", "wall_solid", [8, 0, 0], Math.PI / 2),
    ],
  }),
  sockets: {
    player_start: { position: [0, 0, 5], rotationY: 0 },
    boss: { position: [0, 0, -5], rotationY: 0 },
    coworker: { position: [-3, 0, 0], rotationY: 0 },
    desk: { position: [0, 0, 0], rotationY: 0 },
    window: { position: [0, 0, -6], rotationY: 0 },
  },
  bounds: { minX: -7.5, maxX: 7.5, minZ: -5.5, maxZ: 5.5 },
  interactables: [
    { id: "desk", socket: "desk", label: "Sit at your desk", kind: "use" },
    { id: "boss", socket: "boss", label: "Talk to your boss", kind: "talk" },
    { id: "window", socket: "window", label: "Look out the window", kind: "look" },
  ],
};

export const workplaceShop: SceneTemplate = {
  id: "workplace_shop",
  name: "Shop",
  map: blankMap({
    id: "workplace_shop",
    name: "Shop",
    description: "A small shop with a counter, shelves and boxes of stock.",
    floor: { size: 16, style: "surface", color: "#C3B79F", surface: "office" },
    theme: {
      floor: "#C3B79F",
      accent: "#8A6A4F",
      background: "#B8AB95",
      fog: "#B8AB95",
      ambient: "#E8DDC8",
      hemiSky: "#E4D8C4",
      hemiGround: "#A08B6B",
      sun: "#F0DCB8",
    },
    spawnPoints: [{ id: "spawn_0", position: [0, 0, 5], rotationY: 0 }],
    placeables: [
      p("shop_counter_1", "table", [0, 0, -1]),
      p("shop_counter_2", "table", [2, 0, -1]),
      p("shop_chair", "chair", [0, 0, 1]),
      p("shop_shelf_1", "bookshelf", [-5, 0, -4]),
      p("shop_shelf_2", "bookshelf", [5, 0, -4]),
      p("shop_box_1", "cardboard_box", [-4, 0, 3]),
      p("shop_box_2", "cardboard_box", [4, 0, 3]),
      p("shop_plant", "plant_small", [6, 0, 4]),
      p("shop_wall_1", "wall_solid", [0, 0, -6]),
      p("shop_wall_2", "wall_solid", [-8, 0, 0], Math.PI / 2),
      p("shop_wall_3", "wall_solid", [8, 0, 0], Math.PI / 2),
    ],
  }),
  sockets: {
    player_start: { position: [0, 0, 5], rotationY: 0 },
    shopkeeper: { position: [0, 0, -4], rotationY: 0 },
    customer: { position: [-3, 0, 0], rotationY: 0 },
    counter: { position: [0, 0, -1], rotationY: 0 },
    shelf: { position: [5, 0, 0], rotationY: 0 },
  },
  bounds: { minX: -7.5, maxX: 7.5, minZ: -5.5, maxZ: 5.5 },
  interactables: [
    { id: "counter", socket: "counter", label: "Stand at the counter", kind: "use" },
    { id: "shopkeeper", socket: "shopkeeper", label: "Talk to the shopkeeper", kind: "talk" },
    { id: "shelf", socket: "shelf", label: "Look at the shelves", kind: "look" },
  ],
};
