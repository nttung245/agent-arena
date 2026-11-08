import { useEffect, useMemo, useRef, useState } from "react";
import "@/game/life.css";
import { buildReview } from "@/game/engine/review";
import { summarizeYears } from "@/game/engine/summary";
import { getSceneTemplate } from "@/game/scenes/registry";
import { LifeScene } from "@/game/scenes/LifeScene";
import { useLifeStore } from "@/game/state/lifeStore";
import { loadRun } from "@/game/state/persistence";
import type { JournalEntry, LifeConfig } from "@/game/state/lifeRun";
import { BirthCard } from "@/game/ui/BirthCard";
import { DeathScreen } from "@/game/ui/DeathScreen";
import { Dialogue } from "@/game/ui/Dialogue";
import { Journal } from "@/game/ui/Journal";
import { LifeError } from "@/game/ui/LifeError";
import { LifeHud } from "@/game/ui/LifeHud";
import { Memorial } from "@/game/ui/Memorial";
import { PauseMenu } from "@/game/ui/PauseMenu";
import { Reflection } from "@/game/ui/Reflection";
import { Spending } from "@/game/ui/Spending";
import { StartScreen } from "@/game/ui/StartScreen";
import { Summary } from "@/game/ui/Summary";

function ExitButton({ onExit }: { onExit: () => void }) {
  return (
    <button type="button" className="life-exit" onClick={onExit}>
      Back to arena
    </button>
  );
}

function ResumeCard({
  onResume,
  onNew,
}: {
  onResume: () => void;
  onNew: () => void;
}) {
  return (
    <div className="life-start">
      <div className="life-start__card">
        <h1 className="life-start__title">A life is waiting</h1>
        <p className="life-start__sub">
          You closed the page in the middle of a life. Resume it, or begin a new
          one.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="life-button life-button--primary"
            onClick={onResume}
          >
            Resume life
          </button>
          <button type="button" className="life-button" onClick={onNew}>
            Start a new life
          </button>
        </div>
      </div>
    </div>
  );
}

