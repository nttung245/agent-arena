import { Canvas } from "@react-three/fiber";
import { Suspense, useRef } from "react";
import { ArenaFloor } from "@/components/scene/OfficeFloor";
import { FirstPersonControls } from "@/game/controls/FirstPersonControls";
import { TouchControls } from "@/game/controls/TouchControls";
import type { TouchState } from "@/game/controls/movement";
import { buildSceneMap } from "@/game/scenes/registry";
import { LifeCharacter } from "@/game/scenes/LifeCharacter";
import { LifeProps } from "@/game/scenes/LifeProps";
import { SceneLighting } from "@/game/scenes/SceneLighting";
import type { ScenePlan, SceneTemplate } from "@/game/scenes/types";

function LoadingBlock() {
  return (
    <mesh position={[0, 0.5, 0]}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="#b9a78f" />
    </mesh>
  );
}

export function LifeScene({
  template,
  plan,
  onInteract,
}: {
  template: SceneTemplate;
  plan: ScenePlan;
  onInteract: (id: string) => void;
}) {
  const map = buildSceneMap(template, []);
  const touchState = useRef<TouchState>({
    forward: 0,
    strafe: 0,
    lookX: 0,
    lookY: 0,
  });
  const startSocket = template.sockets[plan.player.socket];
  const start = startSocket ?? {
    position: [0, 0, 0] as [number, number, number],
    rotationY: 0,
  };

  const cast = plan.cast.flatMap((member) => {
    const socket = template.sockets[member.socket];
    return socket ? [{ member, socket }] : [];
  });

  const interactables = plan.interactables.flatMap((item) => {
    const socket = template.sockets[item.socket];
    return socket
      ? [
          {
            id: item.id,
            position: [socket.position[0], socket.position[2]] as [
              number,
              number,
            ],
            radius: 1.4,
          },
        ]
      : [];
  });

  const pickCast = (member: (typeof plan.cast)[number]) => {
    const talk = plan.interactables.find(
      (item) => item.socket === member.socket && item.kind === "talk",
    );
    if (talk) onInteract(talk.id);
  };

  return (
    <div className="life-canvas" role="application" aria-label="3D life scene">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ fov: 60, near: 0.05, far: 100 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={[map.theme.background]} />
        <fog attach="fog" args={[map.theme.fog, 18, 75]} />
        <SceneLighting theme={map.theme} floorSize={map.floor.size} />
        <Suspense fallback={<LoadingBlock />}>
          <ArenaFloor floor={map.floor} />
          <LifeProps map={map} />
          {cast.map(({ member, socket }) => (
            <LifeCharacter
              key={`${member.role}:${member.name}:${member.socket}`}
              member={member}
              socket={socket}
              onPick={pickCast}
            />
          ))}
        </Suspense>
        <FirstPersonControls
          start={{ position: start.position, yaw: start.rotationY }}
          bounds={template.bounds}
          cameraHeight={plan.player.cameraHeight}
          enabled
          onInteract={onInteract}
          interactables={interactables}
          touchState={touchState}
        />
      </Canvas>
      <TouchControls state={touchState} />
    </div>
  );
}
