import { useState } from "react";

const PROMPTS: Record<number, string> = {
  5: "What did you take for granted?",
  15: "What did you want to become?",
  30: "What are you carrying?",
  50: "What would you tell your younger self?",
  70: "What remains?",
};

export function Reflection({
  age,
  onSave,
  onSkip,
}: {
  age: number;
  onSave: (text: string) => void;
  onSkip: () => void;
}) {
  const [text, setText] = useState("");
  const prompt = PROMPTS[age] ?? "What do you remember?";

  return (
    <div className="life-overlay" role="dialog" aria-modal="true">
      <div className="life-panel life-reflection">
        <h2>Age {age}</h2>
        <p>{prompt}</p>
        <p className="life-panel__muted">
          A thought stays in this life’s record. Writing is optional.
        </p>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="e.g. Being taken to a doctor when I was ill"
        />
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button
            type="button"
            className="life-button life-button--primary"
            disabled={!text.trim()}
            onClick={() => onSave(text)}
          >
            Save thought
          </button>
          <button type="button" className="life-button" onClick={onSkip}>
            Keep it to myself
          </button>
        </div>
      </div>
    </div>
  );
}
