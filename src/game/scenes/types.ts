import type { ArenaMapDefinition } from "@/lib/maps/schema";

export type LifeTemplateId =
  | "birth_home"
  | "birth_hospital"
  | "home_childhood"
  | "home_family"
  | "school_classroom"
  | "schoolyard"
  | "street_neighborhood"
  | "workplace_office"
  | "workplace_shop"
  | "workplace_factory"
  | "farm_field"
  | "hospital"
  | "temple_church"
  | "cemetery_memorial"
  | "wedding_home"
  | "station";

export interface SceneSocket {
  position: [number, number, number];
  rotationY: number;
}

export interface SceneInteractableDef {
  id: string;
  socket: string;
  label: string;
  kind: "talk" | "look" | "use";
}

export interface SceneTemplate {
  id: LifeTemplateId;
  name: string;
  map: ArenaMapDefinition;
  sockets: Record<string, SceneSocket>;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  interactables: SceneInteractableDef[];
}

export interface SceneCastMember {
  role: string;
  name: string;
  age: number;
  characterId: string;
  mood: string;
  socket: string;
  lines: string[];
}

export interface SceneInteractable {
  id: string;
  socket: string;
  label: string;
  kind: "talk" | "look" | "use";
  choiceKey?: string;
  focusKey?: string;
}

export interface ScenePlan {
  template: LifeTemplateId;
  title: string;
  summary: string;
  timeOfDay: "morning" | "noon" | "afternoon" | "evening" | "night";
  weather: "clear" | "rain" | "overcast" | "hot";
  cast: SceneCastMember[];
  player: { socket: string; age: number; cameraHeight: number };
  dialogue: Array<{ speaker: string; text: string }>;
  interactables: SceneInteractable[];
  choiceBindings: Record<string, string>;
  ambience: string;
  /** A flashback may show a person who is dead in the present. */
  memory?: boolean;
}

export interface LifeFactPerson {
  name: string;
  role: string;
  age?: number;
  alive: boolean;
}

export interface LifeFactSheet {
  playerName: string;
  age: number;
  year?: number;
  place?: string;
  job?: string;
  partner?: string;
  children: string[];
  people: LifeFactPerson[];
}
