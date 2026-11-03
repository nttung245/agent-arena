import type { ArenaMapDefinition } from "@/lib/maps/schema";
import type { LifeTemplateId, SceneTemplate } from "@/game/scenes/types";
import { homeChildhood } from "@/game/scenes/templates/homeChildhood";
import { schoolClassroom } from "@/game/scenes/templates/schoolClassroom";

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
  home_childhood: homeChildhood,
  school_classroom: schoolClassroom,
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
