import { useRef, type MutableRefObject, type PointerEvent } from "react";
import type { TouchState } from "@/game/controls/movement";

const STICK_RANGE = 44;

export function TouchControls({
  state,
}: {
  state: MutableRefObject<TouchState>;
}) {
  const stick = useRef<{ x: number; y: number; id: number | null }>({
    x: 0,
    y: 0,
    id: null,
  });
  const look = useRef<{ x: number; y: number; id: number | null }>({
    x: 0,
    y: 0,
    id: null,
  });

  const startStick = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    stick.current = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
    };
    state.current.forward = 0;
    state.current.strafe = 0;
  };

  const moveStick = (event: PointerEvent<HTMLDivElement>) => {
    if (stick.current.id !== event.pointerId) return;
    const dx = event.clientX - stick.current.x;
    const dy = event.clientY - stick.current.y;
    state.current.strafe = Math.max(-1, Math.min(1, dx / STICK_RANGE));
    state.current.forward = Math.max(-1, Math.min(1, -dy / STICK_RANGE));
  };

  const endStick = (event: PointerEvent<HTMLDivElement>) => {
    if (stick.current.id !== event.pointerId) return;
    stick.current.id = null;
    state.current.forward = 0;
    state.current.strafe = 0;
  };

  const startLook = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    look.current = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
    };
  };

  const moveLook = (event: PointerEvent<HTMLDivElement>) => {
    if (look.current.id !== event.pointerId) return;
    state.current.lookX += event.clientX - look.current.x;
    state.current.lookY += event.clientY - look.current.y;
    look.current.x = event.clientX;
    look.current.y = event.clientY;
  };

  const endLook = (event: PointerEvent<HTMLDivElement>) => {
    if (look.current.id !== event.pointerId) return;
    look.current.id = null;
  };

  return (
    <div className="life-touch" aria-hidden>
      <div
        className="life-touch__stick"
        onPointerDown={startStick}
        onPointerMove={moveStick}
        onPointerUp={endStick}
        onPointerCancel={endStick}
      />
      <div
        className="life-touch__look"
        onPointerDown={startLook}
        onPointerMove={moveLook}
        onPointerUp={endLook}
        onPointerCancel={endLook}
      />
    </div>
  );
}
