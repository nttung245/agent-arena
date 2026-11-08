import { journalSections } from "@/game/engine/summary";
import type { JournalEntry, LifeRun } from "@/game/state/lifeRun";
import { buildFactSheet } from "@/game/scenes/validate";
import { LifeCredit } from "@/game/ui/LifeCredit";

function numberOrDash(value: unknown): string {
  return typeof value === "number" ? String(Math.round(value)) : "—";
}

function textOrDash(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "—";
}

function EntryList({
  entries,
  empty,
}: {
  entries: JournalEntry[];
  empty: string;
}) {
  if (entries.length === 0) {
    return <p className="life-panel__muted">{empty}</p>;
  }
  return (
    <div>
      {[...entries].reverse().map((entry) => (
        <div className="life-journal__entry" key={entry.id}>
          <span className="life-journal__age">Age {entry.age}</span>
          {entry.text}
          {entry.source && (
            <div className="life-journal__source">{entry.source}</div>
          )}
        </div>
      ))}
    </div>
  );
}

export function Journal({
  run,
  onClose,
}: {
  run: LifeRun;
  onClose: () => void;
}) {
  const sections = journalSections(run);
  const facts = buildFactSheet(run.state);

  return (
    <div className="life-overlay" role="dialog" aria-modal="true">
      <div className="life-panel life-journal">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <h2>{textOrDash(run.state.name)}</h2>
          <button type="button" className="life-button" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="life-panel__muted">
          {typeof run.state.year === "number" ? `${run.state.year} · ` : ""}
          {textOrDash(run.state.country)} · Age{" "}
          {typeof run.state.age === "number" ? run.state.age : "—"} ·{" "}
          {textOrDash(run.state.job)}
        </p>

        <div className="life-stats">
          <div className="life-stat">
            <div className="life-stat__label">Health</div>
            <div className="life-stat__value">
              {numberOrDash(run.state.health)}
            </div>
          </div>
          <div className="life-stat">
            <div className="life-stat__label">Happiness</div>
            <div className="life-stat__value">
              {numberOrDash(run.state.happiness)}
            </div>
          </div>
          <div className="life-stat">
            <div className="life-stat__label">Knowledge</div>
            <div className="life-stat__value">
              {numberOrDash(run.state.knowledge)}
            </div>
          </div>
          <div className="life-stat">
            <div className="life-stat__label">Bonds</div>
            <div className="life-stat__value">
              {numberOrDash(run.state.bonds)}
            </div>
          </div>
        </div>

        <h3>Family</h3>
        {facts.people.length === 0 ? (
          <p className="life-panel__muted">No family recorded yet.</p>
        ) : (
          <div>
            {facts.people.map((person) => (
              <div className="life-journal__entry" key={`${person.role}:${person.name}`}>
                <strong>{person.name}</strong> · {person.role}
                {typeof person.age === "number" ? ` · age ${person.age}` : ""}
                {!person.alive ? " · died" : ""}
              </div>
            ))}
          </div>
        )}

        <h3>Birth</h3>
        <EntryList entries={sections.birth} empty="No birth record." />

        <h3>Life record</h3>
        <EntryList entries={sections.events} empty="No events yet." />

        <h3>Decisions</h3>
        <EntryList entries={sections.decisions} empty="No decisions yet." />

        <h3>Thoughts</h3>
        {Object.keys(run.thoughts).length === 0 ? (
          <p className="life-panel__muted">No written thoughts yet.</p>
        ) : (
          Object.entries(run.thoughts)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([age, text]) => (
              <div className="life-journal__entry" key={age}>
                <span className="life-journal__age">Age {age}</span>
                {text}
              </div>
            ))
        )}

        <LifeCredit engineVersion={run.engineVersion} />
      </div>
    </div>
  );
}
