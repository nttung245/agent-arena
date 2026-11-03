import { Placeables } from "@/components/scene/Placeables";
import type { ArenaMapDefinition } from "@/lib/maps/schema";

export function LifeProps({ map }: { map: ArenaMapDefinition }) {
  return (
    <group>
      <Placeables items={map.placeables} />
    </group>
  );
}
