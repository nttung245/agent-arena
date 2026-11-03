import type { LifeReview } from "@/game/engine/review";

function years(review: LifeReview): string {
  if (review.bornYear != null && review.diedYear != null) {
    return `${review.bornYear} – ${review.diedYear}`;
  }
  return review.ageAtDeath != null ? `Age ${review.ageAtDeath}` : "";
}

export function Memorial({
  review,
  onAnother,
  onClose,
}: {
  review: LifeReview;
  onAnother: () => void;
  onClose: () => void;
}) {
  return (
    <div className="life-start">
      <div className="life-start__card life-memorial">
        <h1 className="life-start__title">{review.name}</h1>
        <p className="life-death__years">{years(review)}</p>
        <p className="life-panel__muted">
          A simulated life, kept here. Not a real person.
        </p>

        {review.scenes.length > 0 && (
          <>
            <h3>Scenes</h3>
            {review.scenes.map((scene, index) => (
              <div className="life-memorial__life" key={`${scene}-${index}`}>
                {scene}
              </div>
            ))}
          </>
        )}

        <h3>From the record</h3>
        {review.keyEntries.map((entry) => (
          <div className="life-memorial__life" key={entry.id}>
            <span className="life-journal__age">Age {entry.age}</span>
            {entry.text}
          </div>
        ))}

        {review.thoughts.length > 0 && (
          <>
            <h3>Thoughts</h3>
            {review.thoughts.map((thought) => (
              <div className="life-memorial__life" key={thought.age}>
                <span className="life-journal__age">Age {thought.age}</span>
                <span className="life-memorial__thought">{thought.text}</span>
              </div>
            ))}
          </>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button
            type="button"
            className="life-button life-button--primary"
            onClick={onAnother}
          >
            Live another life
          </button>
          <button type="button" className="life-button" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="life-credit">
          Life simulated by the{" "}
          <a href="https://1in8b.life/en/api/" target="_blank" rel="noreferrer">
            1in8b Engine (1in8b.life)
          </a>
          . Simulated life, not a real person.
        </p>
      </div>
    </div>
  );
}
