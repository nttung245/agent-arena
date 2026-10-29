import { useEffect, useMemo, useRef } from "react";
import { useProgress } from "@react-three/drei";
import { NameGate } from "@/components/NameGate";
import { Hud } from "@/components/Hud";
import { ArenaSidePanels } from "@/components/ArenaSidePanels";
import { ChatPanel } from "@/components/ChatPanel";
import { FloatingChatLog } from "@/components/FloatingChatLog";
import { AgentChatterLoop } from "@/components/AgentChatterLoop";
import { SettingsModal } from "@/components/SettingsModal";
import { MapEditor } from "@/components/MapEditor";
import { ArenaScene } from "@/components/scene/ArenaScene";
import { useArenaStore } from "@/store/arenaStore";
import { appConfig } from "@/lib/config";
import { embed, worldModelUrls } from "@/lib/embed";

/** Tells the embedding page once the world's models have loaded, so it can show the world. */
function EmbedReadySignal() {
  const { active, loaded, total } = useProgress();
  const activeMap = useArenaStore((s) => s.activeMap);
  const agents = useArenaStore((s) => s.agents);
  // Every character look is preloaded at startup, so loading can go idle before the map's
  // models start: wait until at least this world's files have been counted, then settle.
  const expected = useMemo(
    () =>
      activeMap
        ? worldModelUrls(
            activeMap.placeables.map((p) => p.placeableId),
            agents.map((a) => a.characterId),
          ).size
        : 0,
    [activeMap, agents],
  );
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current || expected === 0 || active || total < expected || loaded < total) return;
    const timer = window.setTimeout(() => {
      sent.current = true;
      window.parent.postMessage({ type: "agent-arena:ready" }, "*");
    }, 500);
    return () => window.clearTimeout(timer);
  }, [active, loaded, total, expected]);

  return null;
}

export default function App() {
  const hydrate = useArenaStore((s) => s.hydrate);
  const userName = useArenaStore((s) => s.userName);
  const toast = useArenaStore((s) => s.toast);
  const mapEditorOpen = useArenaStore((s) => s.mapEditorOpen);
  const dayNight = useArenaStore((s) => s.dayNight);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    document.documentElement.dataset.dayNight = dayNight;
  }, [dayNight]);

  // Smooth day/night blend even when the arena Canvas is dormant (map editor open).
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = useArenaStore.getState();
      const target = s.dayNight === "night" ? 1 : 0;
      if (Math.abs(s.dayNightBlend - target) > 0.001) {
        const dir = target > s.dayNightBlend ? 1 : -1;
        let next = s.dayNightBlend + dir * appConfig.ui.dayNightBlendSpeed * dt;
        next = Math.min(1, Math.max(0, next));
        if (Math.abs(next - target) < 0.01) next = target;
        useArenaStore.setState({ dayNightBlend: next });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ?embed&time=cycle alternates day and night on a timer.
  useEffect(() => {
    if (embed?.time !== "cycle") return;
    const id = window.setInterval(
      () => useArenaStore.getState().toggleDayNight(),
      appConfig.embed.cycleSeconds * 1000,
    );
    return () => window.clearInterval(id);
  }, []);

  if (embed) {
    return (
      <div className="app" data-day-night={dayNight}>
        <div className="arena-layer">
          <ArenaScene embedded />
        </div>
        <EmbedReadySignal />
      </div>
    );
  }

  if (!userName) {
    return <NameGate />;
  }

  return (
    <div className="app" data-day-night={dayNight}>
      {/* Keep the arena WebGL context alive while the map editor is open —
          remounting the Canvas each time caused "Context Lost" warnings. */}
      <div
        className={
          "arena-layer" + (mapEditorOpen ? " arena-layer--dormant" : "")
        }
        aria-hidden={mapEditorOpen}
      >
        <ArenaScene dormant={mapEditorOpen} />
      </div>
      {!mapEditorOpen && (
        <>
          <Hud />
          <ArenaSidePanels />
          <ChatPanel />
          <FloatingChatLog />
          <AgentChatterLoop />
          <SettingsModal />
        </>
      )}
      <MapEditor />
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
