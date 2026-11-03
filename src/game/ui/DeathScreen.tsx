import { useEffect, useRef } from "react";
import type { LifeReview } from "@/game/engine/review";
import type { LifeRun } from "@/game/state/lifeRun";
import { completeRun } from "@/game/state/lifeRun";
import { saveCompletedLife } from "@/game/state/persistence";

function years(review: LifeReview): string {
  if (review.bornYear != null && review.diedYear != null) {
    return `${review.bornYear} – ${review.diedYear}`;
  }
  return review.ageAtDeath != null ? `Age ${review.ageAtDeath}` : "";
}

export function DeathScreen({
  review,
  run,
  sceneTitles = [],
  onContinue,
}: {
  review: LifeReview;
  run?: LifeRun;
  sceneTitles?: string[];
  onContinue: () => void;
}) {
  const saved = useRef(false);

  useEffect(() => {
    if (saved.current || !run) return;
    saved.current = true;
    saveCompletedLife(completeRun(run, sceneTitles));
  }, [run, sceneTitles]);

  return (
    <div className="life-start">
      <div className="life-start__card life-death">
        <h1 className="life-start__title">{review.name}</h1>
        <p className="life-death__years">{years(review)}</p>
        <p>
          The room is quiet. The life has reached its end.
          {review.cause ? ` Cause of death: ${review.cause}.` : ""}
        </p>
        <p className="life-panel__muted">
          No scene is shown. What remains is the life you lived.
        </p>
        <button
          type="button"
          className="life-button life-button--primary"
          onClick={onContinue}
        >
          Look back on this life
        </button>
      </div>
    </div>
  );
}
