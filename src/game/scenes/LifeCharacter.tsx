import { Html, useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { getCharacter } from "@/lib/assets/characters";
import { pickClipName } from "@/lib/assets/catalog";
import {
  fitGlbToHeight,
  prepareCharacterMeshes,
} from "@/lib/three/glbFit";
import {
  applyCharacterProportions,
  scaleHeadAnimationTracks,
} from "@/lib/three/characterRig";
import type { SceneCastMember, SceneSocket } from "@/game/scenes/types";

export function ageScale(age: number): number {
  if (age < 3) return 0.55;
  if (age < 12) return 0.72;
  if (age < 18) return 0.88;
  if (age > 70) return 0.95;
  return 1;
}

function GlbCharacter({
  member,
  socket,
  onPick,
}: {
  member: SceneCastMember;
  socket: SceneSocket;
  onPick?: (member: SceneCastMember) => void;
}) {
  const spec = getCharacter(member.characterId);
  const headScale = spec.headScale ?? 1;
  const group = useRef<THREE.Group>(null);
  const { scene, animations: rawClips } = useGLTF(spec.glb) as {
    scene: THREE.Object3D;
    animations: THREE.AnimationClip[];
  };

  const animations = useMemo(() => {
    const clips = rawClips
      .filter((clip) => /idle|walk/i.test(clip.name))
      .map((clip) => clip.clone());
    scaleHeadAnimationTracks(clips, headScale);
    return clips;
  }, [rawClips, headScale]);

  const { clone, scale, offset, height } = useMemo(() => {
    const c = cloneSkinned(scene);
    prepareCharacterMeshes(c);
    const fit = fitGlbToHeight(c, spec.targetHeight * ageScale(member.age));
    applyCharacterProportions(c, headScale);
    return {
      clone: c,
      scale: fit.scale,
      offset: fit.offset,
      height: fit.height,
    };
  }, [scene, spec.targetHeight, headScale, member.age]);

  const { actions, names, mixer } = useAnimations(animations, clone);
  const idleName = useMemo(
    () => pickClipName(names, spec.idleClipHints) ?? names[0],
    [names, spec.idleClipHints],
  );

  useEffect(() => {
    if (!idleName) return;
    const action = actions[idleName];
    if (!action) return;
    action.reset().fadeIn(0.2).play();
    return () => {
      action.fadeOut(0.1);
    };
  }, [actions, idleName]);

  useEffect(() => {
    const original = mixer.update.bind(mixer);
    mixer.update = (dt: number) => {
      original(dt);
      applyCharacterProportions(clone, headScale);
      return mixer;
    };
    applyCharacterProportions(clone, headScale);
    return () => {
      mixer.update = original;
    };
  }, [mixer, clone, headScale]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.position.y =
      Math.sin(clock.elapsedTime * 1.6 + member.age) * 0.008;
  });

  const yawOffset = spec.faces === "negZ" ? Math.PI : 0;
  const line = member.lines[0];

  return (
    <group
      position={socket.position}
      rotation-y={socket.rotationY}
      onClick={(event) => {
        event.stopPropagation();
        onPick?.(member);
      }}
    >
      <group ref={group}>
        <group rotation={[0, yawOffset, 0]}>
          <group position={offset} scale={scale}>
            <primitive object={clone} />
          </group>
        </group>
      </group>
      <Html
        position={[0, height + 0.24, 0]}
        center
        zIndexRange={[40, 10]}
        style={{ pointerEvents: "none" }}
        className="life-html-overlay"
      >
        <div className="life-name">{member.name}</div>
      </Html>
      {line && (
        <Html
          position={[0, height + 0.55, 0]}
          center
          zIndexRange={[40, 10]}
          style={{ pointerEvents: "none" }}
          className="life-html-overlay"
        >
          <div className="life-speech">{line}</div>
        </Html>
      )}
    </group>
  );
}

function StandIn({
  member,
  socket,
}: {
  member: SceneCastMember;
  socket: SceneSocket;
}) {
  const spec = getCharacter(member.characterId);
  const height = spec.targetHeight * ageScale(member.age);
  return (
    <group
      position={socket.position}
      rotation-y={socket.rotationY}
    >
      <mesh position={[0, height * 0.45, 0]} castShadow>
        <capsuleGeometry args={[spec.radius * 0.85, height * 0.55, 5, 10]} />
        <meshStandardMaterial color="#b9a78f" roughness={0.8} />
      </mesh>
      <Html
        position={[0, height + 0.24, 0]}
        center
        zIndexRange={[40, 10]}
        style={{ pointerEvents: "none" }}
      >
        <div className="life-name">{member.name}</div>
      </Html>
    </group>
  );
}

export function LifeCharacter({
  member,
  socket,
  onPick,
}: {
  member: SceneCastMember;
  socket: SceneSocket;
  onPick?: (member: SceneCastMember) => void;
}) {
  return (
    <Suspense fallback={<StandIn member={member} socket={socket} />}>
      <GlbCharacter member={member} socket={socket} onPick={onPick} />
    </Suspense>
  );
}
