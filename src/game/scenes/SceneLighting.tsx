import { SunShadowLight } from "@/components/scene/SunShadowLight";
import type { MapTheme } from "@/lib/maps/schema";

export function SceneLighting({
  theme,
  floorSize,
}: {
  theme: MapTheme;
  floorSize: number;
}) {
  return (
    <>
      <ambientLight intensity={0.55} color={theme.ambient} />
      <hemisphereLight args={[theme.hemiSky, theme.hemiGround, 0.85]} />
      <SunShadowLight
        castShadow
        position={[8, 12, 6]}
        intensity={1.15}
        color={theme.sun}
        mapSize={1024}
        floorSize={floorSize}
      />
    </>
  );
}
