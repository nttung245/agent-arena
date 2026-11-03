import { blankMap } from "@/lib/maps/schema";
import type { PlaceableInstance } from "@/lib/types";
import type { SceneTemplate } from "@/game/scenes/types";

const p = (
  id: string,
  placeableId: string,
  position: [number, number, number],
  rotationY = 0,
): PlaceableInstance => ({ id, placeableId, position, rotationY });

export const streetNeighborhood: SceneTemplate = {
  id: "street_neighborhood",
  name: "Neighborhood street",
  map: blankMap({
    id: "street_neighborhood",
    name: "Neighborhood street",
    description:
      "A neighborhood street: shophouse walls, a tree, a bench and a few cars.",
    floor: { size: 20, style: "surface", color: "#A9A39A", surface: "concrete" },
    theme: {
      floor: "#A9A39A",
      accent: "#8A6A4F",
      background: "#B4AEA4",
      fog: "#B4AEA4",
      ambient: "#E6E1D7",
      hemiSky: "#DDE4E6",
      hemiGround: "#9A8E7C",
      sun: "#F0DDBD",
    },
    spawnPoints: [{ id: "spawn_0", position: [0, 0, 3], rotationY: 0 }],
    placeables: [
      p("street_shop_1", "wall_solid", [-9, 0, -4], Math.PI / 2),
      p("street_shop_2", "wall_solid", [9, 0, -4], Math.PI / 2),
      p("street_wall_1", "wall_solid", [0, 0, -5]),
      p("street_car_1", "cars__car", [-4, 0, 0]),
      p("street_car_2", "cars__taxi", [4, 0, 1]),
      p("street_tree_1", "tree_simple", [-6, 0, 3]),
      p("street_tree_2", "tree_simple", [6, 0, 3]),
      p("street_bench", "bench", [7, 0, -2]),
    ],
  }),
  sockets: {
    player_start: { position: [0, 0, 3], rotationY: 0 },
    mother: { position: [-2, 0, 1], rotationY: 0 },
    friend: { position: [2, 0, 1], rotationY: 0 },
    shop: { position: [6, 0, -2], rotationY: 0 },
    corner: { position: [-6, 0, -2], rotationY: 0 },
  },
  bounds: { minX: -9.5, maxX: 9.5, minZ: -4.5, maxZ: 4.5 },
  interactables: [
    { id: "shop", socket: "shop", label: "Go into the shop", kind: "use" },
    { id: "corner", socket: "corner", label: "Look down the street", kind: "look" },
    { id: "friend", socket: "friend", label: "Talk to your friend", kind: "talk" },
  ],
};
