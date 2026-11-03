import type { LifeRun } from "@/game/state/lifeRun";

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function person(value: unknown): string | null {
  const p = record(value);
  if (!p) return null;
  const name = typeof p.name === "string" ? p.name : null;
  const age = typeof p.age === "number" ? `${p.age}` : null;
  const job = typeof p.job === "string" ? p.job : null;
  const parts = [name, age ? `age ${age}` : null, job].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function placeLabel(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === true) return "a city or town";
  if (value === false) return "a village";
  return "Vietnam";
}

export function BirthCard({
  run,
  onContinue,
}: {
  run: LifeRun;
  onContinue: () => void;
}) {
  const state = run.state;
  const who = record(state.who);
  const mother = person(state.mother);
  const father = person(state.father);
  const sex =
    typeof state.sex === "string"
      ? state.sex
      : typeof state.gender === "string"
        ? state.gender
        : run.config.sex === "random"
          ? null
          : run.config.sex;
  const faith =
    who && typeof who.faith === "string"
      ? who.faith
      : typeof state.faith === "string"
        ? state.faith
        : null;
  const fifth =
    typeof state.fifth === "string"
      ? state.fifth
      : typeof state.family_fifth === "string"
        ? state.family_fifth
        : run.config.fifth ?? null;
  const bornYear =
    typeof run.config.year === "number"
      ? run.config.year
      : typeof state.year === "number"
        ? state.year
        : null;

  return (
    <div className="life-start">
      <div className="life-start__card">
        <h1 className="life-start__title">
          {typeof state.name === "string" && state.name ? state.name : "A life"}
        </h1>
        <p className="life-start__sub">
          Born in {placeLabel(state.place)}
          {bornYear != null ? `, ${bornYear}` : ""}. One life, from birth to
          death.
        </p>

        <div className="life-stats">
          <div className="life-stat">
            <div className="life-stat__label">Sex</div>
            <div className="life-stat__value">{sex ?? "—"}</div>
          </div>
          <div className="life-stat">
            <div className="life-stat__label">Country</div>
            <div className="life-stat__value">
              {typeof state.country === "string" ? state.country : "Vietnam"}
            </div>
          </div>
          <div className="life-stat">
            <div className="life-stat__label">Family income</div>
            <div className="life-stat__value">
              {fifth ? `Fifth ${fifth}` : "—"}
            </div>
          </div>
          <div className="life-stat">
            <div className="life-stat__label">Faith</div>
            <div className="life-stat__value">{faith ?? "—"}</div>
          </div>
        </div>

        <h3>Family</h3>
        <p className="life-panel__muted">
          {mother ? `Mother: ${mother}` : "Mother: —"}
          <br />
          {father ? `Father: ${father}` : "Father: —"}
        </p>

        {run.journal[0] && (
          <>
            <h3>First page</h3>
            <p>{run.journal[0].text}</p>
          </>
        )}

        <div className="life-notice">
          Simulated life, not a real person. Hard things appear at their real
          rates, but no scene is graphic.
        </div>

        <button
          type="button"
          className="life-button life-button--primary"
          onClick={onContinue}
        >
          Begin this life
        </button>

        <p className="life-credit">
          Life simulated by the{" "}
          <a href="https://1in8b.life/en/api/" target="_blank" rel="noreferrer">
            1in8b Engine (1in8b.life)
          </a>
          . Not a real person.
        </p>
      </div>
    </div>
  );
}
