import { useState } from "react";
import { writeLifeKey } from "@/game/engine/oneIn8b";
import type { LifeConfig } from "@/game/state/lifeRun";

type Period = "past" | "today" | "future" | "any";

function randomPastYear(): number {
  return 1986 + Math.floor(Math.random() * (2025 - 1986 + 1));
}

function resolvePeriod(period: Period, year: number): LifeConfig {
  if (period === "past") return { year };
  if (period === "future") return { future: true };
  if (period === "today") return {};
  const pick = Math.random();
  if (pick < 1 / 3) return { year: randomPastYear() };
  if (pick < 2 / 3) return {};
  return { future: true };
}

export function StartScreen({
  initialKey,
  onStart,
  busy = false,
  error,
}: {
  initialKey: string;
  onStart: (config: LifeConfig, key: string) => void;
  busy?: boolean;
  error?: string | null;
}) {
  const [period, setPeriod] = useState<Period>("today");
  const [year, setYear] = useState(1995);
  const [sex, setSex] = useState<"female" | "male" | "random">("random");
  const [advanced, setAdvanced] = useState(false);
  const [fifth, setFifth] = useState("");
  const [place, setPlace] = useState("");
  const [faith, setFaith] = useState("");
  const [disability, setDisability] = useState("");
  const [key, setKey] = useState(initialKey);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = key.trim();
    if (!trimmed) {
      setLocalError("Paste a 1in8b API key to begin.");
      return;
    }
    setLocalError(null);
    writeLifeKey(trimmed);
    const config: LifeConfig = {
      ...resolvePeriod(period, year),
      sex,
      ...(fifth ? { fifth } : {}),
      ...(place ? { place: place as "town" | "village" } : {}),
      ...(faith ? { faith } : {}),
      ...(disability ? { disability } : {}),
    };
    onStart(config, trimmed);
  };

  const shownError = localError ?? error;

  return (
    <div className="life-start">
      <div className="life-start__card">
        <h1 className="life-start__title">Một Đời</h1>
        <p className="life-start__sub">
          One life in Vietnam, from birth to death. Simulated from real
          statistics by the 1in8b Engine.
        </p>

        <div className="life-field">
          <label htmlFor="life-country">Country</label>
          <input id="life-country" value="Vietnam" readOnly />
        </div>

        <div className="life-row">
          <div className="life-field">
            <label htmlFor="life-period">Period</label>
            <select
              id="life-period"
              value={period}
              onChange={(event) => setPeriod(event.target.value as Period)}
            >
              <option value="past">Past (1986–2025)</option>
              <option value="today">Today</option>
              <option value="future">Future</option>
              <option value="any">Any</option>
            </select>
          </div>
          <div className="life-field">
            <label htmlFor="life-sex">Sex</label>
            <select
              id="life-sex"
              value={sex}
              onChange={(event) =>
                setSex(event.target.value as "female" | "male" | "random")
              }
            >
              <option value="random">Random</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </div>
        </div>

        {period === "past" && (
          <div className="life-field">
            <label htmlFor="life-year">Birth year: {year}</label>
            <input
              id="life-year"
              type="range"
              min={1986}
              max={2025}
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            />
          </div>
        )}

        <button
          type="button"
          className="life-button"
          onClick={() => setAdvanced((value) => !value)}
        >
          {advanced ? "Hide" : "Show"} birth conditions
        </button>

        {advanced && (
          <div className="life-row" style={{ marginTop: 12 }}>
            <div className="life-field">
              <label htmlFor="life-fifth">Family income</label>
              <select
                id="life-fifth"
                value={fifth}
                onChange={(event) => setFifth(event.target.value)}
              >
                <option value="">Any</option>
                <option value="1">Poorest fifth</option>
                <option value="2">Second fifth</option>
                <option value="3">Middle fifth</option>
                <option value="4">Fourth fifth</option>
                <option value="5">Richest fifth</option>
              </select>
            </div>
            <div className="life-field">
              <label htmlFor="life-place">Place</label>
              <select
                id="life-place"
                value={place}
                onChange={(event) => setPlace(event.target.value)}
              >
                <option value="">Any</option>
                <option value="town">City or town</option>
                <option value="village">Village</option>
              </select>
            </div>
            <div className="life-field">
              <label htmlFor="life-faith">Faith</label>
              <select
                id="life-faith"
                value={faith}
                onChange={(event) => setFaith(event.target.value)}
              >
                <option value="">Any</option>
                <option value="buddhist">Buddhist</option>
                <option value="christian">Christian</option>
                <option value="none">None</option>
                <option value="folk">Folk</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="life-field">
              <label htmlFor="life-disability">Disability</label>
              <select
                id="life-disability"
                value={disability}
                onChange={(event) => setDisability(event.target.value)}
              >
                <option value="">None</option>
                <option value="movement">Movement</option>
                <option value="hearing">Hearing</option>
                <option value="sight">Sight</option>
                <option value="autism">Autism</option>
                <option value="intellectual">Intellectual</option>
              </select>
            </div>
          </div>
        )}

        <div className="life-field" style={{ marginTop: 16 }}>
          <label htmlFor="life-key">1in8b API key</label>
          <input
            id="life-key"
            type="password"
            value={key}
            autoComplete="off"
            spellCheck={false}
            placeholder="k8b_…"
            onChange={(event) => setKey(event.target.value)}
          />
          <small className="life-panel__muted">
            Stored only in this browser. Get a free key from{" "}
            <a href="https://1in8b.life/en/api/" target="_blank" rel="noreferrer">
              1in8b.life/en/api
            </a>{" "}
            or{" "}
            <a href="mailto:api@1in8b.life">api@1in8b.life</a>.
          </small>
        </div>

        <div className="life-field">
          <label>Scene director</label>
          <input value="Template scenes (no LLM)" readOnly />
        </div>

        <div className="life-notice">
          This is a simulation, not a real person. Ages 15+. Death, illness and
          hardship appear at their real rates, but no scene is graphic.
          Sensitive content is off.
        </div>

        {shownError && (
          <div className="life-notice life-error" role="alert">
            {shownError}
          </div>
        )}

        <button
          type="button"
          className="life-button life-button--primary"
          disabled={!key.trim() || busy}
          onClick={submit}
        >
          {busy ? "Being born…" : "Be born"}
        </button>

        <p className="life-credit">
          Life simulated by the{" "}
          <a href="https://1in8b.life/en/api/" target="_blank" rel="noreferrer">
            1in8b Engine (1in8b.life)
          </a>
          . Not a real person. The engine’s sources include the UN, WHO and the
          World Bank.
        </p>
      </div>
    </div>
  );
}
