import { useEffect, useMemo, useRef, useState } from "react";
import "@/game/life.css";
import { isReflectionAge } from "@/game/engine/chapters";
import { readLifeKey, writeLifeKey } from "@/game/engine/oneIn8b";
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

  const [birthSeen, setBirthSeen] = useState(false);
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
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
    () => (run ? buildReview(run, sceneTitles) : null),
    [run, sceneTitles],
  );

  const beginNew = () => {
    reset();
    setBirthSeen(false);
    setResumeAvailable(false);
    setJournalOpen(false);
    setPaused(false);
    setReviewOpen(false);
    setSummary(null);
    setSceneTitles([]);
    setSpendingSeen(null);
    setSkippedReflection(null);
    lastSceneKey.current = null;
    lastSceneAge.current = null;
  };

  const handleStart = (config: LifeConfig, key: string) => {
    writeLifeKey(key);
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
        <StartScreen
          initialKey={readLifeKey() ?? ""}
          onStart={handleStart}
          busy={busy}
          error={error?.message ?? null}
        />
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
    if (!review || !reviewOpen) {
      return (
        <div className="life-mode">
          <ExitButton onExit={onExit} />
          <DeathScreen
            review={review ?? buildReview(run, sceneTitles)}
            run={run}
            sceneTitles={sceneTitles}
            onContinue={() => setReviewOpen(true)}
          />
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

  if (!scene) {
    return (
      <div className="life-mode">
        <ExitButton onExit={onExit} />
        <StartScreen
          initialKey={readLifeKey() ?? ""}
          onStart={handleStart}
          busy={busy}
          error={error?.message ?? "The life is between scenes."}
        />
      </div>
    );
  }

  const template = getSceneTemplate(scene.template);
  const sceneKey = `${scene.template}:${run.state.age}:${scene.title}`;
  const reflectionAge =
    isReflectionAge(run.state.age) &&
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
        <div className="life-overlay" role="alert">
          <div className="life-panel life-error">
            <h2>The world paused</h2>
            <p>{error.message}</p>
            <p className="life-panel__muted">Code: {error.code}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="life-button life-button--primary"
                onClick={() => void resume()}
              >
                Try again
              </button>
              <button type="button" className="life-button" onClick={onExit}>
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
