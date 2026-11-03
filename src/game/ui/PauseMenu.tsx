export function PauseMenu({
  onResume,
  onJournal,
  onExit,
}: {
  onResume: () => void;
  onJournal: () => void;
  onExit: () => void;
}) {
  return (
    <div className="life-overlay" role="dialog" aria-modal="true">
      <div className="life-panel">
        <h2>Paused</h2>
        <p className="life-panel__muted">
          The life is saved in this browser. You can leave and come back.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            type="button"
            className="life-button life-button--primary"
            onClick={onResume}
          >
            Resume
          </button>
          <button type="button" className="life-button" onClick={onJournal}>
            Open journal
          </button>
          <button type="button" className="life-button" onClick={onExit}>
            Leave this life
          </button>
        </div>
      </div>
    </div>
  );
}