export function LifeGame({ onExit }: { onExit: () => void }) {
  const run = useLifeStore((state) => state.run);
  const scene = useLifeStore((state) => state.scene);
  const error = useLifeStore((state) => state.error);
  const busy = useLifeStore((state) => state.busy);
  const start = useLifeStore((state) => state.start);
  const choose = useLifeStore((state) => state.choose);
  const focus = useLifeStore((state) => state.focus);
  const buy = useLifeStore((state) => state.buy);
  const continueScene = useLifeStore((state) => state.continueScene);
  const reflect = useLifeStore((state) => state.reflect);
  const resume = useLifeStore((state) => state.resume);
  const reset = useLifeStore((state) => state.reset);
  const keepLegacy = useLifeStore((state) => state.keepLegacy);

  const [birthSeen, setBirthSeen] = useState(false);
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [deathSceneSeen, setDeathSceneSeen] = useState(false);
  const [summary, setSummary] = useState<JournalEntry[] | null>(null);
  const [sceneTitles, setSceneTitles] = useState<string[]>([]);
  const [spendingSeen, setSpendingSeen] = useState<string | null>(null);
  const [skippedReflection, setSkippedReflection] = useState<number | null>(null);
  const lastSceneKey = useRef<string | null>(null);
  const lastSceneAge = useRef<number | null>(null);

  useEffect(() => {
    if (loadRun()) setResumeAvailable(true);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setJournalOpen(false);
      setPaused(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!run || !scene) return;
    const key = `${scene.template}:${run.state.age}:${scene.title}`;
    if (lastSceneKey.current === key) return;
    lastSceneKey.current = key;
    setSceneTitles((previous) =>
      previous.includes(scene.title) ? previous : [...previous, scene.title],
    );
    if (lastSceneAge.current != null && run.state.age > lastSceneAge.current) {
      setSummary(summarizeYears(run, lastSceneAge.current, run.state.age));
    }
    lastSceneAge.current = run.state.age;
    setSpendingSeen(null);
  }, [run, scene]);

  const review = useMemo(
    () =>
      run
        ? buildReview(
            run,
            run.sceneTitles?.length ? run.sceneTitles : sceneTitles,
          )
        : null,
    [run, sceneTitles],
  );

  const beginNew = () => {
    reset();
    setBirthSeen(false);
    setResumeAvailable(false);
    setJournalOpen(false);
    setPaused(false);
    setReviewOpen(false);
    setDeathSceneSeen(false);
    setSummary(null);
    setSceneTitles([]);
    setSpendingSeen(null);
    setSkippedReflection(null);
    lastSceneKey.current = null;
    lastSceneAge.current = null;
  };

  const handleStart = (config: LifeConfig) => {
    beginNew();
    void start(config);
  };

  if (!run) {
    if (resumeAvailable) {
      return (
        <div className="life-mode">
          <ExitButton onExit={onExit} />
          <ResumeCard
            onResume={() => {
              setResumeAvailable(false);
              setBirthSeen(true);
              void resume();
            }}
            onNew={beginNew}
          />
        </div>
      );
    }
    return (
      <div className="life-mode">
        <ExitButton onExit={onExit} />
        <StartScreen onStart={handleStart} busy={busy} error={error?.message ?? null} />
      </div>
    );
  }

  if (!birthSeen) {
    return (
      <div className="life-mode">
        <ExitButton onExit={onExit} />
        <BirthCard run={run} onContinue={() => setBirthSeen(true)} />
      </div>
    );
  }

  if (run.ended || run.phase === "death") {
    const endedTitles = run.sceneTitles?.length
      ? run.sceneTitles
      : sceneTitles;
    const endedTemplate = scene ? getSceneTemplate(scene.template) : null;

    if (scene && endedTemplate && !deathSceneSeen) {
      return (
        <div className="life-mode">
          <LifeScene
            template={endedTemplate}
            plan={scene}
            onInteract={() => setDeathSceneSeen(true)}
          />
          <Dialogue
            plan={scene}
            decision={null}
            busy={false}
            onChoose={() => undefined}
            onContinue={() => setDeathSceneSeen(true)}
          />
          {journalOpen && (
            <Journal run={run} onClose={() => setJournalOpen(false)} />
          )}
        </div>
      );
    }

    if (!review || !reviewOpen) {
      return (
        <div className="life-mode">
          <ExitButton onExit={onExit} />
          <DeathScreen
            review={review ?? buildReview(run, endedTitles)}
            run={run}
            sceneTitles={endedTitles}
            onJournal={() => setJournalOpen(true)}
            onContinue={() => setReviewOpen(true)}
          />
          {journalOpen && (
            <Journal run={run} onClose={() => setJournalOpen(false)} />
          )}
        </div>
      );
    }
    return (
      <div className="life-mode">
        <Memorial
          review={review}
          onAnother={beginNew}
          onClose={onExit}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="life-mode">
        <ExitButton onExit={onExit} />
        <LifeError
          error={error}
          onRetry={() => void resume()}
          onKeep={() => {
            keepLegacy();
            beginNew();
          }}
          onDiscard={beginNew}
          onExit={onExit}
        />
      </div>
    );
  }

  if (!scene) {
    return (
      <div className="life-mode">
        <ExitButton onExit={onExit} />
        <StartScreen onStart={handleStart} busy={busy} error="The life is between scenes." />
      </div>
    );
  }

  const template = getSceneTemplate(scene.template);
  const sceneKey = `${scene.template}:${run.state.age}:${scene.title}`;
  const reflectionAge =
    scene.triggerKind === "reflection" &&
    run.thoughts[run.state.age] == null &&
    skippedReflection !== run.state.age
      ? run.state.age
      : null;

  const interact = (id: string) => {
    const item = scene.interactables.find((entry) => entry.id === id);
    if (!item) return;
    if (item.choiceKey) {
      void choose(item.choiceKey);
    } else if (item.focusKey) {
      void focus(item.focusKey);
    } else {
      void continueScene();
    }
  };

  if (summary) {
    return (
      <div className="life-mode">
        <Summary
          entries={summary}
          onContinue={() => setSummary(null)}
        />
      </div>
    );
  }

  if (reflectionAge != null) {
    return (
      <div className="life-mode">
        <Reflection
          age={reflectionAge}
          onSave={(text) => {
            reflect(reflectionAge, text);
            setSkippedReflection(null);
            void continueScene();
          }}
          onSkip={() => {
            setSkippedReflection(reflectionAge);
            void continueScene();
          }}
        />
      </div>
    );
  }

  if (run.sheet.length > 0 && spendingSeen !== sceneKey) {
    return (
      <div className="life-mode">
        <Spending
          sheet={run.sheet}
          onBuy={(ids) => {
            setSpendingSeen(sceneKey);
            void buy(ids);
          }}
          onSkip={() => {
            setSpendingSeen(sceneKey);
            void continueScene();
          }}
        />
      </div>
    );
  }

  return (
    <div className="life-mode">
      <LifeScene template={template} plan={scene} onInteract={interact} />
      <LifeHud
        age={run.state.age}
        year={run.state.year}
        title={scene.title}
        onJournal={() => setJournalOpen(true)}
        onPause={() => setPaused(true)}
      />
      <Dialogue
        plan={scene}
        decision={run.decision}
        focus={run.focus}
        busy={busy}
        onChoose={(key) => void choose(key)}
        onFocus={(key) => void focus(key)}
        onContinue={() => void continueScene()}
      />
      {journalOpen && (
        <Journal run={run} onClose={() => setJournalOpen(false)} />
      )}
      {paused && (
        <PauseMenu
          onResume={() => setPaused(false)}
          onJournal={() => {
            setPaused(false);
            setJournalOpen(true);
          }}
          onExit={onExit}
        />
      )}
      {error && (
        <LifeError
          error={error}
          onRetry={() => void resume()}
          onKeep={() => {
            keepLegacy();
            beginNew();
          }}
          onDiscard={beginNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
