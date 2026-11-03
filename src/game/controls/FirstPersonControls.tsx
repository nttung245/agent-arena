import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type MutableRefObject } from "react";
import {
  clampToBounds,
  nearestInteractable,
  nextPosition,
  type Bounds,
  type TouchState,
} from "@/game/controls/movement";

export interface FirstPersonControlsProps {
  start: { position: [number, number, number]; yaw: number };
  bounds: Bounds;
  cameraHeight: number;
  enabled: boolean;
  onInteract: (id: string) => void;
  interactables: Array<{
    id: string;
    position: [number, number];
    radius: number;
  }>;
  touchState?: MutableRefObject<TouchState>;
}

const MOVE_SPEED = 2.2;
const LOOK_SPEED = 0.0024;
const PITCH_LIMIT = Math.PI / 2 - 0.1;

export function FirstPersonControls({
  start,
  bounds,
  cameraHeight,
  enabled,
  onInteract,
  interactables,
  touchState,
}: FirstPersonControlsProps) {
  const { camera, gl } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const yaw = useRef(start.yaw);
  const pitch = useRef(0);

  useEffect(() => {
    camera.position.set(start.position[0], cameraHeight, start.position[2]);
    camera.rotation.order = "YXZ";
    camera.rotation.y = start.yaw;
    camera.rotation.x = 0;
  }, [camera, cameraHeight, start]);

  useEffect(() => {
    const element = gl.domElement;

    const requestLock = () => {
      if (enabled) void element.requestPointerLock?.();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      keys.current[event.code] = true;
      if (event.code === "KeyE") {
        const id = nearestInteractable(
          [camera.position.x, camera.position.z],
          interactables,
        );
        if (id) onInteract(id);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keys.current[event.code] = false;
    };
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== element) return;
      yaw.current -= event.movementX * LOOK_SPEED;
      pitch.current = Math.max(
        -PITCH_LIMIT,
        Math.min(PITCH_LIMIT, pitch.current - event.movementY * LOOK_SPEED),
      );
      camera.rotation.y = yaw.current;
      camera.rotation.x = pitch.current;
    };

    element.addEventListener("click", requestLock);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    return () => {
      element.removeEventListener("click", requestLock);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [camera, enabled, gl, interactables, onInteract]);

  useFrame((_, delta) => {
    if (!enabled) return;
    const touch = touchState?.current;
    if (touch && (touch.lookX !== 0 || touch.lookY !== 0)) {
      yaw.current -= touch.lookX * LOOK_SPEED;
      pitch.current = Math.max(
        -PITCH_LIMIT,
        Math.min(PITCH_LIMIT, pitch.current - touch.lookY * LOOK_SPEED),
      );
      camera.rotation.y = yaw.current;
      camera.rotation.x = pitch.current;
      touch.lookX = 0;
      touch.lookY = 0;
    }
    const forward =
      (keys.current.KeyW || keys.current.ArrowUp ? 1 : 0) -
      (keys.current.KeyS || keys.current.ArrowDown ? 1 : 0) +
      (touch?.forward ?? 0);
    const strafe =
      (keys.current.KeyD || keys.current.ArrowRight ? 1 : 0) -
      (keys.current.KeyA || keys.current.ArrowLeft ? 1 : 0) +
      (touch?.strafe ?? 0);
    const [x, z] = nextPosition(
      [camera.position.x, camera.position.z],
      {
        forward,
        strafe,
        yaw: yaw.current,
        speed: MOVE_SPEED,
        dt: Math.min(delta, 0.05),
      },
    );
    const [clampedX, clampedZ] = clampToBounds(x, z, bounds);
    camera.position.x = clampedX;
    camera.position.z = clampedZ;
    camera.position.y = cameraHeight;
  });

  return null;
}
