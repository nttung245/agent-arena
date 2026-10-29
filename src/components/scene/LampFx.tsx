import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { PointLight } from "three";
import { useArenaStore } from "@/store/arenaStore";
import type { LampKind } from "@/components/scene/lampKind";

type LampProfile = {
  /** Warm bulb color. */
  color: string;
  /** Soft fill spill. */
  fillColor: string;
  /** Local bulb position (meters, prop space). */
  position: [number, number, number];
  /** Secondary soft fill offset from bulb. */
  fillOffset: [number, number, number];
  /** 0 = no main light (glow only). */
  intensity: number;
  /** 0 = no fill light. */
  fillIntensity: number;
  distance: number;
  fillDistance: number;
  /** Point-light falloff; lower = softer / wider. Default 1. */
  decay?: number;
  /** 0 = no glow mesh. */
  glowRadius: number;
  glowPosition: [number, number, number];
  /** Fixed glow opacity (e.g. an opaque candle flame) instead of the day/night ramp. */
  glowOpacity?: number;
  /** Candle-like flicker depth on the main light, 0–1. */
  flicker?: number;
};

const PROFILES: Record<LampKind, LampProfile> = {
  floor: {
    color: "#ffe6c4",
    fillColor: "#ffd9a8",
    position: [0, 1.32, 0],
    fillOffset: [0, -0.55, 0],
    intensity: 0.62,
    fillIntensity: 0.48,
    distance: 17,
    fillDistance: 13,
    glowRadius: 0.12,
    glowPosition: [0, 1.32, 0],
  },
  desk: {
    color: "#ffe8c8",
    fillColor: "#ffdcb0",
    position: [0, 0.34, 0],
    fillOffset: [0, -0.18, 0.04],
    intensity: 0.5,
    fillIntensity: 0.34,
    distance: 8.5,
    fillDistance: 6.2,
    glowRadius: 0.06,
    glowPosition: [0, 0.34, 0],
  },
  ceiling: {
    color: "#fff4e0",
    fillColor: "#ffe9c8",
    position: [0, -0.12, 0],
    fillOffset: [0, -0.7, 0],
    intensity: 0.72,
    fillIntensity: 0.52,
    distance: 18,
    fillDistance: 13,
    glowRadius: 0.11,
    glowPosition: [0, -0.08, 0],
  },
  wall: {
    color: "#ffe0b8",
    fillColor: "#ffd29a",
    position: [0, 0.22, 0.12],
    fillOffset: [0, -0.12, 0.35],
    intensity: 0.55,
    fillIntensity: 0.38,
    distance: 11,
    fillDistance: 8,
    glowRadius: 0.07,
    glowPosition: [0, 0.22, 0.1],
  },
  beacon: {
    color: "#9ad4ff",
    fillColor: "#6eb0ff",
    position: [0, 1.92, 0],
    fillOffset: [0, -0.65, 0],
    intensity: 1.45,
    fillIntensity: 0.95,
    distance: 30,
    fillDistance: 24,
    decay: 0.65,
    glowRadius: 0.2,
    glowPosition: [0, 1.92, 0],
  },
  // Graveyard kit (packScale 2): positions measured on the grounded models.
  pumpkin: {
    color: "#ff9a3c",
    fillColor: "#ff9a3c",
    // Just in front of the carved face (+Z); the face itself glows via its emissive map.
    position: [0, 0.3, 0.2],
    fillOffset: [0, 0, 0],
    intensity: 1.3,
    fillIntensity: 0,
    distance: 4.5,
    fillDistance: 0,
    glowRadius: 0,
    glowPosition: [0, 0, 0],
    flicker: 0.25,
  },
  lantern: {
    color: "#ffc070",
    fillColor: "#ffc070",
    position: [0, 0.42, 0],
    fillOffset: [0, 0, 0],
    intensity: 0.8,
    fillIntensity: 0,
    distance: 6,
    fillDistance: 0,
    glowRadius: 0.045,
    glowPosition: [0, 0.37, 0],
    glowOpacity: 0.9,
    flicker: 0.2,
  },
  lightpost: {
    color: "#ffd48a",
    fillColor: "#ffd48a",
    position: [0, 2.0, 0.26],
    fillOffset: [0, 0, 0],
    intensity: 1.7,
    fillIntensity: 0,
    distance: 12,
    fillDistance: 0,
    glowRadius: 0.17,
    glowPosition: [0, 2.09, 0.26],
    flicker: 0.06,
  },
  candle: {
    color: "#ffb24a",
    fillColor: "#ffb24a",
    position: [0, 0.44, 0],
    fillOffset: [0, 0, 0],
    intensity: 0,
    fillIntensity: 0,
    distance: 0,
    fillDistance: 0,
    glowRadius: 0.04,
    glowPosition: [0, 0.44, 0],
    glowOpacity: 0.95,
  },
};

/** Warm point lights + soft shade glow for lamps and candle-lit props. */
export function LampFx({ kind }: { kind: LampKind }) {
  const lampLights = useArenaStore((s) => s.graphics.lampLights);
  const dayNightBlend = useArenaStore((s) => s.dayNightBlend);
  const profile = PROFILES[kind];
  const mainLight = useRef<PointLight>(null);
  // Per-instance phase so neighbouring candles don't flicker in sync.
  const phase = useMemo(() => Math.random() * 100, []);

  const { nightBoost, strength, glowOpacity, distMul } = useMemo(() => {
    const night = dayNightBlend;
    return {
      // Day keeps a soft pool; night brings lamps up so they read as practicals.
      nightBoost: 0.55 + night * 0.73,
      // Setting off still keeps a dim practical glow (same idea as campfire).
      strength: lampLights ? 1 : 0.55,
      glowOpacity: (lampLights ? 0.22 : 0.16) + night * (lampLights ? 0.16 : 0.12),
      distMul: lampLights ? 1.12 : 0.85,
    };
  }, [dayNightBlend, lampLights]);

  const mainI = profile.intensity * strength * nightBoost;
  const fillI = profile.fillIntensity * strength * nightBoost;
  const decay = profile.decay ?? 1;

  useFrame(({ clock }) => {
    const flicker = profile.flicker;
    if (!flicker || !mainLight.current) return;
    const t = clock.elapsedTime + phase;
    const wave = 0.5 + 0.35 * Math.sin(t * 13) + 0.15 * Math.sin(t * 29.7 + 1.3);
    mainLight.current.intensity = mainI * (1 - flicker + flicker * wave);
  });

  return (
    <group>
      {mainI > 0 && (
        <pointLight
          ref={mainLight}
          color={profile.color}
          intensity={mainI}
          distance={profile.distance * distMul}
          decay={decay}
          position={profile.position}
        />
      )}
      {fillI > 0 && (
        <pointLight
          color={profile.fillColor}
          intensity={fillI}
          distance={profile.fillDistance * distMul}
          decay={decay}
          position={[
            profile.position[0] + profile.fillOffset[0],
            profile.position[1] + profile.fillOffset[1],
            profile.position[2] + profile.fillOffset[2],
          ]}
        />
      )}
      {profile.glowRadius > 0 && (
        <mesh position={profile.glowPosition}>
          <sphereGeometry args={[profile.glowRadius, 12, 12]} />
          <meshBasicMaterial
            color={profile.color}
            transparent
            opacity={profile.glowOpacity ?? glowOpacity}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
}
