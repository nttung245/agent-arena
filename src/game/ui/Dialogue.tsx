import type { LifeDecision, LifeFocus } from "@/game/engine/types";
import type { ScenePlan } from "@/game/scenes/types";

export function Dialogue({
  plan,
  decision,
  focus,
  busy = false,
  onChoose,
  onFocus,
  onContinue,
}: {
  plan: ScenePlan;
  decision: LifeDecision | null;
  focus?: LifeFocus | null;
  busy?: boolean;
  onChoose: (key: string) => void;
  onFocus?: (key: string) => void;
  onContinue?: () => void;
}) {
  const focusOptions = focus?.options ?? [];

  return (
    <div className="life-dialogue" aria-live="polite">
      {plan.dialogue.map((line, index) => (
        <div className="life-dialogue__line" key={`${line.speaker}-${index}`}>
          <span className="life-dialogue__speaker">{line.speaker}</span>
          <span>{line.text}</span>
        </div>
      ))}

      <div className="life-dialogue__choices">
        {decision
          ? decision.choices.map((choice) => (
              <button
                key={choice.key}
                type="button"
                className="life-choice"
                disabled={busy}
                onClick={() => onChoose(choice.key)}
              >
                {choice.label}
              </button>
            ))
          : focusOptions.length > 0
            ? focusOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className="life-choice"
                  disabled={busy}
                  onClick={() => onFocus?.(option.key)}
                >
                  {option.label}
                </button>
              ))
            : (
                <button
                  type="button"
                  className="life-choice"
                  disabled={busy}
                  onClick={() => onContinue?.()}
                >
                  Continue
                </button>
              )}
      </div>
    </div>
  );
}
