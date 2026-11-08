import { useState } from "react";
import type { LifeEngineError } from "@/game/engine/types";

const MESSAGES: Record<string, string> = {
  key: "The 1in8b key was rejected. Paste a valid key to continue this life.",
  month:
    "This key has used its monthly life units. It resets at the start of the next month.",
  rate: "Too many calls. Wait a minute, then try again.",
  free_day:
    "The free engine has used its life units for today. Try again tomorrow.",
  network: "The connection failed. Check your network and try again.",
  not_in_world: "The engine could not draw this life. Try again.",
  token: "This life’s token has expired. Begin a new life.",
  live_state: "The life state did not fit this step. Try again.",
};

export function LifeError({
  error,
  onRetry,
  onNewKey,
  onExit,
}: {
  error: LifeEngineError;
  onRetry: () => void;
  onNewKey: (key: string) => void;
  onExit: () => void;
}) {
  const [key, setKey] = useState("");
  const needsKey = error.code === "key";
  const message = MESSAGES[error.code] ?? `${error.message} (${error.code})`;

  return (
    <div className="life-overlay" role="alert">
      <div className="life-panel life-error">
        <h2>The world paused</h2>
        <p>{message}</p>
        {error.message && error.message !== message && (
          <p className="life-panel__muted">{error.message}</p>
        )}

        {needsKey && (
          <div className="life-field">
            <label htmlFor="life-new-key">Paste a new 1in8b key</label>
            <input
              id="life-new-key"
              type="password"
              value={key}
              autoComplete="off"
              spellCheck={false}
              placeholder="k8b_…"
              onChange={(event) => setKey(event.target.value)}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {needsKey ? (
            <button
              type="button"
              className="life-button life-button--primary"
              disabled={!key.trim()}
              onClick={() => onNewKey(key.trim())}
            >
              Use this key
            </button>
          ) : (
            <button
              type="button"
              className="life-button life-button--primary"
              onClick={onRetry}
            >
              Try again
            </button>
          )}
          <button type="button" className="life-button" onClick={onExit}>
            Leave this life
          </button>
        </div>
      </div>
    </div>
  );
}
