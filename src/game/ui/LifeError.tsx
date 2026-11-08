import type { LifeEngineError } from "@/game/engine/types";

const MESSAGES: Record<string, string> = {
  token: "This saved life can't be read by this version of the game. Begin a new life.",
  invalid_choice: "That choice no longer fits this moment. Try again.",
  invalid_focus: "That focus isn't available. Try again.",
  legacy:
    "This life began on the 1in8b Engine, which this version of the game no longer uses, so it can't go on. You can keep what was lived as an unfinished memorial, or let it go.",
};

export function LifeError({
  error,
  onRetry,
  onKeep,
  onDiscard,
  onExit,
}: {
  error: LifeEngineError;
  onRetry: () => void;
  /** For a life the engine can't continue: keep it as an unfinished memorial. */
  onKeep: () => void;
  /** For a life the engine can't continue: let it go. */
  onDiscard: () => void;
  onExit: () => void;
}) {
  const legacy = error.code === "legacy";
  const message = MESSAGES[error.code] ?? `${error.message} (${error.code})`;

  return (
    <div className="life-overlay" role="alert">
      <div className="life-panel life-error">
        <h2>The world paused</h2>
        <p>{message}</p>
        {error.message && error.message !== message && !legacy && (
          <p className="life-panel__muted">{error.message}</p>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {legacy ? (
            <>
              <button type="button" className="life-button life-button--primary" onClick={onKeep}>
                Keep it as a memorial
              </button>
              <button type="button" className="life-button" onClick={onDiscard}>
                Let it go
              </button>
            </>
          ) : (
            <>
              <button type="button" className="life-button life-button--primary" onClick={onRetry}>
                Try again
              </button>
              <button type="button" className="life-button" onClick={onExit}>
                Leave this life
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
