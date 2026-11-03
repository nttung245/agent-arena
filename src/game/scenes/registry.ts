import type { ArenaMapDefinition } from "@/lib/maps/schema";
import type { LifeTemplateId, SceneTemplate } from "@/game/scenes/types";
import { birthHome } from "@/game/scenes/templates/birthHome";
import { cemeteryMemorial } from "@/game/scenes/templates/cemeteryMemorial";
import { homeChildhood } from "@/game/scenes/templates/homeChildhood";
import { homeFamily } from "@/game/scenes/templates/homeFamily";
import { birthHospital, hospital } from "@/game/scenes/templates/hospital";
import { schoolClassroom } from "@/game/scenes/templates/schoolClassroom";
import { weddingHome } from "@/game/scenes/templates/weddingHome";
import { schoolyard } from "@/game/scenes/templates/schoolyard";
import { streetNeighborhood } from "@/game/scenes/templates/streetNeighborhood";
import {
  workplaceOffice,
  workplaceShop,
} from "@/game/scenes/templates/workplace";

const ALL_TEMPLATE_IDS: readonly LifeTemplateId[] = [
  "birth_home",
  "birth_hospital",
  "home_childhood",
  "home_family",
  "school_classroom",
  "schoolyard",
  "street_neighborhood",
  "workplace_office",
  "workplace_shop",
  "workplace_factory",
  "farm_field",
  "hospital",
  "temple_church",
  "cemetery_memorial",
  "wedding_home",
  "station",
];

const REAL_TEMPLATES: Partial<Record<LifeTemplateId, SceneTemplate>> = {
  birth_home: birthHome,
  birth_hospital: birthHospital,
  home_childhood: homeChildhood,
  home_family: homeFamily,
  school_classroom: schoolClassroom,
  schoolyard,
  street_neighborhood: streetNeighborhood,
  workplace_office: workplaceOffice,
  workplace_shop: workplaceShop,
  hospital,
  cemetery_memorial: cemeteryMemorial,
  wedding_home: weddingHome,
};

/** Temporary template until the dedicated scene is authored. */
function stubTemplate(id: LifeTemplateId): SceneTemplate {
  return {
    ...homeChildhood,
    id,
    name: `${homeChildhood.name} (stub: ${id})`,
  };
}

export const SCENE_TEMPLATES: Record<LifeTemplateId, SceneTemplate> =
  Object.fromEntries(
    ALL_TEMPLATE_IDS.map((id) => [
      id,
      REAL_TEMPLATES[id] ?? stubTemplate(id),
    ]),
  ) as Record<LifeTemplateId, SceneTemplate>;

export function getSceneTemplate(id: LifeTemplateId): SceneTemplate {
  const template = SCENE_TEMPLATES[id];
  if (!template) throw new Error(`unknown_template:${id}`);
  return template;
}

export function buildSceneMap(
  template: SceneTemplate,
  _dressing: string[] = [],
): ArenaMapDefinition {
  return structuredClone(template.map);
}
