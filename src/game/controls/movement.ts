export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface MoveInput {
  forward: number;
  strafe: number;
  yaw: number;
  speed: number;
  dt: number;
}

/** Shared touch input written by the DOM joystick and read by the camera. */
export interface TouchState {
  forward: number;
  strafe: number;
  lookX: number;
  lookY: number;
}

export function nextPosition(
  current: [number, number],
  input: MoveInput,
): [number, number] {
  let forward = input.forward;
  let strafe = input.strafe;
  const length = Math.hypot(forward, strafe);
  if (length > 1) {
    forward /= length;
    strafe /= length;
  }

  const sin = Math.sin(input.yaw);
  const cos = Math.cos(input.yaw);
  // At yaw 0, forward is -Z and strafe is +X.
  const dx = strafe * cos + forward * sin;
  const dz = -forward * cos + strafe * sin;
  return [
    current[0] + dx * input.speed * input.dt,
    current[1] + dz * input.speed * input.dt,
  ];
}

export function clampToBounds(x: number, z: number, bounds: Bounds): [number, number] {
  return [
    Math.min(bounds.maxX, Math.max(bounds.minX, x)),
    Math.min(bounds.maxZ, Math.max(bounds.minZ, z)),
  ];
}

export function nearestInteractable(
  position: [number, number],
  interactables: Array<{
    id: string;
    position: [number, number];
    radius: number;
  }>,
): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const item of interactables) {
    const distance = Math.hypot(
      item.position[0] - position[0],
      item.position[1] - position[1],
    );
    if (distance <= item.radius && distance < bestDistance) {
      best = item.id;
      bestDistance = distance;
    }
  }
  return best;
}
