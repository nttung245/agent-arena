import type { JournalEntry } from "@/game/state/lifeRun";

export function Summary({
  entries,
  fromAge,
  toAge,
  onContinue,
}: {
  entries: JournalEntry[];
  fromAge?: number;
  toAge?: number;
  onContinue: () => void;
}) {
  return (
    <div className="life-overlay" role="dialog" aria-modal="true">
      <div className="life-panel life-summary">
        <h2>Years pass</h2>
        <p className="life-panel__muted">
          {fromAge != null && toAge != null
            ? `Age ${fromAge} to ${toAge}. The quiet years are kept here.`
            : "The quiet years are kept here."}
        </p>
        {entries.length === 0 ? (
          <p className="life-panel__muted">Nothing was written down.</p>
        ) : (
          entries.map((entry) => (
            <div className="life-journal__entry" key={entry.id}>
              <span className="life-journal__age">Age {entry.age}</span>
              {entry.text}
              {entry.source && (
                <div className="life-journal__source">{entry.source}</div>
              )}
            </div>
          ))
        )}
        <div style={{ marginTop: 18 }}>
          <button
            type="button"
            className="life-button life-button--primary"
            onClick={onContinue}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
